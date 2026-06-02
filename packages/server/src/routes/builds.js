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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/x-icon' || file.originalname.endsWith('.ico')) {
      cb(null, true);
    } else {
      cb(new Error('Only .ico files are allowed'));
    }
  }
});

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
async function buildDistribution(buildId, projectData, appName, appId, iconPath, serverBaseUrl = 'http://localhost:3002') {
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
    await runCommand('npm', ['run', 'electron:build:win'], PLAYER_PATH);
    console.log('✅ Установщик создан');

    // 7. Копирование установщика в output
    updateStatus('finalizing', 90, 'Финализация');
    
    const distElectronPath = path.join(PLAYER_PATH, 'dist-electron');
    const files = await fs.readdir(distElectronPath);
    const setupFile = files.find(f => f.endsWith('.exe') && f.includes('Setup'));
    
    if (!setupFile) {
      throw new Error('Установщик не найден в dist-electron');
    }

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
    buildDistribution(buildId, projectData, appName, appId, req.file?.path, serverBaseUrl).catch(err => {
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
