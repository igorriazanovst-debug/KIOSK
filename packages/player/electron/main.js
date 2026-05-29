const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
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
      preload: path.join(__dirname, 'preload.js')
    },
    backgroundColor: '#000000'
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
