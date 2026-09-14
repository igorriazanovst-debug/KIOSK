// packages/shared/src/inophone/model/statistics.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseInophoneSettings,
  parseInophoneStatistics,
  mergeStatistics,
  successShare,
  DEFAULT_INOPHONE_SETTINGS,
  INOPHONE_SETTINGS_VERSION,
} from './statistics';
import { MAX_STUDY_LANGUAGES } from './languages';

test('битые настройки дают значения по умолчанию, а не ошибку', () => {
  // Строгость обратная профилям: потерянные настройки педагог выставит
  // заново, а неоткрывающееся приложение срывает занятие
  assert.deepEqual(parseInophoneSettings(null), DEFAULT_INOPHONE_SETTINGS);
  assert.deepEqual(parseInophoneSettings('мусор'), DEFAULT_INOPHONE_SETTINGS);
  assert.deepEqual(parseInophoneSettings({ schemaVersion: 99 }), DEFAULT_INOPHONE_SETTINGS);
});

test('правильные настройки проходят как есть', () => {
  const s = {
    schemaVersion: INOPHONE_SETTINGS_VERSION,
    interfaceLanguage: 'ru' as const,
    studyLanguages: ['en', 'de'] as const,
    volume: 40,
  };
  assert.deepEqual(parseInophoneSettings(s), s);
});

test('изучаемый язык, совпавший с родным, убирается', () => {
  // Занятие стало бы бессмысленным: карточка показала бы одно и то же дважды.
  // А возникает это легко — сменил язык интерфейса и не заметил
  const out = parseInophoneSettings({
    schemaVersion: INOPHONE_SETTINGS_VERSION,
    interfaceLanguage: 'en',
    studyLanguages: ['en', 'fr'],
    volume: 70,
  });
  assert.deepEqual(out.studyLanguages, ['fr']);
});

test('если все изучаемые совпали с родным, подставляется другой язык', () => {
  // Пустой список не дал бы открыть ни одну сцену
  const out = parseInophoneSettings({
    schemaVersion: INOPHONE_SETTINGS_VERSION,
    interfaceLanguage: 'de',
    studyLanguages: ['de'],
    volume: 70,
  });
  assert.equal(out.studyLanguages.length, 1);
  assert.notEqual(out.studyLanguages[0], 'de');
});

test('изучаемых языков не больше трёх', () => {
  const out = parseInophoneSettings({
    schemaVersion: INOPHONE_SETTINGS_VERSION,
    interfaceLanguage: 'ru',
    studyLanguages: ['en', 'fr', 'de', 'zh'],
    volume: 70,
  });
  assert.deepEqual(out, DEFAULT_INOPHONE_SETTINGS, 'сверх предела — настройки битые');
  assert.equal(MAX_STUDY_LANGUAGES, 3);
});

test('битая запись статистики отбрасывается поштучно, целые выживают', () => {
  const raw = {
    good: { byScene: { s1: { lastSession: [1, 2], total: [3, 4] } }, byLanguage: {} },
    broken: { byScene: 'не объект' },
  };
  const out = parseInophoneStatistics(raw);
  assert.ok(out.good, 'целая запись выжила');
  assert.ok(!('broken' in out), 'битая отброшена');
});

test('мусор вместо объекта даёт пустую статистику, а не падение', () => {
  assert.deepEqual(parseInophoneStatistics('мусор'), {});
  assert.deepEqual(parseInophoneStatistics([1, 2]), {});
});

test('последняя партия замещается, итог накапливается', () => {
  let stats = mergeStatistics({}, 'p1', 'bedroom', { en: [3, 5] });
  assert.deepEqual(stats.p1.byScene.bedroom.lastSession, [3, 5]);
  assert.deepEqual(stats.p1.byScene.bedroom.total, [3, 5]);

  stats = mergeStatistics(stats, 'p1', 'bedroom', { en: [1, 5] });
  assert.deepEqual(stats.p1.byScene.bedroom.lastSession, [1, 5], 'замещается');
  assert.deepEqual(stats.p1.byScene.bedroom.total, [4, 10], 'накапливается');
});

test('итог сцены — сумма по языкам, второго источника нет', () => {
  const stats = mergeStatistics({}, 'p1', 'city', { en: [2, 3], de: [1, 4] });
  assert.deepEqual(stats.p1.byScene.city.lastSession, [3, 7]);
  assert.deepEqual(stats.p1.byLanguage.en.lastSession, [2, 3]);
  assert.deepEqual(stats.p1.byLanguage.de.lastSession, [1, 4]);
});

test('статистика по языкам копится между сценами', () => {
  // Смысл пособия — языки: педагог должен видеть, что по-английски ребёнок
  // уверен, а по-немецки путается. Сводка только по сценам этого не покажет
  let stats = mergeStatistics({}, 'p1', 'bedroom', { en: [3, 3] });
  stats = mergeStatistics(stats, 'p1', 'city', { en: [1, 3] });
  assert.deepEqual(stats.p1.byLanguage.en.total, [4, 6]);
  assert.equal(Object.keys(stats.p1.byScene).length, 2);
});

test('исходная статистика не правится на месте', () => {
  const before = mergeStatistics({}, 'p1', 's', { en: [1, 1] });
  const snapshot = JSON.stringify(before);
  mergeStatistics(before, 'p1', 's', { en: [1, 1] });
  assert.equal(JSON.stringify(before), snapshot);
});

test('доля без ответов — null, а не ноль', () => {
  assert.equal(successShare(undefined, 'total'), null);
  assert.equal(successShare({ lastSession: [0, 0], total: [0, 0] }, 'total'), null);
  assert.equal(successShare({ lastSession: [1, 2], total: [1, 4] }, 'total'), 0.25);
});
