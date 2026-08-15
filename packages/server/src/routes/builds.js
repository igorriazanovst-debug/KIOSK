import { Router } from 'express';
import multer from 'multer';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import crypto from 'crypto';
import { convertIcoToPng } from '../utils/iconConvert.js';
import { sanitizePackageName } from '../utils/packageName.js';
import { getBuildScript, selectBuildArtifacts } from '../utils/buildArtifacts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

// Пути
const PLAYER_PATH = path.join(__dirname, '..', '..', '..', 'player');
const TEMP_DIR = path.join(__dirname, '..', '..', 'data', 'temp');
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'data', 'builds');

// Хранилище сборок (в продакшене лучше использовать БД)
const builds = new Map();

// Multer для загрузки иконок
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await fs.mkdir(TEMP_DIR, { recursive: true });
    cb(null, TEMP_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, `icon-${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024, fieldSize: 100 * 1024 * 1024 }, // MULTER-FIELDSIZE-FIX icon 5MB, project JSON field до 100MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/x-icon' || file.originalname.endsWith('.ico')) {
      cb(null, true);
    } else {
      cb(new Error('Only .ico files are allowed'));
    }
  }
});

// Загрузить актуальный projectData из БД по projectId
async function loadProjectFromDB(projectId) {
  if (!projectId) return null;
  try {
    const { getPrismaClient } = await import('../config/database.js');
    const prisma = getPrismaClient();
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      console.error('[builds] project not found in DB:', projectId);
      return null;
    }
    console.log('[builds] loaded project from DB:', project.name, 'version', project.version);
    // projectData уже содержит {id, name, canvas, version, widgets, metadata}
    return project.projectData;
  } catch (e) {
    console.error('[builds] loadProjectFromDB error:', e.message);
    return null;
  }
}

// Получить licenseKey из JWT токена редактора (тип client / license_user)
async function resolveKeyFromToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  try {
    const jwt = (await import('jsonwebtoken')).default;
    const fs = await import('fs');
    const pathMod = await import('path');
    const { fileURLToPath } = await import('url');
    const __dir = pathMod.dirname(fileURLToPath(import.meta.url));
    const publicKey = fs.readFileSync(pathMod.join(__dir, '..', '..', 'keys', 'public.key'), 'utf8');

    const payload = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
    if (!payload || !payload.licenseId) {
      console.error('[builds] token has no licenseId');
      return null;
    }

    const { getPrismaClient } = await import('../config/database.js');
    const prisma = getPrismaClient();
    const license = await prisma.license.findUnique({ where: { id: payload.licenseId } });
    if (!license) {
      console.error('[builds] license not found for id', payload.licenseId);
      return null;
    }
    console.log('[builds] resolved licenseKey for license', license.id);
    return license.licenseKey;
  } catch (e) {
    console.error('[builds] resolveKeyFromToken error:', e.message);
    return null;
  }
}

// Инициализация папок
async function initFolders() {
  await fs.mkdir(TEMP_DIR, { recursive: true });
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

initFolders();


// Заменяет относительные /api/... URL на абсолютные в данных проекта
function resolveProjectUrls(projectData, baseUrl) {
  let json = JSON.stringify(projectData);
  // Заменяем обычные /api/ пути
  const before = (json.match(/\/api\//g) || []).length;
  json = json.replace(/\/api\//g, `${baseUrl}/api/`);
  // Заменяем HTML-encoded варианты (&quot;/api/ и %22/api/)
  json = json.replace(/&quot;\/api\//g, `&quot;${baseUrl}/api/`);
  json = json.replace(/%22\/api\//g, `%22${baseUrl}/api/`);
  const after = (json.match(/\/api\//g) || []).length;
  console.log(`resolveProjectUrls: baseUrl=${baseUrl}, replaced=${before - after} occurrences, remaining=${after}`);
  return JSON.parse(json);
}

// Утилита: запуск команды
function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, {
      cwd,
      shell: true,
      stdio: 'pipe'
    });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log(data.toString());
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(data.toString());
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with code ${code}\n${stderr}`));
      }
    });

    process.on('error', (err) => {
      reject(err);
    });
  });
}

