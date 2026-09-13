import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWebPlatform } from './webPlatform.ts';
import { alphabet } from '@kiosk/shared';

/** Хранилище-двойник вместо localStorage: тесты не зависят от браузера */
function fakeStorage(initial: Record<string, unknown> = {}) {
  const map = new Map<string, unknown>(Object.entries(initial));
  return {
    read: (key: string) => map.get(key),
    write: (key: string, value: unknown) => void map.set(key, value),
  };
}

let counter = 0;
const platform = (storage = fakeStorage()) =>
  createWebPlatform({ storage, newId: () => `id-${++counter}` });

test('веб-платформа объявляет себя веб-платформой', () => {
  assert.equal(platform().kind, 'web');
});

test('без подключённого пакета контента сообщает об этом внятно', async () => {
  const p = platform();
  const context = await p.getContext();
  assert.equal(context.data?.hasLibrary, false);
  assert.match(context.data?.libraryError ?? '', /контент/i);
  const library = await p.getLibrary();
  assert.equal(library.ok, false);
});

test('игрок создаётся и читается обратно', async () => {
  const p = platform();
  const created = await p.createProfile('Аня');
  assert.equal(created.ok, true);
  const list = await p.listProfiles();
  assert.deepEqual(list.data?.map((x) => x.name), ['Аня']);
});

test('правила имени те же, что на Windows', () => {
  // Проверяем не реализацию, а то, что обе платформы берут правила из shared:
  // разойдутся правила — отладка в браузере перестанет что-либо доказывать
  return (async () => {
    const p = platform();
    await p.createProfile('Аня');
    const empty = await p.createProfile('   ');
    assert.equal(empty.ok, false);
    const dup = await p.createProfile('аня');
    assert.equal(dup.ok, false);
  })();
});

test('удаление игрока уносит его статистику, как и на Windows', async () => {
  const p = platform();
  const anya = await p.createProfile('Аня');
  const borya = await p.createProfile('Боря');
  await p.saveSession(anya.data!.id, [{ letterNumber: 1, correct: true }]);
  await p.saveSession(borya.data!.id, [{ letterNumber: 2, correct: false }]);

  await p.deleteProfile(anya.data!.id);

  const statistics = await p.getStatistics();
  assert.equal(statistics.data?.[anya.data!.id], undefined);
  assert.ok(statistics.data?.[borya.data!.id]);
});

test('статистика сливается по тем же правилам: сессия замещается, итог растёт', async () => {
  const p = platform();
  const anya = await p.createProfile('Аня');
  await p.saveSession(anya.data!.id, [
    { letterNumber: 1, correct: true },
    { letterNumber: 1, correct: false },
  ]);
  const after = await p.saveSession(anya.data!.id, [{ letterNumber: 1, correct: true }]);
  assert.deepEqual((after.data as any)['1'], { lastSession: [1, 1], total: [2, 3] });
});

test('настройки на чистом хранилище — дефолт', async () => {
  const settings = await platform().getSettings();
  assert.deepEqual(settings.data, alphabet.DEFAULT_ALPHABET_SETTINGS);
});

test('недопустимые настройки не сохраняются', async () => {
  const p = platform();
  assert.equal((await p.saveSettings({ volume: 500 })).ok, false);
  assert.equal((await p.saveSettings({ questionCount: 7 } as never)).ok, false);
  assert.equal((await p.saveSettings({ volume: 30 })).ok, true);
  assert.equal((await p.getSettings()).data?.volume, 30);
});

test('повреждённая запись настроек не роняет рантайм', async () => {
  const p = platform(fakeStorage({ 'kiosk-alphabet:settings': { volume: 'громко' } }));
  assert.deepEqual((await p.getSettings()).data, alphabet.DEFAULT_ALPHABET_SETTINGS);
});

test('путь ресурса — обычный относительный, без протокола Electron', () => {
  assert.equal(platform().assetUrl('img/avtobus.svg'), 'alphabet-library/img/avtobus.svg');
});

test('цвет экрана сохраняется и проверяется схемой', () => {
  return (async () => {
    const p = platform();
    assert.equal((await p.saveSettings({ screenTheme: 'night' })).ok, true);
    assert.equal((await p.getSettings()).data?.screenTheme, 'night');
    assert.equal((await p.saveSettings({ screenTheme: 'ультрафиолет' as never })).ok, false);
  })();
});

test('пароль педагога: по умолчанию подходит, чужой нет', async () => {
  const p = platform();
  assert.equal((await p.checkTeacherPassword('12345')).data, true);
  assert.equal((await p.checkTeacherPassword('54321')).data, false);
  assert.equal((await p.teacherPasswordState()).data?.isDefault, true);
});

test('смена пароля закрывает старый', async () => {
  const p = platform();
  assert.equal((await p.setTeacherPassword('9876')).ok, true);
  assert.equal((await p.checkTeacherPassword('9876')).data, true);
  assert.equal((await p.checkTeacherPassword('12345')).data, false);
  assert.equal((await p.teacherPasswordState()).data?.isDefault, false);
});

test('короткий пароль не принимается — правила те же, что на Windows', async () => {
  const p = platform();
  const result = await p.setTeacherPassword('12');
  assert.equal(result.ok, false);
  // и старый пароль остаётся рабочим
  assert.equal((await p.checkTeacherPassword('12345')).data, true);
});
