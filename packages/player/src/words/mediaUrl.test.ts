import { test } from 'node:test';
import assert from 'node:assert/strict';
import { libraryAssetUrl, wordImageUrl, themeCoverUrl } from './mediaUrl.ts';
import { setWordsPlatform } from './platform/WordsPlatform.ts';
import { createElectronPlatform } from './platform/electronPlatform.ts';
import { createWebPlatform } from './platform/webPlatform.ts';
import type { WordsApi } from './types.ts';

/** Мост Electron в тестах не нужен: проверяется только адресация файлов */
const stubApi = {} as WordsApi;

function useElectron() {
  setWordsPlatform(createElectronPlatform(stubApi));
}

function useWeb() {
  setWordsPlatform(
    createWebPlatform({ storage: { read: () => undefined, write: () => {} } })
  );
}

// ── Windows (Electron) ──────────────────────────────────────────────────

test('Electron: хост в URL непустой — иначе путь утаскивается в host', () => {
  // Регрессия на чужую ошибку из src/natcom/mediaUrl.ts: у standard-схемы с
  // пустым host WHATWG-парсер кладёт начало пути в host, и main.js получает
  // пустое имя файла. Проверяем именно разбор настоящим URL-парсером.
  useElectron();
  const url = new URL(wordImageUrl('0000'));
  assert.equal(url.protocol, 'wordslib:');
  assert.equal(url.host, 'asset');
  assert.notEqual(url.pathname, '/');
});

test('Electron: путь восстанавливается ровно так, как его читает main.js', () => {
  useElectron();
  const original = 'img/words/0000.svg';
  const url = new URL(libraryAssetUrl(original));
  // main.js: decodeURIComponent(pathname.replace(/^\/+/, ''))
  assert.equal(decodeURIComponent(url.pathname.replace(/^\/+/, '')), original);
});

test('Electron: вложенные пути со слэшами переживают кодирование', () => {
  useElectron();
  const original = 'media/words/0000/girl/1.mp3';
  const url = new URL(libraryAssetUrl(original));
  assert.equal(decodeURIComponent(url.pathname.replace(/^\/+/, '')), original);
});

test('Electron: иллюстрация и обложка адресуются по идентификатору', () => {
  useElectron();
  assert.equal(wordImageUrl('0204'), 'wordslib://asset/img%2Fwords%2F0204.svg');
  assert.equal(themeCoverUrl('transport'), 'wordslib://asset/img%2Fthemes%2Ftransport.svg');
});

// ── Android / веб ───────────────────────────────────────────────────────

test('веб: тот же ресурс адресуется обычным относительным путём', () => {
  // Android-сборка будет WebView поверх этой же веб-сборки: пакет контента
  // лежит рядом с index.html, никакого своего протокола там нет
  useWeb();
  assert.equal(wordImageUrl('0204'), 'words-library/assets/img/words/0204.svg');
  assert.equal(themeCoverUrl('transport'), 'words-library/assets/img/themes/transport.svg');
});

test('один и тот же вызов даёт разные URL на разных платформах', () => {
  // Экраны вызывают одну функцию и о платформе не знают — в этом и смысл
  useElectron();
  const onWindows = wordImageUrl('0000');
  useWeb();
  const onAndroid = wordImageUrl('0000');
  assert.notEqual(onWindows, onAndroid);
  assert.ok(onWindows.startsWith('wordslib://'));
  assert.ok(onAndroid.startsWith('words-library/'));
});

test('до инициализации платформы отрисовка не падает', () => {
  setWordsPlatform(null as never);
  assert.equal(wordImageUrl('0000'), 'words-library/assets/img/words/0000.svg');
});
