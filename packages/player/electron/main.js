const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { registerChronoIpc } = require('./chrono/ipc');
const { registerNatComIpc } = require('./natcom/ipc');
const { buildBrowserWindowOptions, hasStandaloneAppWidget, hasNaturalCommunitiesWidget, NATCOM_WIDGET_TYPE } = require('./chrono/windowMode');
const { mediaDir: chronoMediaDir } = require('./chrono/mediaStore');
const { resolveWithinRoot: chronoResolveWithinRoot } = require('./chrono/pathGuard');
const { startNatComServer } = require('./natcom/server');

// Хендл встроенного сервера «Конструктор природных сообществ» (Тип 5) - один
// на процесс, останавливается/перезапускается вместе с окном (см. createWindow).
let natcomServerHandle = null;
let natcomServerPort = null;

// ─── Файловое логирование (DEBUG) ───────────────────────────────────────────
const PLAYER_LOG_FILE = path.join(path.dirname(process.execPath), 'player-debug.log');
function fileLog(...args) {
  const line = '[' + new Date().toISOString() + '] ' + args.map(a =>
    typeof a === 'object' ? JSON.stringify(a) : String(a)
  ).join(' ') + '\n';
  try { fs.appendFileSync(PLAYER_LOG_FILE, line); } catch {}
}
const _origLog = console.log;
const _origErr = console.error;
console.log = (...a) => { fileLog('LOG', ...a); _origLog(...a); };
console.error = (...a) => { fileLog('ERR', ...a); _origErr(...a); };
fileLog('=== Player started, execPath:', process.execPath, '===');
process.on('uncaughtException', (e) => fileLog('UNCAUGHT:', e.message, e.stack));
// Протоколы kioskcache:// и chronomedia:// должны быть privileged ДО
// app.ready (для <video>, range, fetch). chronomedia:// раздаёт локальную
// медиатеку виджета «Хронолиния» (mediaStore.js) - отдельная схема и
// отдельный корень на диске от kioskcache (тот живёт в userData/media-cache,
// per-Windows-пользователь; у Хронолинии общий на машину каталог, решение
// Фазы 0/1 - смешивать их в одном протоколе значило бы молча нарушить это
// решение).
try {
  const { protocol: _protocol } = require('electron');
  _protocol.registerSchemesAsPrivileged([
    { scheme: 'kioskcache', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true } },
    // chronomedia БЕЗ bypassCSP (в отличие от kioskcache) - найдено
    // security-review: bypassCSP снимает CSP целиком для схемы (script-src/
    // object-src/frame-src и т.д.), а не только то, что реально нужно для
    // <img src="chronomedia://...">. Схема вместо этого явно добавлена в
    // CSP-заголовок ниже (см. onHeadersReceived) - остальные директивы
    // (через фолбэк на default-src) продолжают действовать на неё.
    { scheme: 'chronomedia', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
  ]);
} catch (e) { fileLog('protocol register error', e.message); }
// ─────────────────────────────────────────────────────────────────────────────

let mainWindow = null;
let activationWindow = null;
let allowActivationClose = false;
let currentProject = null;
let chronoBaseDir = null;

// ═══ OFFLINE-CACHE-MODULE-V1 — Офлайн-кэш медиафайлов ═══════════════════════════
const { protocol, net } = require('electron');

// Папка кэша: userData/media-cache/<projectId8>/
function getCacheDir(projectId) {
  const pid = (projectId || 'noproj').slice(0, 8);
  const dir = path.join(app.getPath('userData'), 'media-cache', pid);
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  return dir;
}

// Извлекает fileId из URL вида .../api/projects/<pid>/files/<fileId>
function extractFileId(url) {
  if (typeof url !== 'string') return null;
  const m = url.match(/\/files\/([0-9a-fA-F-]{36})/);
  return m ? m[1] : null;
}

// Путь локального файла в кэше
function cachedFilePath(projectId, fileId) {
  return path.join(getCacheDir(projectId), fileId);
}

// Скачивает один файл с сервера в кэш (если ещё не скачан). Возвращает true при наличии в кэше.
function downloadToCache(absoluteUrl, projectId, fileId, token) {
  return new Promise((resolve) => {
    const dest = cachedFilePath(projectId, fileId);
    try {
      if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
        return resolve(true); // уже в кэше
      }
    } catch {}
    try {
      const parsed = new URL(absoluteUrl);
      const lib = parsed.protocol === 'https:' ? https : http;
      const options = {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      };
      const tmp = dest + '.tmp';
      const ws = fs.createWriteStream(tmp);
      const req = lib.request(options, (res) => {
        if (res.statusCode !== 200) {
          console.error('[cache] download failed', res.statusCode, fileId);
          res.resume();
          try { ws.close(); fs.unlinkSync(tmp); } catch {}
          return resolve(false);
        }
        res.pipe(ws);
        ws.on('finish', () => {
          ws.close(() => {
            try { fs.renameSync(tmp, dest); } catch {}
            console.log('[cache] downloaded', fileId);
            resolve(true);
          });
        });
      });
      req.setTimeout(8000, () => { // CACHE-OFFLINE-FIX — не висим в офлайне
        console.error('[cache] download timeout', fileId);
        try { req.destroy(); } catch {}
        try { ws.close(); fs.unlinkSync(tmp); } catch {}
        resolve(false);
      });
      req.on('error', (e) => {
        console.error('[cache] download error', fileId, e.message);
        try { ws.close(); fs.unlinkSync(tmp); } catch {}
        resolve(false);
      });
      req.end();
    } catch (e) {
      console.error('[cache] download exception', fileId, e.message);
      resolve(false);
    }
  });
}

