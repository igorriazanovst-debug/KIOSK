// packages/player/electron/eumk/store.js
// Файловое хранилище «ключ - строка» для виджета «ЭУМК». Нужно вместо
// localStorage: Chromium пишет localStorage на диск с задержкой и теряет
// данные при внезапном завершении процесса (киоск выключают из розетки) -
// проверено на собранном приложении: через 20 с после записи данных не было.
// Здесь каждая запись - атомарная (временный файл + rename), поэтому после
// сбоя остаётся либо старое, либо новое значение целиком.

const fs = require('fs');
const path = require('path');
const { atomicWriteJson, readJsonStatus } = require('../chrono/atomicJson');

// Ключ приходит из рендерера: только «eumk:» + латиница/цифры/«:_-».
const KEY_RE = /^eumk:[a-z0-9:_-]{1,80}$/;
const MAX_VALUE_BYTES = 5 * 1024 * 1024;

function isValidKey(key) {
  return typeof key === 'string' && KEY_RE.test(key);
}

function fileNameFor(key) {
  return `${key.replace(/[^a-z0-9_-]/g, '_')}.json`;
}

class EumkStoreError extends Error {
  constructor(message) {
    super(message);
    this.name = 'EumkStoreError';
  }
}

function createEumkStore(baseDir) {
  function pathFor(key) {
    if (!isValidKey(key)) throw new EumkStoreError('Недопустимый ключ хранилища');
    return path.join(baseDir, fileNameFor(key));
  }

  return {
    getItem(key) {
      const filePath = pathFor(key);
      const status = readJsonStatus(filePath);
      if (!status.exists) return null;
      // Повреждённый файл - ошибка, а не «пусто»: иначе потеря данных
      // выглядела бы как «ещё не занимались».
      if (!status.valid || !status.data || typeof status.data.value !== 'string') {
        throw new EumkStoreError('Файл данных повреждён');
      }
      return status.data.value;
    },
    setItem(key, value) {
      const filePath = pathFor(key);
      if (typeof value !== 'string') throw new EumkStoreError('Значение должно быть строкой');
      if (Buffer.byteLength(value, 'utf8') > MAX_VALUE_BYTES) throw new EumkStoreError('Значение слишком велико');
      fs.mkdirSync(baseDir, { recursive: true });
      atomicWriteJson(filePath, { key, value });
    },
  };
}

module.exports = { createEumkStore, isValidKey, MAX_VALUE_BYTES, EumkStoreError };
