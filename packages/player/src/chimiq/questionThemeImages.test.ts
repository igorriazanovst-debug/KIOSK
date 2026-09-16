// packages/player/src/chimiq/questionThemeImages.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { questionThemeImageUrl, CHIMIQ_QUESTION_THEMES } from './questionThemeImages.ts';
import realContentJson from './content/chimiqRealContent.json' with { type: 'json' };

// Закрытие FR-008/015 (ТЗ) по решению пользователя 2026-09-16: НЕ
// персональная иллюстрация под каждый ответ (спойлерит "какая посуда
// нужна для приготовления раствора" и т.п. - см. примеры в сессии,
// docs/chimiq-question-illustrations-decision.md), а нейтральная
// картинка по ТЕМЕ вопроса, общая на все вопросы этой темы - тот же
// принцип, что уже есть у уровня (общая картинка-карта), только для
// второго слота (изображение НАД вопросом, не сама игровая карта).

test('every theme actually used in the built-in question bank has a mapped image', () => {
  const usedThemes = new Set(realContentJson.questions.map((q: { theme: string }) => q.theme));
  for (const theme of usedThemes) {
    const url = questionThemeImageUrl(theme);
    assert.notEqual(url, null, `theme "${theme}" has no mapped illustration`);
  }
});

test('CHIMIQ_QUESTION_THEMES lists exactly the 6 themes used in the built-in bank', () => {
  const usedThemes = new Set(realContentJson.questions.map((q: { theme: string }) => q.theme));
  assert.deepEqual(new Set(CHIMIQ_QUESTION_THEMES), usedThemes);
});

test('questionThemeImageUrl returns a relative public/ path (same convention as levelImageUrl), not chimiqmedia://', () => {
  const url = questionThemeImageUrl('Строение атома');
  assert.ok(url && url.startsWith('./chimiq/questionThemes/'), `unexpected url shape: ${url}`);
  assert.ok(!url!.startsWith('chimiqmedia://'), 'must not use the chimiqmedia:// IPC protocol - that resolves against the per-quiz uploads folder, not bundled public/ assets used by the built-in quiz');
});

test('questionThemeImageUrl returns null for an unknown theme instead of guessing', () => {
  assert.equal(questionThemeImageUrl('Совершенно незнакомая тема'), null);
});