// Готовит проект к отрисовке: скачивает медиа в кэш, подменяет URL на kioskcache://<projectId8>/<fileId>
// best-effort: при ошибке сети оставляет исходный (серверный) URL — онлайн-режим как fallback.
async function prepareProjectForRender(project) {
  if (!project) return project;
  const projectId = project.id;
  const serverUrl = (project.serverUrl || '').replace(/\/+$/, '');
  const json = JSON.stringify(project);

  // Находим все абсолютные и относительные URL на /files/<fileId>
  const fileIds = new Set();
  let m;
  const re = /(https?:\/\/[^"\\]*?)?\/api\/projects\/[0-9a-fA-F-]{36}\/files\/([0-9a-fA-F-]{36})/g;
  while ((m = re.exec(json)) !== null) {
    fileIds.add(m[2]);
  }

  if (fileIds.size === 0) return project;
  console.log('[cache] project has', fileIds.size, 'media files');

  // CACHE-OFFLINE-FIX — скачиваем только отсутствующие в кэше (офлайн: пропускаем сеть)
  const toDownload = [...fileIds].filter(fid => {
    const local = cachedFilePath(projectId, fid);
    try { return !(fs.existsSync(local) && fs.statSync(local).size > 0); } catch { return true; }
  });
  if (toDownload.length > 0 && playerToken) {
    console.log('[cache] need to download', toDownload.length, 'files');
    await Promise.all(toDownload.map(fid => {
      const abs = serverUrl + '/api/projects/' + projectId + '/files/' + fid;
      return downloadToCache(abs, projectId, fid, playerToken);
    }));
  } else if (toDownload.length > 0) {
    console.log('[cache] offline/no-token, using cached files only, missing:', toDownload.length);
  }

  // Подменяем URL: только те fileId, которые реально есть в кэше → kioskcache
  const pid8 = (projectId || 'noproj').slice(0, 8);
  let cachedCount = 0;
  let replaced = json.replace(re, (full, _proto, fid) => {
    const local = cachedFilePath(projectId, fid);
    try {
      if (fs.existsSync(local) && fs.statSync(local).size > 0) {
        cachedCount++;
        return 'kioskcache://' + pid8 + '/' + fid;
      }
    } catch {}
    return full; // нет в кэше — оставляем серверный URL
  });
  console.log('[cache] replaced', cachedCount, 'of', fileIds.size, 'URLs with kioskcache://');

  try {
    return JSON.parse(replaced);
  } catch (e) {
    console.error('[cache] reparse failed, returning original', e.message);
    return project;
  }
}

// Централизованная отправка проекта в renderer (с кэшированием)
async function sendLoadProject() {
  if (!currentProject || !mainWindow || !mainWindow.webContents) return;
  let toSend = currentProject;
  try {
    toSend = await prepareProjectForRender(currentProject);
  } catch (e) {
    console.error('[cache] prepare failed, sending raw', e.message);
  }
  mainWindow.webContents.send('load-project', toSend);
}
// ═══ конец модуля офлайн-кэша ════════════════════════════════════════════════


// Читает project.json синхронно, теми же путями поиска, что и
// loadEmbeddedProject() ниже — но независимо от неё и ДО создания окна,
// потому что опции BrowserWindow (fullscreen/kiosk/frame) нужно знать в
// момент конструирования, а loadEmbeddedProject() вызывается уже после.
// Специально не переиспользует состояние loadEmbeddedProject — она не
// трогается вовсе, чтобы не рисковать остальным поведением плеера.
function findProjectJsonForWindowModeSync() {
  const searchPaths = [
    path.join(process.resourcesPath || '', 'project.json'),
    path.join(__dirname, 'project.json'),
    path.join(app.getAppPath(), 'project.json'),
    path.join(app.getAppPath(), 'electron', 'project.json'),
    path.join(path.dirname(app.getPath('exe')), 'project.json'),
  ];

  for (const projectPath of searchPaths) {
    if (fs.existsSync(projectPath)) {
      try {
        return JSON.parse(fs.readFileSync(projectPath, 'utf-8'));
      } catch {
        // тот же путь, что и в loadEmbeddedProject: битый файл — пробуем следующий
      }
    }
  }
  return null;
}

// Создание главного окна
function createWindow() {

  const projectDataForWindowMode = findProjectJsonForWindowModeSync();
  const windowOptions = buildBrowserWindowOptions(projectDataForWindowMode);

  // Найдено вживую (скриншот, замечено пользователем): в оконном режиме
  // (frame:true, autoHideMenuBar:false - у standalone-app виджетов вроде
  // "Хронолиния"/"naturalcommunities") Electron рисует свой ДЕФОЛТНЫЙ
  // нативный меню-бар (File Edit View Window Help) - на английском и с
  // пунктами вроде Reload/Toggle DevTools, не нужными и не переведёнными
  // для этих продуктов. У каждого уже есть собственный полный тулбар на
  // русском для всех нужных действий - системное меню просто убирается, а
  // не переводится (нечего в нём показывать конечному пользователю школы/
  // музея). Обычный kiosk-режим (autoHideMenuBar+fullscreen+kiosk) этот бар
  // и так не показывает - трогаем меню только когда обнаружен один из
  // standalone-app виджетов, чтобы не менять поведение для остальных
  // клиентов.
  if (hasStandaloneAppWidget(projectDataForWindowMode)) {
    Menu.setApplicationMenu(null);
  }

  // Встроенный сервер «Конструктор природных сообществ» (Тип 5) - если
  // виджет есть в проекте, поднимаем Express+socket.io на 0.0.0.0 сразу при
  // создании окна (тот же момент, что и остальная инициализация плеера для
  // этого проекта). Порт/ёмкость берутся из свойств самого виджета, заданных
  // в редакторе (см. NATCOM_DEFAULT_PROPS в @kiosk/shared) - не хардкод.
  if (hasNaturalCommunitiesWidget(projectDataForWindowMode) && !natcomServerHandle) {
    const natcomWidget = (projectDataForWindowMode.widgets || []).find(
      (w) => w && typeof w === 'object' && w.type === NATCOM_WIDGET_TYPE
    );
    const props = (natcomWidget && natcomWidget.properties) || {};
    const port = Number(props.serverPort) || 33000;
    try {
      natcomServerHandle = startNatComServer({ port, onLog: fileLog });
      natcomServerPort = port;
    } catch (err) {
      fileLog('[natcom] failed to start embedded server:', err && err.message);
    }
  }

  mainWindow = new BrowserWindow({
    ...windowOptions,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // DIAG: ловим ошибки загрузки
  mainWindow.webContents.on('did-fail-load', (e, code, desc, url) => {
    console.log('[DIAG] did-fail-load:', code, desc, url);
  });
  mainWindow.webContents.on('console-message', (e, level, msg, line, src) => {
    console.log('[RENDERER]', msg, '(' + src + ':' + line + ')');
  });
  mainWindow.webContents.on('render-process-gone', (e, details) => {
    console.log('[DIAG] render-process-gone:', JSON.stringify(details));
  });
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[DIAG] did-finish-load OK, url:', mainWindow.webContents.getURL());
  });

  // Загрузка проекта
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Загрузка встроенного проекта
  loadEmbeddedProject();

  // Когда renderer готов — отправляем проект
  mainWindow.webContents.on('did-finish-load', () => {
    if (currentProject && currentProject.serverUrl) {
      startHeartbeat(currentProject.serverUrl, currentProject.name);
    }
    if (currentProject && mainWindow) {
      sendLoadProject(); // OFFLINE-CACHE-SENDPOINTS-V1
    }

  });
}

// Загрузка встроенного проекта — ищем в нескольких местах
function loadEmbeddedProject() {
  const searchPaths = [
    // 1. extraResources — куда electron-builder кладёт файлы
    path.join(process.resourcesPath || '', 'project.json'),
    // 2. Рядом с electron/main.js (dev режим)
    path.join(__dirname, 'project.json'),
    // 3. В корне приложения
    path.join(app.getAppPath(), 'project.json'),
    // 4. В electron/ внутри app
    path.join(app.getAppPath(), 'electron', 'project.json'),
    // 5. Рядом с exe (portable)
    path.join(path.dirname(app.getPath('exe')), 'project.json'),
  ];

  console.log('🔍 Searching for project.json...');

  for (const projectPath of searchPaths) {
    console.log(`  Checking: ${projectPath}`);
    if (fs.existsSync(projectPath)) {
      try {
        const projectData = fs.readFileSync(projectPath, 'utf-8');
        currentProject = JSON.parse(projectData);
        console.log(`✅ Project loaded from: ${projectPath}`);
        console.log(`   Name: ${currentProject.name || 'unnamed'}`);
        console.log(`   Widgets: ${currentProject.widgets ? currentProject.widgets.length : 0}`);

        // Отправляем проект в renderer процесс
        if (mainWindow && mainWindow.webContents) {
          // FIX-DOUBLE-CACHE-CALL — отправка через did-finish-load, здесь не нужна
        }
        // Запускаем аутентификацию плеера
        initPlayerAuth();
        return;
      } catch (error) {
        console.error(`❌ Failed to parse project from ${projectPath}:`, error.message);
      }
    }
  }

  console.warn('⚠️ project.json not found in any location');
}

// Обработчики IPC
ipcMain.handle('get-project', async () => {
  return currentProject;
});

// «Конструктор природных сообществ» (Тип 5) - адреса, по которым другие
// устройства школьной сети могут подключиться к встроенному серверу этого
// ПК (не localhost - именно LAN-адреса интерфейса).
ipcMain.handle('natcom:get-server-info', async () => {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return { port: natcomServerPort, addresses };
});

ipcMain.handle('open-project', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Kiosk Projects', extensions: ['json'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    try {
      const projectData = fs.readFileSync(result.filePaths[0], 'utf-8');
      currentProject = JSON.parse(projectData);
      // Уведомляем renderer
      if (mainWindow && mainWindow.webContents) {
        sendLoadProject(); // OFFLINE-CACHE-SENDPOINTS-V1
      }
      return currentProject;
    } catch (error) {
      console.error('Failed to load project:', error);
      return null;
    }
  }
  return null;
});