// Функция сборки дистрибутива
async function buildDistribution(buildId, projectData, appName, appId, iconPath, serverBaseUrl = 'http://localhost:3002', licenseKey = null, platform = 'win') {
  const updateStatus = (status, progress, message) => {
    builds.set(buildId, {
      ...builds.get(buildId),
      status,
      progress,
      message,
      updated_at: new Date().toISOString()
    });
  };

  try {
    updateStatus('preparing', 10, 'Подготовка файлов');

    // 1. Копируем проект в player/electron/project.json
    // Заменяем относительные URL на абсолютные чтобы Electron мог загрузить файлы
    const resolvedProjectData = resolveProjectUrls(projectData, serverBaseUrl);

    // Добавляем serverUrl и licenseKeyHash для аутентификации плеера
    resolvedProjectData.serverUrl = serverBaseUrl;
    if (licenseKey) {
      resolvedProjectData.licenseKeyHash = crypto.createHash('sha256').update(licenseKey).digest('hex');
    }

    const projectJsonPath = path.join(PLAYER_PATH, 'electron', 'project.json');
    await fs.writeFile(projectJsonPath, JSON.stringify(resolvedProjectData, null, 2));
    console.log(`✅ Проект сохранен: ${projectJsonPath}`);

    // 2. Обновляем package.json
    updateStatus('configuring', 20, 'Настройка параметров');
    
    const packageJsonPath = path.join(PLAYER_PATH, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

    // Строка попадает в package.json, NSIS-скрипт и (для Linux) .desktop-файл —
    // убираем управляющие символы/переводы строк, чтобы кривой appName не
    // ломал синтаксис этих файлов. Кириллица и остальной текст не трогаются.
    const safeDisplayName = appName.replace(/[\x00-\x1f\x7f]/g, '').trim() || 'Kiosk App';

    packageJson.build = packageJson.build || {};
    packageJson.build.appId = appId;
    packageJson.build.productName = safeDisplayName;
    // SHORTCUT-NAME-FROM-APPNAME: имя ярлыка (рабочий стол / меню Пуск) = имя приложения из редактора,
    // иначе оставался жёстко зашитый nsis.shortcutName и установленное приложение называлось иначе.
    packageJson.build.nsis = packageJson.build.nsis || {};
    packageJson.build.nsis.shortcutName = safeDisplayName;

    // productName часто кириллический — Debian/RPM package name обязан быть ASCII
    // ([a-z0-9][a-z0-9+.-]*), иначе electron-builder получит пустое/битое имя пакета.
    // executableName берём из appId (уже ASCII), отдельно от отображаемого productName.
    packageJson.build.linux = packageJson.build.linux || {};
    packageJson.build.linux.executableName = sanitizePackageName(appId);

    // 3. Настройка иконки
    if (iconPath) {
      await fs.mkdir(path.join(PLAYER_PATH, 'assets'), { recursive: true });
      if (platform === 'linux') {
        // Linux-пакеты (deb/rpm/AppImage) хотят PNG, а не .ico — конвертируем
        // крупнейший кадр загруженной иконки. Если подходящего кадра нет,
        // просто оставляем дефолтную assets/icon.png (сборка не должна падать).
        const icoBuffer = await fs.readFile(iconPath);
        const pngBuffer = await convertIcoToPng(icoBuffer);
        if (pngBuffer) {
          const iconDestPath = path.join(PLAYER_PATH, 'assets', 'icon.png');
          await fs.writeFile(iconDestPath, pngBuffer);
          console.log(`✅ Иконка (PNG) установлена: ${iconDestPath}`);
        } else {
          console.log('⚠️ В .ico нет кадра ≥256px — используется иконка по умолчанию для Linux');
        }
      } else {
        const iconDestPath = path.join(PLAYER_PATH, 'assets', 'icon.ico');
        await fs.copyFile(iconPath, iconDestPath);
        packageJson.build.win = packageJson.build.win || {};
        packageJson.build.win.icon = 'assets/icon.ico';
        console.log(`✅ Иконка установлена: ${iconDestPath}`);
      }
    }

    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log(`✅ package.json обновлен`);

    // 4. Проверка зависимостей
    updateStatus('installing', 30, 'Проверка зависимостей');
    
    const nodeModulesPath = path.join(PLAYER_PATH, 'node_modules');
    try {
      await fs.access(nodeModulesPath);
      console.log('✅ node_modules существует');
    } catch {
      console.log('📦 Установка зависимостей...');
      await runCommand('npm', ['install'], PLAYER_PATH);
      console.log('✅ Зависимости установлены');
    }

    // 5. Сборка React приложения
    updateStatus('building', 50, 'Сборка приложения');
    console.log('🔨 Сборка React приложения...');
    await runCommand('npm', ['run', 'build'], PLAYER_PATH);
    console.log('✅ React приложение собрано');

    // 6. Сборка Electron дистрибутива
    const buildScript = getBuildScript(platform);
    if (!buildScript) {
      throw new Error(`Unsupported platform: ${platform}`);
    }
    updateStatus('packaging', 70, platform === 'linux' ? 'Создание пакетов Linux' : 'Создание установщика');
    console.log(`📦 Создание дистрибутива (${platform})...`);
    // Очищаем старые артефакты ДО сборки чтобы не подхватить чужие
    const _distPath = path.join(PLAYER_PATH, 'dist-electron');
    try {
      const _oldFiles = await fs.readdir(_distPath);
      for (const _stale of selectBuildArtifacts(_oldFiles, platform)) {
        await fs.unlink(path.join(_distPath, _stale.fileName));
        console.log('[build] removed stale artifact:', _stale.fileName);
      }
    } catch (_e) { /* dist-electron может не существовать */ }
    await runCommand('npm', ['run', buildScript], PLAYER_PATH);
    console.log('✅ Дистрибутив создан');

    // 7. Копирование артефактов в output (для Linux — несколько: deb/rpm × x64/arm64)
    updateStatus('finalizing', 90, 'Финализация');

    const distElectronPath = path.join(PLAYER_PATH, 'dist-electron');
    const producedFiles = await fs.readdir(distElectronPath);
    const artifacts = selectBuildArtifacts(producedFiles, platform);
    if (artifacts.length === 0) {
      throw new Error('Установщик не найден в dist-electron');
    }

    const safeAppName = appName.replace(/[^a-zA-Z0-9]/g, '_');
    const timestamp = Date.now();
    const outFiles = [];
    for (const artifact of artifacts) {
      const ext = path.extname(artifact.fileName);
      const safeLabel = artifact.label.replace(/[^a-zA-Z0-9]/g, '_');
      const outputFileName = `${safeAppName}_${safeLabel}_${timestamp}${ext}`;
      const sourcePath = path.join(distElectronPath, artifact.fileName);
      const outputPath = path.join(OUTPUT_DIR, outputFileName);

      await fs.copyFile(sourcePath, outputPath);
      const stats = await fs.stat(outputPath);
      outFiles.push({
        file_name: outputFileName,
        download_url: `/api/builds/download/${outputFileName}`,
        file_size: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
        label: artifact.label
      });
      console.log(`✅ Артефакт скопирован: ${outputPath}`);
    }

    // 8. Завершение
    updateStatus('completed', 100, 'Готово!');
    builds.set(buildId, {
      ...builds.get(buildId),
      status: 'completed',
      progress: 100,
      message: 'Установщик готов',
      files: outFiles,
      // back-compat: клиенты до multi-format сборок читают только эти поля
      download_url: outFiles[0].download_url,
      file_name: outFiles[0].file_name,
      file_size: outFiles[0].file_size,
      completed_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Ошибка сборки:', error);
    updateStatus('failed', 0, error.message);
    builds.set(buildId, {
      ...builds.get(buildId),
      error: error.message,
      failed_at: new Date().toISOString()
    });
  }
}

/**
 * POST /api/builds
 * Запустить сборку дистрибутива
 */
router.post('/', upload.single('icon'), async (req, res) => {
  try {
    const { project, appName = 'Kiosk App', appId = 'com.kiosk.app', platform = 'win' } = req.body;

    if (!project) {
      return res.status(400).json({
        success: false,
        error: 'Project data is required'
      });
    }

    if (!getBuildScript(platform)) {
      return res.status(400).json({
        success: false,
        error: `Unsupported platform: ${platform}`
      });
    }

    // Парсим проект
    let projectData;
    try {
      projectData = typeof project === 'string' ? JSON.parse(project) : project;
    } catch (e) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid project JSON' 
      });
    }

    // Создаем задачу сборки
    const buildId = crypto.randomUUID();
    
    builds.set(buildId, {
      id: buildId,
      status: 'queued',
      progress: 0,
      message: 'В очереди',
      app_name: appName,
      app_id: appId,
      created_at: new Date().toISOString()
    });

    // Отправляем buildId сразу
    res.json({
      success: true,
      data: {
        build_id: buildId,
        message: 'Сборка запущена',
        status_url: `/api/builds/${buildId}`
      }
    });

    // Запускаем сборку асинхронно
    const serverBaseUrl = process.env.PLAYER_SERVER_URL || `${req.protocol}://${req.get('host')}`;
    const licenseKey = await resolveKeyFromToken(req.headers.authorization);

    // Берём АКТУАЛЬНЫЙ projectData из БД (по id из присланного проекта),
    // чтобы сборка не зависела от состояния редактора (store).
    const projectId = projectData && projectData.id ? projectData.id : null;
    const dbProjectData = await loadProjectFromDB(projectId);
    const finalProjectData = dbProjectData || projectData;
    if (dbProjectData) {
      console.log('[builds] using fresh projectData from DB');
    } else {
      console.log('[builds] DB load failed, falling back to posted projectData');
    }

    buildDistribution(buildId, finalProjectData, appName, appId, req.file?.path, serverBaseUrl, licenseKey, platform).catch(err => {
      console.error(`Build ${buildId} failed:`, err);
    });

  } catch (error) {
    console.error('Build error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Проверить, что запрос пришёл от аутентифицированного платформенного админа.
// Не переиспользует middleware/auth.ts напрямую (этот файл — ESM, копируется в
// dist как есть, минуя tsc), а повторяет ту же проверку, что и
// authenticateAdmin: валидный RS256-токен + role === 'ADMIN' в БД.
async function requireAdmin(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  try {
    const jwt = (await import('jsonwebtoken')).default;
    const fs = await import('fs');
    const pathMod = await import('path');
    const { fileURLToPath } = await import('url');
    const __dir = pathMod.dirname(fileURLToPath(import.meta.url));
    const publicKey = fs.readFileSync(pathMod.join(__dir, '..', '..', 'keys', 'public.key'), 'utf8');

    const payload = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
    if (!payload || !payload.userId) return null;

    const { getPrismaClient } = await import('../config/database.js');
    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true }
    });
    if (!user || user.role !== 'ADMIN') return null;
    return user;
  } catch (e) {
    console.error('[builds] requireAdmin error:', e.message);
    return null;
  }
}

// Проект принадлежит лицензии напрямую, либо у лицензии есть активный
// (не отозванный) ProjectGrant на этот проект.
async function licenseOwnsOrIsGrantedProject(prisma, licenseId, projectId) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { licenseId },
        { grants: { some: { licenseId, revokedAt: null } } }
      ]
    }
  });
  return !!project;
}

