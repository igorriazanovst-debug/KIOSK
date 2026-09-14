// packages/player/src/inophone/platform/webPlatform.test.ts
//
// Проверяется НЕ браузерная реализация сама по себе — у неё нет продакшен-
// потребителя, — а СОВПАДЕНИЕ ЕЁ КОНТРАКТА с Electron-стороной. Если они
// разойдутся, отладка в браузере начнёт доказывать работу кода, который в
// собранном приложении падает, и это худший вид ошибки: она обнаружится
// у педагога, а не у разработчика.
//
// Один такой разъезд уже стоил времени в этой же работе: `applyCreateProfile`
// отдаёт и список, и созданную запись, и Electron-сторона «Инофона» вернула
// список, а первая версия браузерной — запись.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createWebPlatform, type KeyValueStorage } from './webPlatform.ts';

function memoryStorage(): KeyValueStorage {
  const map = new Map<string, string>();
  return {
    read: (key) => {
      const raw = map.get(key);
      return raw === undefined ? undefined : JSON.parse(raw);
    },
    write: (key, value) => {
      map.set(key, JSON.stringify(value));
    },
  };
}

function platform() {
  let n = 0;
  return createWebPlatform({ storage: memoryStorage(), newId: () => `p${++n}` });
}

test('создание профиля возвращает ПОЛНЫЙ СПИСОК — тот же контракт, что у Electron', async () => {
  const p = platform();
  const first = await p.createProfile('Аня');
  assert.ok(first.ok);
  assert.ok(Array.isArray(first.data), 'список, а не одна запись');
  assert.equal(first.data!.length, 1);

  const second = await p.createProfile('Миша');
  assert.equal(second.data!.length, 2, 'второй вызов отдаёт обоих, а не только нового');
});

test('пустое имя отвергается сообщением, а не исключением', async () => {
  const p = platform();
  const res = await p.createProfile('   ');
  assert.equal(res.ok, false);
  assert.ok(res.error && res.error.length > 0, 'текст для педагога, а не стек');
});

test('профиль переживает повторное чтение', async () => {
  const p = platform();
  await p.createProfile('Аня');
  const listed = await p.listProfiles();
  assert.equal(listed.data!.length, 1);
  assert.equal(listed.data![0].name, 'Аня');
});

test('удаление профиля уносит и его статистику', async () => {
  const p = platform();
  const created = await p.createProfile('Аня');
  const id = created.data![0].id;
  await p.recordSession(id, 'bedroom', { en: [2, 3] });
  assert.ok((await p.getStatistics()).data![id], 'статистика записалась');

  await p.deleteProfile(id);
  assert.deepEqual((await p.listProfiles()).data, []);
  assert.ok(!(await p.getStatistics()).data![id], 'статистика ушла вместе с профилем');
});

test('итог партии копится по сценам и языкам', async () => {
  const p = platform();
  const created = await p.createProfile('Миша');
  const id = created.data![0].id;
  await p.recordSession(id, 'bedroom', { en: [3, 4] });
  const stats = (await p.recordSession(id, 'bedroom', { en: [1, 4] })).data!;
  assert.deepEqual(stats[id].byScene.bedroom.lastSession, [1, 4], 'последняя замещается');
  assert.deepEqual(stats[id].byScene.bedroom.total, [4, 8], 'итог накапливается');
  assert.deepEqual(stats[id].byLanguage.en.total, [4, 8]);
});

test('настройки сохраняются и читаются обратно', async () => {
  const p = platform();
  await p.saveSettings({ schemaVersion: 1, interfaceLanguage: 'ru', studyLanguages: ['en', 'de'], volume: 55 });
  const back = (await p.getSettings()).data!;
  assert.equal(back.volume, 55);
  assert.deepEqual(back.studyLanguages, ['en', 'de']);
});

test('битые настройки в хранилище дают значения по умолчанию, а не ошибку', async () => {
  const storage = memoryStorage();
  storage.write('kiosk-inophone:settings', 'не настройки');
  const p = createWebPlatform({ storage });
  const back = await p.getSettings();
  assert.ok(back.ok);
  assert.equal(back.data!.interfaceLanguage, 'ru');
});

test('без пакета контента приложение не падает, а объясняет', async () => {
  const p = platform();
  const ctx = await p.getContext();
  assert.ok(ctx.ok);
  assert.equal(ctx.data!.hasLibrary, false);
  assert.ok(ctx.data!.libraryError, 'текст, который педагог передаст администратору');
});

test('адрес файла контента строится от корня пакета', () => {
  const p = platform();
  assert.equal(p.assetUrl('audio/fr/bed.mp3'), 'inophone-library/audio/fr/bed.mp3');
});