ipcMain.handle('toggle-fullscreen', async () => {
  if (mainWindow) {
    const isFullscreen = mainWindow.isFullScreen();
    mainWindow.setFullScreen(!isFullscreen);
    return !isFullscreen;
  }
  return false;
});

ipcMain.handle('close-app', async () => {
  app.quit();
});


// ─── Device heartbeat ────────────────────────────────────────────────────────
const WebSocket = require('ws');
const os = require('os');
const { v4: uuidv4 } = require('uuid');


// ─── Player Activation & Version Polling ────────────────────────────────────
const https = require('https');
const http = require('http');

let playerToken = null;
let needsActivation = false;
let playerTokenExpiresAt = null;
let knownVersion = null;
let versionPollTimer = null;
const VERSION_POLL_INTERVAL = 5 * 60 * 1000; // 5 минут

function getTokenFilePath() {
  // Токен хранится рядом с exe (удаляется при деинсталляции программы)
  // и привязан к projectId — смена проекта = новая активация.
  const dir = path.dirname(process.execPath);
  const pid = (currentProject && currentProject.id) ? currentProject.id.slice(0, 8) : 'noproj';
  return path.join(dir, `player-token-${pid}.json`);
}

function loadStoredToken() {
  try {
    const tokenFile = getTokenFilePath();
    if (fs.existsSync(tokenFile)) {
      const data = JSON.parse(fs.readFileSync(tokenFile, 'utf-8'));
      const now = new Date();
      const expires = new Date(data.expiresAt);
      // Проверяем: токен валиден по сроку И для текущего проекта
      const sameProject = !data.projectId || (currentProject && data.projectId === currentProject.id);
      if (expires > now && sameProject) {
        playerToken = data.token;
        playerTokenExpiresAt = data.expiresAt;
        console.log('[Auth] Loaded stored token, expires:', data.expiresAt);
        return true;
      }
      if (!sameProject) {
        console.log('[Auth] Stored token is for different project, ignoring');
      }
    }
  } catch (e) {
    console.error('[Auth] Failed to load stored token:', e.message);
  }
  return false;
}

