import { test } from 'node:test';
import assert from 'node:assert/strict';
import vectors from './vectors.json';

import {
  wordImagePath,
  themeCoverPath,
  themeIntroAudioPath,
  themeFinalAudioPath,
  wordAudioPaths,
  audioFilesPerWord,
  schemeHasAudio,
} from '../model/resources';
import { parseWordsLibrary, WordsValidationError } from '../model/schema';
import { awardFor, upgradeAward, accuracy, WORDS_AWARD_THRESHOLDS } from '../game/achievements';
import { applyCreateProfile, applySaveScore } from '../store/rules';
import type { AwardTier, Profile } from '../model/schema';
import type { PlayerTally } from '../game/session';

// Сверочные векторы — общий контракт между этой реализацией и нативной
// Android-реализацией (Android делается отдельно, не поверх этого кода).
// Здесь проверяется, что ЭТА реализация им соответствует; та же таблица
// прогоняется на стороне Android. Расхождение обязано быть падением теста,
// а не тихой разницей в поведении на уроке.

const v = vectors as any;

test('векторы: пути иллюстраций слов', () => {
  for (const c of v.resources.wordImage) {
    assert.equal(wordImagePath(c.wordId), c.path, `слово ${c.wordId}`);
  }
});

test('векторы: пути обложек и реплик тем', () => {
  for (const c of v.resources.themeCover) assert.equal(themeCoverPath(c.themeId), c.path);
  for (const c of v.resources.themeIntro) {
    assert.equal(themeIntroAudioPath(c.themeId, c.voice), c.path);
  }
  for (const c of v.resources.themeFinal) assert.equal(themeFinalAudioPath(c.themeId), c.path);
});

test('векторы: схемы озвучки — сколько файлов на слово и какие', () => {
  for (const c of v.resources.audioBySchema) {
    assert.equal(schemeHasAudio(c.definition), c.hasAudio, `схема ${c.scheme}`);
    assert.equal(audioFilesPerWord(c.definition), c.filesPerWord, `схема ${c.scheme}`);
    assert.deepEqual(wordAudioPaths('0000', c.definition), c.pathsFor0000, `схема ${c.scheme}`);
  }
});

test('векторы: пороги достижений не изменились', () => {
  assert.deepEqual(
    WORDS_AWARD_THRESHOLDS.map((t) => ({ tier: t.tier, minAccuracy: t.minAccuracy })),
    v.awards.thresholds
  );
});

test('векторы: ступень по счёту игрока', () => {
  for (const c of v.awards.byTally) {
    assert.equal(accuracy(c.tally as PlayerTally), c.accuracy, JSON.stringify(c.tally));
    assert.equal(awardFor(c.tally as PlayerTally), c.tier, JSON.stringify(c.tally));
  }
});

test('векторы: монотонность обновления — все 16 переходов', () => {
  for (const c of v.awards.monotonicUpgrade) {
    assert.equal(
      upgradeAward(c.current as AwardTier | null, c.earned as AwardTier | null),
      c.result,
      `${c.current} → ${c.earned}`
    );
  }
});

test('векторы: правила имени игрока, включая текст отказа', () => {
  // Текст важен: он показывается педагогу у доски, и на двух платформах
  // сообщение об одной и той же ошибке должно быть одним и тем же
  const existingAnya: Profile[] = [{ id: 'a', name: 'Аня', createdAt: 'FIXED-TIME' }];
  for (const c of v.rules.profileName) {
    const existing = c.error?.includes('уже есть') || c.name.toLowerCase() === 'аня' && !c.accepted
      ? existingAnya
      : [];
    try {
      const { created } = applyCreateProfile(existing, c.name, 'FIXED-ID', 'FIXED-TIME');
      assert.equal(c.accepted, true, `имя ${JSON.stringify(c.name)} должно было быть отклонено`);
      assert.equal(created.name, c.storedName);
    } catch (err) {
      assert.equal(c.accepted, false, `имя ${JSON.stringify(c.name)} должно было быть принято`);
      assert.equal((err as Error).message, c.error);
    }
  }
});

test('векторы: запись достижения с монотонностью', () => {
  for (const c of v.rules.saveScore) {
    const r = applySaveScore(c.from, c.profileId, c.themeId, c.tier as AwardTier);
    assert.equal(r.changed, c.changed, JSON.stringify(c));
    assert.equal(r.tier, c.resultingTier, JSON.stringify(c));
  }
});

test('векторы: что пакет контента обязан отвергать', () => {
  const valid = {
    schemaVersion: 1,
    audioScheme: { voices: [], phrasesPerVoice: 0, neutral: false },
    themes: [{ id: 'digits', title: 'Цифры', wordIds: ['0000'] }],
    words: [{ id: '0000', name: 'Один', themeId: 'digits', level: 0 }],
  };
  const byLabel: Record<string, unknown> = {
    'корректный пакет': valid,
    'нет версии схемы': { ...valid, schemaVersion: undefined },
    'чужая версия схемы': { ...valid, schemaVersion: 2 },
    'идентификатор слова не из четырёх цифр': {
      ...valid,
      themes: [{ id: 'digits', title: 'Цифры', wordIds: ['1'] }],
      words: [{ id: '1', name: 'Один', themeId: 'digits', level: 0 }],
    },
    'дублирующиеся названия тем': {
      ...valid,
      themes: [
        { id: 'pets', title: 'Домашние животные', wordIds: ['0000'] },
        { id: 'pets2', title: 'Домашние животные', wordIds: ['0001'] },
      ],
      words: [
        { id: '0000', name: 'Кошка', themeId: 'pets', level: 0 },
        { id: '0001', name: 'Собака', themeId: 'pets2', level: 0 },
      ],
    },
    'тема ссылается на несуществующее слово': {
      ...valid,
      themes: [{ id: 'digits', title: 'Цифры', wordIds: ['0000', '9999'] }],
    },
    'слово не перечислено в своей теме': {
      ...valid,
      themes: [{ id: 'digits', title: 'Цифры', wordIds: [] }],
    },
  };

  for (const c of v.libraryValidation) {
    const input = byLabel[c.label];
    assert.notEqual(input, undefined, `в тесте нет случая «${c.label}»`);
    if (c.accepted) {
      assert.doesNotThrow(() => parseWordsLibrary(input), `«${c.label}» должен приниматься`);
    } else {
      assert.throws(
        () => parseWordsLibrary(input),
        WordsValidationError,
        `«${c.label}» должен отвергаться`
      );
    }
  }
});