/**
 * POST /api/builds/for-license/:licenseId
 * Админский запуск сборки exe под ПРОИЗВОЛЬНУЮ лицензию (не под лицензию
 * вызывающего, как в POST /api/builds/). licenseKey берётся из БД по
 * licenseId, а не из токена запроса — так администратор может собрать exe
 * для клиента, не логинясь под его учёткой.
 */
router.post('/for-license/:licenseId', async (req, res, next) => {
  // Проверяем админа ДО multer — иначе неаутентифицированный запрос уже
  // успевает записать файл иконки на диск до того, как получит 401.
  const admin = await requireAdmin(req);
  if (!admin) {
    return res.status(401).json({ success: false, error: 'Admin authentication required' });
  }
  next();
}, upload.single('icon'), async (req, res) => {
  try {
    const { licenseId } = req.params;
    const { projectId, appName = 'Kiosk App', appId = 'com.kiosk.app', platform = 'win' } = req.body;

    if (!projectId) {
      return res.status(400).json({ success: false, error: 'projectId is required' });
    }

    if (!getBuildScript(platform)) {
      return res.status(400).json({ success: false, error: `Unsupported platform: ${platform}` });
    }

    const { getPrismaClient } = await import('../config/database.js');
    const prisma = getPrismaClient();

    const license = await prisma.license.findUnique({ where: { id: licenseId } });
    if (!license) {
      return res.status(404).json({ success: false, error: 'License not found' });
    }

    const hasAccess = await licenseOwnsOrIsGrantedProject(prisma, licenseId, projectId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: 'License does not have access to this project' });
    }

    const buildId = crypto.randomUUID();
    builds.set(buildId, {
      id: buildId,
      status: 'queued',
      progress: 0,
      message: 'В очереди',
      app_name: appName,
      app_id: appId,
      created_at: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        build_id: buildId,
        message: 'Сборка запущена',
        status_url: `/api/builds/${buildId}`
      }
    });

    const serverBaseUrl = process.env.PLAYER_SERVER_URL || `${req.protocol}://${req.get('host')}`;
    const projectData = await loadProjectFromDB(projectId);
    if (!projectData) {
      builds.set(buildId, {
        ...builds.get(buildId),
        status: 'failed',
        error: 'Project not found in DB',
        failed_at: new Date().toISOString()
      });
      return;
    }

    buildDistribution(buildId, projectData, appName, appId, req.file?.path, serverBaseUrl, license.licenseKey, platform).catch(err => {
      console.error(`Build ${buildId} failed:`, err);
    });
  } catch (error) {
    console.error('Admin build error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/builds/:buildId
 * Получить статус сборки
 */
router.get('/:buildId', (req, res) => {
  const { buildId } = req.params;
  const build = builds.get(buildId);

  if (!build) {
    return res.status(404).json({ 
      success: false, 
      error: 'Build not found' 
    });
  }

  res.json({ 
    success: true, 
    data: build 
  });
});

/**
 * GET /api/builds
 * Список всех сборок (кому и какая лицензия что собирала) — только админ.
 * Security-фикс: раньше был доступен без аутентификации вообще, что позволяло
 * перечислить все сборки на сервере (включая собранные для чужих лицензий
 * через новый /for-license/:licenseId) и найти их download_url.
 */
router.get('/', async (req, res) => {
  const admin = await requireAdmin(req);
  if (!admin) {
    return res.status(401).json({ success: false, error: 'Admin authentication required' });
  }

  const buildsList = Array.from(builds.values()).sort((a, b) =>
    new Date(b.created_at) - new Date(a.created_at)
  );

  res.json({
    success: true,
    data: buildsList
  });
});

/**
 * GET /api/builds/download/:fileName
 * Скачать установщик
 */
router.get('/download/:fileName', async (req, res) => {
  const { fileName } = req.params;
  const filePath = path.join(OUTPUT_DIR, fileName);

  try {
    await fs.access(filePath);
    res.download(filePath, fileName);
  } catch {
    res.status(404).json({ 
      success: false, 
      error: 'File not found' 
    });
  }
});

/**
 * DELETE /api/builds/:buildId
 * Удалить сборку — только админ (security-фикс: раньше был доступен без
 * аутентификации, любой, кто знает buildId, мог удалить чужую сборку).
 */
router.delete('/:buildId', async (req, res) => {
  const admin = await requireAdmin(req);
  if (!admin) {
    return res.status(401).json({ success: false, error: 'Admin authentication required' });
  }

  const { buildId } = req.params;
  const build = builds.get(buildId);

  if (!build) {
    return res.status(404).json({ 
      success: false, 
      error: 'Build not found' 
    });
  }

  // Удаляем ВСЕ артефакты сборки (Linux-сборка может дать до 4 файлов —
  // deb/rpm × x64/arm64), а не только legacy-поле file_name (иначе
  // остальные молча остаются на диске и продолжают быть скачиваемыми).
  const filesToDelete = build.files && build.files.length > 0
    ? build.files.map(f => f.file_name)
    : (build.file_name ? [build.file_name] : []);

  for (const fileName of filesToDelete) {
    const filePath = path.join(OUTPUT_DIR, fileName);
    try {
      await fs.unlink(filePath);
    } catch (e) {
      console.error('Failed to delete file:', fileName, e);
    }
  }

  builds.delete(buildId);
  
  res.json({ 
    success: true, 
    message: 'Build deleted' 
  });
});

export default router;