function saveToken(token, expiresAt) {
  try {
    const pid = currentProject ? currentProject.id : null;
    fs.writeFileSync(getTokenFilePath(), JSON.stringify({ token, expiresAt, projectId: pid }));
  } catch (e) {
    console.error('[Auth] Failed to save token:', e.message);
  }
}

function clearToken() {
  playerToken = null;
  playerTokenExpiresAt = null;
  try { fs.unlinkSync(getTokenFilePath()); } catch {}
}

function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const data = JSON.stringify(body);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    const req = lib.request(options, (res) => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function httpGet(url, token) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname,
      method: 'GET',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    };
    const req = lib.request(options, (res) => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// Активация плеера по email + password.
// Возвращает { success, error } — error содержит реальную причину отказа
// сервера (несовпадение проекта, лимит устройств, статус лицензии и т.д.),
// а не общий "неверный логин/пароль" для любой ошибки.
async function activatePlayer(email, password, serverUrl, projectId) {
  const url = serverUrl.replace(/\/+$/, '') + '/api/license/activate-player';
  console.log('[Auth] Activating player...');
  let resp;
  try {
    resp = await httpPost(url, {
      email,
      password,
      deviceId: getDeviceId(),
      deviceName: os.hostname(),
      projectId
    });
  } catch (e) {
    console.error('[Auth] Activation request failed:', e.message);
    return { success: false, error: 'Не удалось связаться с сервером: ' + e.message };
  }
  if (resp.status === 200 || resp.status === 201) {
    playerToken = resp.body.token;
    playerTokenExpiresAt = resp.body.expiresAt;
    saveToken(playerToken, playerTokenExpiresAt);
    console.log('[Auth] Activated, token expires:', playerTokenExpiresAt);
    return { success: true };
  }
  console.error('[Auth] Activation failed:', resp.body);
  const serverError = resp.body && resp.body.error;
  // 400 от express-validator (`validateRequest.ts`) кладёт причину не в
  // `error` (там только общее "Validation failed"), а в `details` -
  // массив {field, message}. Без этого пользователь видит бесполезное
  // "Validation failed" без единой зацепки, какое поле не прошло.
  const details = Array.isArray(resp.body && resp.body.details) ? resp.body.details : [];
  const detailsText = details.map((d) => d.message).filter(Boolean).join('; ');
  const message = detailsText ? `${serverError}: ${detailsText}` : serverError;
  return { success: false, error: message || `Ошибка активации (код ${resp.status})` };
}

// Проверка версии проекта
async function checkProjectVersion(serverUrl, projectId) {
  if (!playerToken) return;
  try {
    const url = serverUrl.replace(/\/+$/, '') + '/api/projects/' + projectId + '/version';
    const resp = await httpGet(url, playerToken);
    if (resp.status === 401) {
      console.log('[Version] Token expired, re-activating...');
      clearToken();
      return;
    }
    if (resp.status !== 200) return;
    const serverVersion = resp.body.version;
    if (knownVersion === null) {
      knownVersion = serverVersion;
      console.log('[Version] Initial version:', knownVersion);
      return;
    }
    if (serverVersion > knownVersion) {
      console.log('[Version] Update available:', knownVersion, '->', serverVersion);
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('update-available', {
          currentVersion: knownVersion,
          newVersion: serverVersion
        });
      }
    }
  } catch (e) {
    console.error('[Version] Check failed:', e.message);
  }
}

