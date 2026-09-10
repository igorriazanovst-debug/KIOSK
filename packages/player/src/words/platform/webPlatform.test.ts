import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWebPlatform } from './webPlatform.ts';

/** Хранилище-двойник вместо localStorage: тесты не зависят от браузера */
function fakeStorage(initial: Record<string, unknown> = {}) {
  const map = new Map<string, unknown>(Object.entries(initial));
  return {
    kv: {
      read: (key: string) => map.get(key),
      write: (key: string, value: unknown) => void map.set(key, value),
    },
    map,
  };
}

let counter = 0;
const platform = (storage = fakeStorage().kv) =>
  createWebPlatform({ storage, newId: () => `id-${++counter}` });

test('веб-платформа объявляет себя веб-платформой', () => {
  assert.equal(platform().kind, 'web');
});

test('игрок создаётся и читается обратно', async () => {
  const p = platform();
  const created = await p.createProfile('Аня');
  assert.equal(created.ok, true);
  const list = await p.listProfiles();
  assert.deepEqual(list.data?.map((x) => x.name), ['Аня']);
});

test('правила те же, что на Windows: пустое имя и дубликат отклоняются', () => {
  // Проверяем не реализацию, а то, что обе платформы берут правила из shared
  return (async () => {
    const p = platform();
    await p.createProfile('Аня');
    const empty = await p.createProfile('   ');
    assert.equal(empty.ok, false);
    const dup = await p.createProfile('аня');
    assert.equal(dup.ok, false);
    assert.match(dup.error ?? '', /уже есть в списке/);
  })();
});

test('удаление игрока уносит его достижения, как и на Windows', async () => {
  const p = platform();
  const anya = await p.createProfile('Аня');
  const borya = await p.createProfile('Боря');
  await p.saveScore(anya.data!.id, 'digits', 'gold');
  await p.saveScore(borya.data!.id, 'digits', 'silver');

  await p.deleteProfile(anya.data!.id);

  const scores = await p.getScores();
  assert.equal(scores.data?.[anya.data!.id], undefined);
  assert.equal(scores.data?.[borya.data!.id].digits, 'silver');
});

test('понизить ступень нельзя и в вебе', async () => {
  const p = platform();
  await p.saveScore('p1', 'digits', 'gold');
  const down = await p.saveScore('p1', 'digits', 'wooden');
  assert.equal(down.data?.changed, false);
  assert.equal(down.data?.tier, 'gold');
});

test('настройки: без записи отдаются дефолты, после записи — сохранённые', async () => {
  const p = platform();
  const first = await p.getSettings();
  assert.equal(first.data?.volume, 70);
  await p.saveSettings({ ...first.data!, volume: 25, device: 'tablet' });
  const second = await p.getSettings();
  assert.equal(second.data?.volume, 25);
});

test('повреждённые данные в хранилище — понятная ошибка, а не молчаливое «пусто»', async () => {
  const p = createWebPlatform({
    storage: {
      read: () => {
        throw new Error('Данные занятия в этом браузере повреждены');
      },
      write: () => {},
    },
  });
  const list = await p.listProfiles();
  assert.equal(list.ok, false);
  assert.match(list.error ?? '', /повреждены/);
});

test('библиотека грузится относительным путём и проходит валидацию', async () => {
  const library = {
    schemaVersion: 1,
    audioScheme: { voices: [], phrasesPerVoice: 0, neutral: false },
    themes: [{ id: 'digits', title: 'Цифры', wordIds: ['0000'] }],
    words: [{ id: '0000', name: 'Один', themeId: 'digits', level: 0 }],
  };
  const asked: string[] = [];
  const p = createWebPlatform({
    storage: fakeStorage().kv,
    fetchJson: async (url) => {
      asked.push(url);
      return library;
    },
  });
  const res = await p.getLibrary();
  assert.equal(res.ok, true);
  assert.equal(res.data?.words.length, 1);
  assert.deepEqual(asked, ['words-library/index.json']);
});

test('битая библиотека отклоняется валидацией, а не роняет приложение', async () => {
  const p = createWebPlatform({
    storage: fakeStorage().kv,
    fetchJson: async () => ({ schemaVersion: 99 }),
  });
  const res = await p.getLibrary();
  assert.equal(res.ok, false);
  assert.ok((res.error ?? '').length > 0);
});

test('корень пакета контента настраивается — сборка может класть его иначе', () => {
  const p = createWebPlatform({ storage: fakeStorage().kv, libraryRoot: 'assets/words' });
  assert.equal(p.assetUrl('img/words/0000.svg'), 'assets/words/assets/img/words/0000.svg');
});
