const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

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
// ─────────────────────────────────────────────────────────────────────────────

let mainWindow = null;
let activationWindow = null;
let currentProject = null;

// Создание главного окна
function createWindow() {
  
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: true,
    kiosk: true,
    frame: false,
    autoHideMenuBar: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, 'preload.js')
    },
    backgroundColor: '#000000'
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
      mainWindow.webContents.send('load-project', currentProject);
    }
    // Если активация ещё нужна — отправляем снова (renderer мог не получить первый раз)
    if (needsActivation && mainWindow) {
      setTimeout(() => {
        if (needsActivation && mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('show-activation', {});
        }
      }, 500);
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
          mainWindow.webContents.send('load-project', currentProject);
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
        mainWindow.webContents.send('load-project', currentProject);
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
  return path.join(app.getPath('userData'), 'player-token.json');
}

function loadStoredToken() {
  try {
    const tokenFile = getTokenFilePath();
    if (fs.existsSync(tokenFile)) {
      const data = JSON.parse(fs.readFileSync(tokenFile, 'utf-8'));
      const now = new Date();
      const expires = new Date(data.expiresAt);
      if (expires > now) {
        playerToken = data.token;
        playerTokenExpiresAt = data.expiresAt;
        console.log('[Auth] Loaded stored token, expires:', data.expiresAt);
        return true;
      }
    }
  } catch (e) {
    console.error('[Auth] Failed to load stored token:', e.message);
  }
  return false;
}

function saveToken(token, expiresAt) {
  try {
    fs.writeFileSync(getTokenFilePath(), JSON.stringify({ token, expiresAt }));
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

// Активация плеера по email + password
async function activatePlayer(email, password, serverUrl, projectId) {
  const url = serverUrl.replace(/\/+$/, '') + '/api/license/activate-player';
  console.log('[Auth] Activating player...');
  const resp = await httpPost(url, {
    email,
    password,
    deviceId: getDeviceId(),
    deviceName: os.hostname(),
    projectId
  });
  if (resp.status === 200 || resp.status === 201) {
    playerToken = resp.body.token;
    playerTokenExpiresAt = resp.body.expiresAt;
    saveToken(playerToken, playerTokenExpiresAt);
    console.log('[Auth] Activated, token expires:', playerTokenExpiresAt);
    return true;
  }
  console.error('[Auth] Activation failed:', resp.body);
  return false;
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

  activationWindow.on('closed', () => {
    activationWindow = null;
  });
}

// IPC: renderer спрашивает нужна ли активация (при монтировании)
ipcMain.handle('check-activation-needed', async () => {
  return { needed: needsActivation };
});

// IPC: renderer отправляет email + password для активации
ipcMain.handle('activate-with-credentials', async (event, email, password) => {
  if (!currentProject || !currentProject.serverUrl) {
    return { success: false, error: 'No project config' };
  }
  const ok = await activatePlayer(email, password, currentProject.serverUrl, currentProject.id);
  if (ok) {
    needsActivation = false;
    startVersionPolling(currentProject.serverUrl, currentProject.id);
    return { success: true };
  }
  return { success: false, error: 'Activation failed on server' };
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

// IPC: renderer подтверждает обновление — загружаем новый project.json
ipcMain.handle('apply-update', async () => {
  if (!currentProject || !currentProject.serverUrl || !playerToken) {
    return { success: false, error: 'Not authenticated' };
  }
  try {
    const url = currentProject.serverUrl.replace(/\/+$/, '') + '/api/projects/' + currentProject.id + '/version';
    const resp = await httpGet(url, playerToken);
    if (resp.status !== 200) return { success: false, error: 'Failed to fetch update' };

    // Обновляем project данные (widgets и canvas берём с сервера)
    const updated = resp.body;
    // Получаем полный проект через обычный API
    const projUrl = currentProject.serverUrl.replace(/\/+$/, '') + '/api/projects/' + currentProject.id;
    const projResp = await httpGet(projUrl, playerToken);
    if (projResp.status === 200 && projResp.body) {
      currentProject = { ...projResp.body, serverUrl: currentProject.serverUrl, licenseKeyHash: currentProject.licenseKeyHash };
      knownVersion = updated.version;
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('load-project', currentProject);
        mainWindow.webContents.send('update-applied', { version: knownVersion });
      }
      return { success: true };
    }
    return { success: false, error: 'Failed to fetch full project' };
  } catch (e) {
    return { success: false, error: e.message };
  }
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
        ws.send(JSON.stringify({
          type: 'device:register',
          deviceId,
          name: os.hostname(),
          os: `${os.platform()} ${os.release()}`,
          version: app.getVersion ? app.getVersion() : '1.0.0',
          ipAddress: getLocalIp(),
          projectName: projectName || 'unknown'
        }));
      });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'deployment:start' && msg.projectData) {
            currentProject = msg.projectData;
            if (mainWindow && mainWindow.webContents) {
              mainWindow.webContents.send('load-project', currentProject);
            }
            console.log('[Device] New project deployed:', msg.projectData.name);
          } else if (msg.type === 'device:shutdown') {
            console.log('[Device] Received device:shutdown, quitting...');
            if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
            try { wsConnection.close(); } catch {}
            app.quit();
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
app.whenReady().then(() => {
  const { session } = require('electron');
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self' 'unsafe-inline' 'unsafe-eval' data: file: blob: http: https: ws: wss:"]
      }
    });
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Обработка сбоев
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});
