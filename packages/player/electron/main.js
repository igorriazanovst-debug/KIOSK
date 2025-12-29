const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let currentProject = null;

// Создание главного окна
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    backgroundColor: '#000000'
  });

  // Загрузка проекта
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Загрузка встроенного проекта если есть
  loadEmbeddedProject();
}

// Загрузка встроенного проекта
function loadEmbeddedProject() {
  const projectPath = path.join(__dirname, 'project.json');
  
  if (fs.existsSync(projectPath)) {
    try {
      const projectData = fs.readFileSync(projectPath, 'utf-8');
      currentProject = JSON.parse(projectData);
      
      // Отправляем проект в renderer процесс
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('load-project', currentProject);
      }
    } catch (error) {
      console.error('Failed to load embedded project:', error);
    }
  }
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
