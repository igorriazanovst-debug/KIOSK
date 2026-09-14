// packages/shared/src/inophone/model/resources.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  sceneImagePath,
  conceptImagePath,
  conceptAudioPath,
  checkCompleteness,
  checkQuotas,
  QUOTA_WORDS,
  QUOTA_SCENES,
  QUOTA_THEMES,
} from './resources';
import { parseInophoneLibrary } from './schema';
import { LANGUAGE_CODES } from './languages';

const titles = (t: string) => Object.fromEntries(LANGUAGE_CODES.map((c) => [c, `${t}-${c}`]));
/** voiced — список языков, на которых озвучка ЗАЯВЛЕНА */
const langs = (w: string, voiced: readonly string[] = []) =>
  Object.fromEntries(
    LANGUAGE_CODES.map((c) => [c, { text: `${w}-${c}`, hasAudio: voiced.includes(c) }])
  );

function lib(voiced: readonly string[] = []) {
  return parseInophoneLibrary({
    schemaVersion: 1,
    concepts: [
      { id: 'bed', hasPicture: true, translations: langs('bed', voiced) },
      { id: 'lamp', hasPicture: false, translations: langs('lamp', voiced) },
    ],
    scenes: [
      {
        id: 'bedroom',
        titles: titles('Спальня'),
        viewBox: { width: 100, height: 100 },
        hotspots: [
          { conceptId: 'bed', points: '1,1 2,1 2,2' },
          { conceptId: 'lamp', points: '5,5 6,5 6,6' },
        ],
      },
    ],
    themes: [{ id: 'flat', titles: titles('Квартира'), sceneIds: ['bedroom'] }],
  });
}

test('пути выводятся из идентификаторов', () => {
  assert.equal(sceneImagePath('bedroom'), 'img/scenes/bedroom.svg');
  assert.equal(conceptImagePath('bed'), 'img/concepts/bed.svg');
  // Язык каталогом, а не суффиксом: добавление языка не трогает ни одного
  // существующего файла
  assert.equal(conceptAudioPath('bed', 'fr'), 'audio/fr/bed.mp3');
});

test('полный пакет проходит проверку', () => {
  const l = lib(['ru', 'en']);
  const present = new Set([
    sceneImagePath('bedroom'),
    conceptImagePath('bed'),
    conceptAudioPath('bed', 'ru'),
    conceptAudioPath('bed', 'en'),
    conceptAudioPath('lamp', 'ru'),
    conceptAudioPath('lamp', 'en'),
  ]);
  const r = checkCompleteness(l, present);
  assert.equal(r.ok, true);
  assert.equal(r.missingCount, 0);
  assert.equal(r.fullyTranslated, 2, 'написание есть на всех шести у обоих');
  assert.equal(r.fullyVoiced, 0, 'озвучка заявлена лишь на двух языках');
});

test('заявленная, но отсутствующая озвучка — недостающий ФАЙЛ и он назван', () => {
  const l = lib(['ru']);
  const present = new Set([sceneImagePath('bedroom'), conceptImagePath('bed'), conceptAudioPath('bed', 'ru')]);
  const r = checkCompleteness(l, present);
  assert.equal(r.ok, false);
  assert.ok(r.missingFiles.includes('audio/ru/lamp.mp3'), 'файл назван поимённо');
});

test('НЕзаявленная озвучка файлом не считается, но попадает в разрыв по языку', () => {
  // Это разные беды: отсутствующий файл чинит сборщик, незаписанный звук —
  // диктор. Мешать их в одну кучу значит не знать, к кому идти
  const l = lib(['ru']);
  const present = new Set([
    sceneImagePath('bedroom'),
    conceptImagePath('bed'),
    conceptAudioPath('bed', 'ru'),
    conceptAudioPath('lamp', 'ru'),
  ]);
  const r = checkCompleteness(l, present);
  assert.equal(r.ok, true, 'пакет комплектен: всё заявленное на месте');
  assert.equal(r.audioGapByLanguage.ru, 0);
  assert.equal(r.audioGapByLanguage.fr, 2, 'французского нет ни у одного из двух понятий');
  assert.equal(r.audioGapByLanguage.ba, 2);
});

test('лишний файл замечается', () => {
  const l = lib([]);
  const present = new Set([sceneImagePath('bedroom'), conceptImagePath('bed'), 'audio/ru/ghost.mp3']);
  const r = checkCompleteness(l, present);
  assert.equal(r.ok, false);
  assert.deepEqual(r.extraFiles, ['audio/ru/ghost.mp3']);
});

test('картинка понятия ожидается только если заявлена', () => {
  const l = lib([]);
  const present = new Set([sceneImagePath('bedroom'), conceptImagePath('bed')]);
  const r = checkCompleteness(l, present);
  assert.equal(r.ok, true, 'у lamp hasPicture=false — файла и не ждём');
});

test('квоты ТЗ считаются и показывают ЗАПАС, а не только «выполнено»', () => {
  const q = checkQuotas(lib([]));
  assert.equal(q.words.need, QUOTA_WORDS);
  assert.equal(q.scenes.need, QUOTA_SCENES);
  assert.equal(q.themes.need, QUOTA_THEMES);
  assert.equal(q.ok, false, 'в тестовом пакете два слова при требуемых 350');
  // Запас отрицательный — видно, насколько не хватает
  assert.equal(q.words.spare, 2 - QUOTA_WORDS);
});

test('слово без написания хотя бы на одном языке в квоту не идёт', () => {
  // ТЗ строка 95 требует написание на ВСЕХ языках, а не просто наличие записи
  const l = lib([]);
  const broken = { ...l, concepts: [{ ...l.concepts[0], translations: { ...l.concepts[0].translations, ba: { text: '', hasAudio: false } } }, l.concepts[1]] };
  const q = checkQuotas(broken as typeof l);
  assert.equal(q.words.have, 1, 'засчитано только второе понятие');
});
