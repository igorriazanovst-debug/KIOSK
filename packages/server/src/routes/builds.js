import { Router } from 'express';
import multer from 'multer';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import crypto from 'crypto';

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
async function buildDistribution(buildId, projectData, appName, appId, iconPath, serverBaseUrl = 'http://localhost:3002', licenseKey = null) {
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
    
    packageJson.build = packageJson.build || {};
    packageJson.build.appId = appId;
    packageJson.build.productName = appName;
    // SHORTCUT-NAME-FROM-APPNAME: имя ярлыка (рабочий стол / меню Пуск) = имя приложения из редактора,
    // иначе оставался жёстко зашитый nsis.shortcutName и установленное приложение называлось иначе.
    packageJson.build.nsis = packageJson.build.nsis || {};
    packageJson.build.nsis.shortcutName = appName;

    // 3. Настройка иконки
    if (iconPath) {
      const iconDestPath = path.join(PLAYER_PATH, 'assets', 'icon.ico');
      await fs.mkdir(path.join(PLAYER_PATH, 'assets'), { recursive: true });
      await fs.copyFile(iconPath, iconDestPath);
      packageJson.build.win = packageJson.build.win || {};
      packageJson.build.win.icon = 'assets/icon.ico';
      console.log(`✅ Иконка установлена: ${iconDestPath}`);
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
    updateStatus('packaging', 70, 'Создание установщика');
    console.log('📦 Создание установщика Windows...');
    // Очищаем старые .exe ДО сборки чтобы не копировать чужой
    const _distPath = path.join(PLAYER_PATH, 'dist-electron');
    try {
      const _oldExe = await fs.readdir(_distPath);
      for (const _f of _oldExe) {
        if (_f.endsWith('.exe') && _f.includes('Setup')) {
          await fs.unlink(path.join(_distPath, _f));
          console.log('[build] removed old exe:', _f);
        }
      }
    } catch (_e) { /* dist-electron может не существовать */ }
    await runCommand('npm', ['run', 'electron:build:win'], PLAYER_PATH);
    console.log('✅ Установщик создан');

    // 7. Копирование установщика в output
    updateStatus('finalizing', 90, 'Финализация');
    
    // FIX-EXE-SELECTION-V2
    const distElectronPath = path.join(PLAYER_PATH, 'dist-electron');
    const files = await fs.readdir(distElectronPath);
    const exeFiles = files.filter(f => f.endsWith('.exe') && f.includes('Setup'));
    if (exeFiles.length === 0) {
      throw new Error('Установщик не найден в dist-electron');
    }
    const _exeStats = await Promise.all(exeFiles.map(f => fs.stat(path.join(distElectronPath, f))));
    const setupFile = exeFiles.reduce((best, f, idx) => _exeStats[idx].mtimeMs > _exeStats[best.idx].mtimeMs ? {f, idx} : best, {f: exeFiles[0], idx: 0}).f;
    const sourcePath = path.join(distElectronPath, setupFile);
    const outputFileName = `${appName.replace(/[^a-zA-Z0-9]/g, '_')}_Setup_${Date.now()}.exe`;
    const outputPath = path.join(OUTPUT_DIR, outputFileName);
    
    await fs.copyFile(sourcePath, outputPath);
    console.log(`✅ Установщик скопирован: ${outputPath}`);

    // Получаем размер файла
    const stats = await fs.stat(outputPath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    // 8. Завершение
    updateStatus('completed', 100, 'Готово!');
    builds.set(buildId, {
      ...builds.get(buildId),
      status: 'completed',
      progress: 100,
      message: 'Установщик готов',
      download_url: `/api/builds/download/${outputFileName}`,
      file_name: outputFileName,
      file_size: `${fileSizeMB} MB`,
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
    const { project, appName = 'Kiosk App', appId = 'com.kiosk.app' } = req.body;
    
    if (!project) {
      return res.status(400).json({ 
        success: false, 
        error: 'Project data is required' 
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

    buildDistribution(buildId, finalProjectData, appName, appId, req.file?.path, serverBaseUrl, licenseKey).catch(err => {
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
 * Список всех сборок
 */
router.get('/', (req, res) => {
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
 * Удалить сборку
 */
router.delete('/:buildId', async (req, res) => {
  const { buildId } = req.params;
  const build = builds.get(buildId);

  if (!build) {
    return res.status(404).json({ 
      success: false, 
      error: 'Build not found' 
    });
  }

  // Удаляем файл если он есть
  if (build.file_name) {
    const filePath = path.join(OUTPUT_DIR, build.file_name);
    try {
      await fs.unlink(filePath);
    } catch (e) {
      console.error('Failed to delete file:', e);
    }
  }

  builds.delete(buildId);
  
  res.json({ 
    success: true, 
    message: 'Build deleted' 
  });
});

export default router;