function startVersionPolling(serverUrl, projectId) {
  if (versionPollTimer) clearInterval(versionPollTimer);
  // Первая проверка через 10 сек после старта
  setTimeout(() => checkProjectVersion(serverUrl, projectId), 10000);
  versionPollTimer = setInterval(() => checkProjectVersion(serverUrl, projectId), VERSION_POLL_INTERVAL);
  console.log('[Version] Polling started, interval:', VERSION_POLL_INTERVAL / 1000, 's');
}

// Показать отдельное окно активации
function showActivationScreen() {
  console.log('[showActivationScreen] called');
  needsActivation = true;

  if (activationWindow && !activationWindow.isDestroyed()) {
    console.log('[showActivationScreen] window already exists, focusing');
    activationWindow.focus();
    return;
  }
  console.log('[showActivationScreen] creating new window, __dirname:', __dirname);

  activationWindow = new BrowserWindow({
    width: 440,
    height: 380,
    frame: true,
    resizable: false,
    alwaysOnTop: true,
    center: true,
    parent: mainWindow,
    modal: true,
    closable: false,
    minimizable: false,
    title: 'Активация плеера',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'activation-preload.js')
    }
  });

  activationWindow.loadFile(path.join(__dirname, 'activation.html'));
  activationWindow.webContents.on('did-finish-load', () => {
    console.log('[ACTIVATION-DIAG] activation.html loaded OK');
  });
  activationWindow.webContents.on('did-fail-load', (e, code, desc) => {
    console.log('[ACTIVATION-DIAG] FAIL:', code, desc);
  });
  activationWindow.setMenuBarVisibility(false);

  // Блокируем закрытие окна пока нет токена (защита от Alt+F4)
  activationWindow.on('close', (e) => {
    // Разрешаем закрытие только программно (после успешной активации
    // или по кнопке "Закрыть приложение"). Alt+F4 блокируется.
    if (!allowActivationClose) {
      console.log('[activation] close blocked — use buttons only');
      e.preventDefault();
    }
  });
  activationWindow.on('closed', () => {
    activationWindow = null;
  });
}

// IPC: renderer спрашивает нужна ли активация (при монтировании)
ipcMain.handle('check-activation-needed', async () => {
  return { needed: needsActivation };
});

// IPC: renderer отправляет email + password для активации
// Нативное окно активации отправляет credentials
ipcMain.handle('activation-submit', async (event, email, password) => {
  console.log('[activation-submit] received');
  if (!currentProject || !currentProject.serverUrl) {
    return { success: false, error: 'No project config' };
  }
  const result = await activatePlayer(email, password, currentProject.serverUrl, currentProject.id);
  if (result.success) {
    needsActivation = false;
    startVersionPolling(currentProject.serverUrl, currentProject.id);
    reRegisterOverWs(); // сервер узнаёт свежий токен без переподключения по WS
    // POST-ACTIVATION-CACHE — токен получен, докачиваем медиа и пересылаем проект с локальными URL
    sendLoadProject();
  }
  return result;
});

ipcMain.handle('activation-close', async () => {
  // FIX-ACTIVATION-CLOSE-DESTROY — окно создано с closable:false, close() игнорируется → destroy()
  allowActivationClose = true;
  if (activationWindow && !activationWindow.isDestroyed()) {
    try { activationWindow.setClosable(true); } catch (_e) {}
    activationWindow.destroy();
  }
});

// IPC: закрыть всё приложение (кнопка при ошибке)
ipcMain.handle('activation-quit', async () => {
  allowActivationClose = true;
  app.quit();
});

ipcMain.handle('activate-with-credentials', async (event, email, password) => {
  if (!currentProject || !currentProject.serverUrl) {
    return { success: false, error: 'No project config' };
  }
  const result = await activatePlayer(email, password, currentProject.serverUrl, currentProject.id);
  if (result.success) {
    needsActivation = false;
    startVersionPolling(currentProject.serverUrl, currentProject.id);
    reRegisterOverWs(); // сервер узнаёт свежий токен без переподключения по WS
    sendLoadProject(); // POST-ACTIVATION-CACHE
  }
  return result;
});

