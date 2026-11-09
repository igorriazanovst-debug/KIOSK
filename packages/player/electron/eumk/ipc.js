// packages/player/electron/eumk/ipc.js
// Мост рендерер - файловое хранилище виджета «ЭУМК». Вызовы синхронные
// (ipcRenderer.sendSync): данные - единицы килобайт, а хранилище в рендерере
// должно вести себя как localStorage. Каталог - профиль самого приложения
// (app.getPath('userData')), а не общий каталог: у каждого комплекса свои
// учётные записи и результаты, и они не должны смешиваться.

const path = require('path');
const { createEumkStore } = require('./store');
const { hashPassword, verifyPassword } = require('./passwords');

const DATA_DIR_NAME = 'eumk-data';

function registerEumkIpc({ ipcMain, app }) {
  const baseDir = path.join(app.getPath('userData'), DATA_DIR_NAME);
  const store = createEumkStore(baseDir);

  // Ответ - всегда объект: исключение внутри обработчика sendSync оставило бы рендерер без ответа.
  ipcMain.on('eumk:get-item', (event, key) => {
    try {
      event.returnValue = { ok: true, value: store.getItem(key) };
    } catch (err) {
      event.returnValue = { ok: false, error: err && err.message };
    }
  });

  ipcMain.on('eumk:set-item', (event, key, value) => {
    try {
      store.setItem(key, value);
      event.returnValue = { ok: true };
    } catch (err) {
      event.returnValue = { ok: false, error: err && err.message };
    }
  });

  // Пароли (K5-1): PBKDF2 в 600k итераций занимает десятые доли секунды,
  // поэтому handle/invoke с АСИНХРОННЫМ pbkdf2 (не pbkdf2Sync - синхронный
  // блокировал бы цикл событий главного процесса вместе с остальными
  // IPC-каналами). Ответ - тот же конверт {ok, value|error}.
  ipcMain.handle('eumk:hash-password', async (_event, password) => {
    try {
      return { ok: true, value: await hashPassword(password) };
    } catch (err) {
      return { ok: false, error: err && err.message };
    }
  });

  ipcMain.handle('eumk:verify-password', async (_event, password, record) => {
    try {
      return { ok: true, value: await verifyPassword(password, record) };
    } catch (err) {
      return { ok: false, error: err && err.message };
    }
  });

  return { baseDir };
}

module.exports = { registerEumkIpc };
