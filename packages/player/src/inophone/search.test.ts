// packages/player/src/inophone/search.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fold, matches } from './search.ts';

const concept = (translations: Record<string, string>) => ({
  id: 'x',
  hasPicture: false,
  translations: Object.fromEntries(
    Object.entries(translations).map(([k, v]) => [k, { text: v, hasAudio: false }])
  ),
});

test('регистр не решает судьбу поиска', () => {
  assert.equal(fold('КоВёР'), 'ковер');
  assert.ok(matches(concept({ ru: 'Ковёр' }) as never, 'КОВЕР'));
});

test('«ковер» находит «ковёр»', () => {
  // На клавиатуре у доски «ё» набирают единицы, и пустая выдача читается как
  // «такого слова в программе нет»
  assert.ok(matches(concept({ ru: 'ковёр' }) as never, 'ковер'));
});

test('ищем по всем языкам сразу, а не по выбранному', () => {
  const c = concept({ ru: 'кровать', en: 'bed', zh: '床' }) as never;
  assert.ok(matches(c, 'bed'), 'нашли по английскому');
  assert.ok(matches(c, '床'), 'нашли по китайскому');
  assert.ok(matches(c, 'крова'), 'нашли по части русского');
});

test('пустой запрос подходит всем — это не «ничего не найдено»', () => {
  assert.ok(matches(concept({ ru: 'дверь' }) as never, '   '));
});

test('слово, которого нет, не находится', () => {
  assert.ok(!matches(concept({ ru: 'дверь', en: 'door' }) as never, 'зонт'));
});