// IPC: renderer запрашивает проверку пароля для обновления
ipcMain.handle('verify-update-password', async (event, password) => {
  if (!currentProject || !currentProject.serverUrl || !playerToken) {
    return { success: false, error: 'Not authenticated' };
  }
  try {
    const url = currentProject.serverUrl.replace(/\/+$/, '') + '/api/license/verify-update-password';
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const data = JSON.stringify({ password });
    const resp = await new Promise((resolve, reject) => {
      const options = {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          'Authorization': `Bearer ${playerToken}`
        }
      };
      const req = lib.request(options, (res) => {
        let raw = '';
        res.on('data', d => raw += d);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
          catch { resolve({ status: res.statusCode, body: raw }); }
        });
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
    return resp.body.success ? { success: true } : { success: false, error: resp.body.error };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Забирает projectData под указанным projectId с сервера и применяет его как
// currentProject (используется и обычным «применить обновление» из UI, и
// удалённым переподключением устройства к другой лицензии/проекту).
async function fetchAndApplyProject(projectId, token, serverUrl) {
  const url = serverUrl.replace(/\/+$/, '') + '/api/projects/' + projectId + '/version';
  const resp = await httpGet(url, token);
  if (resp.status !== 200) {
    return { success: false, error: 'Failed to fetch project (status ' + resp.status + ')' };
  }
  const updated = resp.body;
  // projectData = { id, name, canvas, version, widgets, metadata } — разворачиваем в корень currentProject
  const pd = updated.projectData;
  if (!pd || !pd.widgets) {
    return { success: false, error: 'Server returned no projectData' };
  }
  currentProject = {
    ...pd,
    serverUrl,
    licenseKeyHash: currentProject ? currentProject.licenseKeyHash : undefined
  };
  knownVersion = updated.version;
  console.log('[project] applied version', knownVersion, 'widgets:', pd.widgets.length, 'projectId:', projectId);
  if (mainWindow && mainWindow.webContents) {
    sendLoadProject(); // OFFLINE-CACHE-SENDPOINTS-V1
  }
  return { success: true };
}

// IPC: renderer подтверждает обновление — загружаем новый project.json
ipcMain.handle('apply-update', async () => {
  if (!currentProject || !currentProject.serverUrl || !playerToken) {
    return { success: false, error: 'Not authenticated' };
  }
  const result = await fetchAndApplyProject(currentProject.id, playerToken, currentProject.serverUrl);
  if (result.success && mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('update-applied', { version: knownVersion });
  }
  return result;
});

async function initPlayerAuth() {
  console.log('[initPlayerAuth] called, currentProject:', currentProject ? 'exists' : 'null');
  if (!currentProject) return;
  const { serverUrl, licenseKeyHash, id: projectId } = currentProject;
  console.log('[initPlayerAuth] serverUrl:', serverUrl, 'hash:', licenseKeyHash ? 'present' : 'MISSING');
  if (!serverUrl || !licenseKeyHash) {
    console.log('[Auth] No serverUrl or licenseKeyHash in project.json, skipping auth');
    return;
  }

  // Пробуем загрузить сохранённый токен
  if (loadStoredToken()) {
    console.log('[Auth] Using stored token');
    startVersionPolling(serverUrl, projectId);
    return;
  }

  // Нет токена — открываем отдельное окно активации
  console.log('[Auth] No valid token, opening activation window');
  showActivationScreen();
}
// ─────────────────────────────────────────────────────────────────────────────

let wsConnection = null;
let heartbeatTimer = null;
let deviceId = null;
let reassignInFlight = false;

function getDeviceId() {
  const configDir = app.getPath('userData');
  const idFile = path.join(configDir, 'device-id.txt');
  try {
    if (fs.existsSync(idFile)) {
      return fs.readFileSync(idFile, 'utf-8').trim();
    }
  } catch {}
  const id = uuidv4();
  try {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(idFile, id);
  } catch {}
  return id;
}

function getLocalIp() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

// Отправляет device:register по уже открытому (или только что открытому) WS.
// Включает playerToken, если он на этот момент уже есть — сервер проверяет
// его подпись и то, что он реально выписан для этого deviceId, и только тогда
// помечает соединение "verified" (годным для приёма приватных push вроде
// device:reassign). Если токена ещё нет (активация не завершена) — соединение
// остаётся неверифицированным, как раньше.
function sendDeviceRegister(ws, projectName) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({
    type: 'device:register',
    deviceId,
    token: playerToken || undefined,
    name: os.hostname(),
    os: `${os.platform()} ${os.release()}`,
    version: app.getVersion ? app.getVersion() : '1.0.0',
    ipAddress: getLocalIp(),
    projectName: projectName || 'unknown'
  }));
}

// Вызывается сразу после успешной активации, чтобы сервер узнал свежий
// playerToken и пометил уже открытое WS-соединение как verified — без
// необходимости его переоткрывать.
function reRegisterOverWs() {
  if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
    sendDeviceRegister(wsConnection, currentProject ? currentProject.name : undefined);
  }
}

function startHeartbeat(serverUrl, projectName) {
  if (wsConnection) {
    try { wsConnection.close(); } catch {}
    wsConnection = null;
  }
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }

  const wsUrl = serverUrl.replace(/^http/, 'ws').replace(/\/+$/, '') + '/ws';
  deviceId = deviceId || getDeviceId();

  function connect() {
    try {
      const ws = new WebSocket(wsUrl);
      wsConnection = ws;

      ws.on('open', () => {
        console.log('[Device] Connected to server:', wsUrl);
        sendDeviceRegister(ws, projectName);
      });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'deployment:start' && msg.projectData) {
            currentProject = msg.projectData;
            if (mainWindow && mainWindow.webContents) {
              sendLoadProject(); // OFFLINE-CACHE-SENDPOINTS-V1
            }
            console.log('[Device] New project deployed:', msg.projectData.name);
          } else if (msg.type === 'device:shutdown') {
            console.log('[Device] Received device:shutdown, quitting...');
            // Стёртый локальный токен — чтобы при следующем запуске плеер не
            // пытался молча переиспользовать уже отозванный сервером токен
            // (раньше приходилось перезапускать приложение дважды, чтобы
            // экран активации вообще появился).
            clearToken();
            if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
            try { wsConnection.close(); } catch {}
            app.quit();
          } else if (msg.type === 'device:reassign' && msg.token) {
            if (reassignInFlight) {
              console.warn('[Device] Ignoring device:reassign — one is already being applied');
              return;
            }
            reassignInFlight = true;
            console.log('[Device] Received device:reassign');
            (async () => {
              try {
                // Токен применяем и сохраняем СРАЗУ и безусловно: сервер к
                // этому моменту уже отозвал старый токен (см.
                // DeviceReassignController — отзывает только после
                // подтверждённой доставки этого сообщения), откатываться на
                // него нельзя. Если ниже не получится сразу подтянуть контент
                // нового проекта — это не страшно, следующий цикл опроса
                // версии подтянет его сам; но БЕЗ сохранения токена устройство
                // осталось бы вообще без рабочего токена.
                playerToken = msg.token;
                playerTokenExpiresAt = msg.expiresAt;
                saveToken(playerToken, playerTokenExpiresAt);

                const serverUrl = currentProject ? currentProject.serverUrl : null;
                const targetProjectId = msg.projectId;
                if (targetProjectId && serverUrl && (!currentProject || currentProject.id !== targetProjectId)) {
                  const result = await fetchAndApplyProject(targetProjectId, msg.token, serverUrl);
                  if (!result.success) {
                    console.error('[Device] Reassign: token applied, but failed to load new project content (will retry on next version poll):', result.error);
                  }
                }
                if (currentProject && currentProject.serverUrl) {
                  startVersionPolling(currentProject.serverUrl, currentProject.id);
                }
                reRegisterOverWs(); // сервер должен узнать новый токен как можно скорее
                console.log('[Device] Reassigned successfully, project:', currentProject ? currentProject.id : '(unchanged)');
              } catch (e) {
                console.error('[Device] Reassign failed:', e.message);
              } finally {
                reassignInFlight = false;
              }
            })();
          }
        } catch {}
      });

      ws.on('close', () => {
        console.log('[Device] Disconnected, reconnecting in 30s...');
        wsConnection = null;
        setTimeout(connect, 30000);
      });

      ws.on('error', (err) => {
        console.error('[Device] WS error:', err.message);
        wsConnection = null;
      });
    } catch (err) {
      console.error('[Device] connect failed:', err.message);
      setTimeout(connect, 30000);
    }
  }

  connect();

  heartbeatTimer = setInterval(() => {
    if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
      wsConnection.send(JSON.stringify({ type: 'device:heartbeat', deviceId }));
    }
  }, 30000);
}
// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle события
// KIOSKCACHE-RANGE-SUPPORT — хелперы для отдачи файлов из кэша
function guessMime(fileId, filePath) {
  // расширение могло не сохраниться в имени (имя = fileId). Пробуем по сигнатуре + дефолты.
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm',
    '.m4v': 'video/mp4', '.mkv': 'video/x-matroska',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
    '.pdf': 'application/pdf'
  };
  if (map[ext]) return map[ext];
  // имя без расширения — читаем магические байты
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(16);
    fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);
    const hex = buf.toString('hex');
    if (buf.slice(4, 8).toString() === 'ftyp') return 'video/mp4'; // mp4/mov
    if (hex.startsWith('89504e47')) return 'image/png';
    if (hex.startsWith('ffd8ff')) return 'image/jpeg';
    if (hex.startsWith('47494638')) return 'image/gif';
    if (buf.slice(0, 4).toString() === 'RIFF') return 'video/webm';
    if (buf.slice(0, 5).toString().includes('<?xml') || buf.slice(0, 4).toString() === '<svg') return 'image/svg+xml';
  } catch {}
  return 'application/octet-stream';
}

