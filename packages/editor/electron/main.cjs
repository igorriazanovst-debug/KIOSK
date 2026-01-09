const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
// Простая проверка dev режима без electron-is-dev
const isDev = !app.isPackaged;

let mainWindow = null;

// Создание меню приложения
function createMenu() {
  const template = [
    {
      label: 'Файл',
      submenu: [
        {
          label: 'Новый проект',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('menu-new-project');
          }
        },
        {
          label: 'Открыть проект',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow.webContents.send('menu-open-project');
          }
        },
        {
          label: 'Сохранить проект',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow.webContents.send('menu-save-project');
          }
        },
        { type: 'separator' },
        {
          label: 'Экспорт',
          submenu: [
            {
              label: 'Экспорт как JSON',
              click: () => {
                mainWindow.webContents.send('menu-export-json');
              }
            },
            {
              label: 'Создать установщик Player',
              click: () => {
                mainWindow.webContents.send('menu-export-player');
              }
            }
          ]
        },
        { type: 'separator' },
        { role: 'quit', label: 'Выход' }
      ]
    },
    {
      label: 'Правка',
      submenu: [
        { role: 'undo', label: 'Отменить' },
        { role: 'redo', label: 'Повторить' },
        { type: 'separator' },
        { role: 'cut', label: 'Вырезать' },
        { role: 'copy', label: 'Копировать' },
        { role: 'paste', label: 'Вставить' },
        { role: 'delete', label: 'Удалить' },
        { type: 'separator' },
        { role: 'selectAll', label: 'Выделить всё' }
      ]
    },
    {
      label: 'Вид',
      submenu: [
        { role: 'reload', label: 'Перезагрузить' },
        { role: 'toggleDevTools', label: 'Инструменты разработчика' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Сбросить масштаб' },
        { role: 'zoomIn', label: 'Увеличить' },
        { role: 'zoomOut', label: 'Уменьшить' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Полноэкранный режим' }
      ]
    },
    {
      label: 'Помощь',
      submenu: [
        {
          label: 'Документация',
          click: async () => {
            const { shell } = require('electron');
            await shell.openExternal('https://github.com/your-repo/docs');
          }
        },
        {
          label: 'О программе',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'О программе',
              message: 'Kiosk Editor',
              detail: `Версия: ${app.getVersion()}\n\nПлатформа для создания контента для киосков`
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Создание главного окна
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    icon: path.join(__dirname, '../assets/icon.ico'),
    backgroundColor: '#1e1e1e',
    show: false
  });

  // Загрузка приложения
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Показать окно когда готово
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Создать меню
  createMenu();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers

// Сохранить файл
ipcMain.handle('save-file', async (event, data) => {
  const { defaultPath, filters, content } = data;
  
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath,
    filters
  });

  if (!result.canceled && result.filePath) {
    try {
      fs.writeFileSync(result.filePath, content, 'utf-8');
      return { success: true, filePath: result.filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  return { success: false, canceled: true };
});

// Открыть файл
ipcMain.handle('open-file', async (event, filters) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters
  });

  if (!result.canceled && result.filePaths.length > 0) {
    try {
      const content = fs.readFileSync(result.filePaths[0], 'utf-8');
      return { 
        success: true, 
        content, 
        filePath: result.filePaths[0] 
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  return { success: false, canceled: true };
});

// Диалог выбора папки
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return { success: true, path: result.filePaths[0] };
  }

  return { success: false, canceled: true };
});

// Показать сообщение
ipcMain.handle('show-message', async (event, options) => {
  return await dialog.showMessageBox(mainWindow, options);
});

// App lifecycle
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

// Обработка ошибок
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});
