import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALPHABET_WIDGET_TYPE,
  ALPHABET_STAGES,
  ALPHABET_STAGE_TITLES,
  ALPHABET_STAGE_HINTS,
  ALPHABET_DEFAULT_PROPS,
  ALPHABET_DEFAULT_SIZE,
  ALPHABET_MAX_PLAYERS,
  ALPHABET_OPTIONS_PER_QUESTION,
  ALPHABET_QUESTION_COUNTS,
  ALPHABET_DEFAULT_QUESTION_COUNT,
} from './widgetProperties';
import { MAX_PLAYERS } from './game/session';
import { SYLLABLE_OPTIONS } from './game/wordCompleting';
import { LETTER_OPTIONS } from './game/letterShow';
import { parseAlphabetSettings, QUESTION_COUNTS, DEFAULT_ALPHABET_SETTINGS } from './model/schema';

test('тип виджета — «alphabet»', () => {
  assert.equal(ALPHABET_WIDGET_TYPE, 'alphabet');
});

test('этапы перечислены в порядке обучения', () => {
  assert.deepEqual([...ALPHABET_STAGES], ['letterShow', 'wordCompleting', 'wordMake']);
});

test('у каждого этапа есть подпись и короткая пометка', () => {
  for (const stage of ALPHABET_STAGES) {
    assert.ok(ALPHABET_STAGE_TITLES[stage], `нет подписи у этапа ${stage}`);
    assert.ok(ALPHABET_STAGE_HINTS[stage], `нет пометки у этапа ${stage}`);
  }
  // У эталона экран выбора этапа подписан М / МА / МАМА
  assert.deepEqual(ALPHABET_STAGES.map((s) => ALPHABET_STAGE_HINTS[s]), ['М', 'МА', 'МАМА']);
});

test('константы виджета — псевдонимы доменных, а не вторые копии', () => {
  // Разъехавшиеся «8 вариантов» в движке и в свойствах виджета отловить
  // потом крайне трудно: партия просто окажется чуть легче задуманного
  assert.equal(ALPHABET_MAX_PLAYERS, MAX_PLAYERS);
  assert.equal(ALPHABET_OPTIONS_PER_QUESTION, SYLLABLE_OPTIONS);
  assert.equal(ALPHABET_OPTIONS_PER_QUESTION, LETTER_OPTIONS);
  assert.deepEqual([...ALPHABET_QUESTION_COUNTS], [...QUESTION_COUNTS]);
  assert.equal(ALPHABET_DEFAULT_QUESTION_COUNT, DEFAULT_ALPHABET_SETTINGS.questionCount);
});

test('дефолтные свойства виджета согласуются с разбором настроек', () => {
  // Свойства виджета и настройки на устройстве — два разных хранилища,
  // но значения по умолчанию должны быть одни
  assert.ok(ALPHABET_QUESTION_COUNTS.includes(ALPHABET_DEFAULT_PROPS.questionCount));
  assert.ok(ALPHABET_STAGES.includes(ALPHABET_DEFAULT_PROPS.defaultStage));
  assert.ok(ALPHABET_DEFAULT_PROPS.defaultPlayerCount >= 1);
  assert.ok(ALPHABET_DEFAULT_PROPS.defaultPlayerCount <= ALPHABET_MAX_PLAYERS);
  assert.doesNotThrow(() =>
    parseAlphabetSettings({
      ...DEFAULT_ALPHABET_SETTINGS,
      volume: ALPHABET_DEFAULT_PROPS.volume,
      questionCount: ALPHABET_DEFAULT_PROPS.questionCount,
    })
  );
});

test('размер заглушки задан', () => {
  assert.equal(ALPHABET_DEFAULT_SIZE.width, 1280);
  assert.equal(ALPHABET_DEFAULT_SIZE.height, 800);
});