function nodeStreamToWeb(nodeStream) {
  const { Readable } = require('stream');
  if (Readable.toWeb) {
    return Readable.toWeb(nodeStream);
  }
  // fallback
  return new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk) => controller.enqueue(new Uint8Array(chunk)));
      nodeStream.on('end', () => controller.close());
      nodeStream.on('error', (err) => controller.error(err));
    },
    cancel() { nodeStream.destroy(); }
  });
}

app.whenReady().then(() => {
  // Локальное хранилище проектов «Хронолинии» — не влияет на существующие
  // клиентов, канал 'chrono:*' используется только виджетом chronoline,
  // которого нет в проектах остальных клиентов.
  try {
    const { baseDir, isFallback } = registerChronoIpc({ ipcMain, app, dialog });
    chronoBaseDir = baseDir;
    fileLog('[chrono] storage dir:', baseDir, isFallback ? '(fallback: no write access to shared dir)' : '');
  } catch (err) {
    fileLog('[chrono] failed to initialize local storage:', err && err.message);
  }

  // Локальное хранилище презентаций «Конструктора природных сообществ» —
  // не влияет на существующих клиентов, канал 'natcom:*' используется
  // только виджетом naturalcommunities.
  try {
    const { baseDir: natcomBaseDir, isFallback: natcomIsFallback } = registerNatComIpc({ ipcMain, app });
    fileLog('[natcom] storage dir:', natcomBaseDir, natcomIsFallback ? '(fallback: no write access to shared dir)' : '');
  } catch (err) {
    fileLog('[natcom] failed to initialize local storage:', err && err.message);
  }

  const { session } = require('electron');
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        // chronomedia: добавлена явно (не полагаемся на bypassCSP этой
        // схемы - её больше нет, см. registerSchemesAsPrivileged выше).
        'Content-Security-Policy': ["default-src 'self' 'unsafe-inline' 'unsafe-eval' data: file: blob: chronomedia: http: https: ws: wss:"]
      }
    });
  });

  // Обработчик протокола kioskcache://<projectId8>/<fileId> → локальный файл из кэша
  protocol.handle('kioskcache', async (request) => {
    // KIOSKCACHE-RANGE-SUPPORT — отдаём локальный файл с поддержкой HTTP Range (для <video> seeking)
    try {
      const u = new URL(request.url);
      const pid8 = u.hostname;
      const fileId = u.pathname.replace(/^\/+/, '');
      const filePath = path.join(app.getPath('userData'), 'media-cache', pid8, fileId);
      if (!fs.existsSync(filePath)) {
        return new Response('Not found', { status: 404 });
      }
      const stat = fs.statSync(filePath);
      const total = stat.size;
      const mime = guessMime(fileId, filePath);
      const rangeHeader = request.headers.get('range') || request.headers.get('Range');

      if (rangeHeader) {
        const m = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
        let start = m && m[1] ? parseInt(m[1], 10) : 0;
        let end = m && m[2] ? parseInt(m[2], 10) : total - 1;
        if (isNaN(start) || start < 0) start = 0;
        if (isNaN(end) || end >= total) end = total - 1;
        if (start > end) start = 0;
        const chunkSize = end - start + 1;
        const stream = fs.createReadStream(filePath, { start, end });
        const webStream = nodeStreamToWeb(stream);
        return new Response(webStream, {
          status: 206,
          headers: {
            'Content-Type': mime,
            'Content-Length': String(chunkSize),
            'Content-Range': `bytes ${start}-${end}/${total}`,
            'Accept-Ranges': 'bytes'
          }
        });
      }

      // Без Range — отдаём целиком, но с Accept-Ranges чтобы браузер мог seeking
      const stream = fs.createReadStream(filePath);
      const webStream = nodeStreamToWeb(stream);
      return new Response(webStream, {
        status: 200,
        headers: {
          'Content-Type': mime,
          'Content-Length': String(total),
          'Accept-Ranges': 'bytes'
        }
      });
    } catch (e) {
      return new Response('Error: ' + e.message, { status: 500 });
    }
  });

  // Обработчик протокола chronomedia://<projectId>/<sha256+ext> → локальный
  // файл из медиатеки виджета «Хронолиния» (mediaStore.js). Путь резолвится
  // через resolveWithinRoot (тот же guard, что у остального хранилища
  // Хронолинии) - имя файла в URL приходит из рендерера, но пришедшее
  // значение не более доверенное, чем любой другой ввод с той стороны
  // process-границы.
  protocol.handle('chronomedia', async (request) => {
    try {
      if (!chronoBaseDir) return new Response('Chrono storage not initialized', { status: 503 });

      const u = new URL(request.url);
      const projectId = u.hostname;
      const fileName = decodeURIComponent(u.pathname.replace(/^\/+/, ''));
      const dir = chronoMediaDir(chronoBaseDir, projectId);
      const filePath = chronoResolveWithinRoot(dir, fileName);

      if (!fs.existsSync(filePath)) {
        return new Response('Not found', { status: 404 });
      }

      const stat = fs.statSync(filePath);
      // Найдено security-review: fileName вроде "." или имени вложенной
      // директории внутри media/ проходит resolveWithinRoot (это не выход
      // за пределы корня) и fs.existsSync, но fs.createReadStream на
      // директории роняет АСИНХРОННУЮ ошибку EISDIR уже во время чтения
      // потока - вне этого синхронного try/catch, так что вместо чистого
      // 404 запрос зависает/ломается. Явная проверка здесь, до создания
      // потока.
      if (!stat.isFile()) {
        return new Response('Not found', { status: 404 });
      }
      const total = stat.size;
      const mime = guessMime(fileName, filePath);
      const rangeHeader = request.headers.get('range') || request.headers.get('Range');

      if (rangeHeader) {
        const m = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
        let start = m && m[1] ? parseInt(m[1], 10) : 0;
        let end = m && m[2] ? parseInt(m[2], 10) : total - 1;
        if (isNaN(start) || start < 0) start = 0;
        if (isNaN(end) || end >= total) end = total - 1;
        if (start > end) start = 0;
        const chunkSize = end - start + 1;
        const stream = fs.createReadStream(filePath, { start, end });
        return new Response(nodeStreamToWeb(stream), {
          status: 206,
          headers: {
            'Content-Type': mime,
            'Content-Length': String(chunkSize),
            'Content-Range': `bytes ${start}-${end}/${total}`,
            'Accept-Ranges': 'bytes'
          }
        });
      }

      const stream = fs.createReadStream(filePath);
      return new Response(nodeStreamToWeb(stream), {
        status: 200,
        headers: { 'Content-Type': mime, 'Content-Length': String(total), 'Accept-Ranges': 'bytes' }
      });
    } catch (e) {
      // Путь вне корня (PathGuardError) и прочие сбои раздачи - оба 404, не
      // 500: не выдаём наружу, существует ли путь за пределами разрешённого
      // корня, разница между "нет такого файла" и "нельзя туда смотреть"
      // рендереру не нужна.
      return new Response('Not found', { status: 404 });
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (natcomServerHandle) {
    natcomServerHandle.stop().catch(() => {});
    natcomServerHandle = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Обработка сбоев
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});
