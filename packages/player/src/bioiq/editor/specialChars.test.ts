// packages/player/src/bioiq/editor/specialChars.test.ts
// FR-015 ТЗ 10 (строка 309). Проверяется не механика вставки (она общая с
// РусIQ и покрыта там), а СОСТАВ набора: копия от «ХимIQ» приехала с
// химическим набором, и подмена его биологическим — содержательная правка,
// которую легко откатить обратным копированием, не заметив.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { BIOIQ_SPECIAL_CHARS } from './specialChars.ts';

test('в наборе есть знаки пола — наследование, сцепленное с полом', () => {
  assert.ok(BIOIQ_SPECIAL_CHARS.includes('♀'));
  assert.ok(BIOIQ_SPECIAL_CHARS.includes('♂'));
});

test('есть знак скрещивания', () => {
  assert.ok(BIOIQ_SPECIAL_CHARS.includes('×'));
});

test('есть микро — размеры клеток измеряются в мкм', () => {
  assert.ok(BIOIQ_SPECIAL_CHARS.includes('μ'));
});

test('индексы и заряды СОХРАНЕНЫ, а не выброшены вместе с химией', () => {
  // Формулу фотосинтеза 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂ без индексов не набрать,
  // а это школьная биология, а не химия.
  for (const ch of ['₂', '₆', '₁']) {
    assert.ok(BIOIQ_SPECIAL_CHARS.includes(ch), `нет подстрочного ${ch}`);
  }
  for (const ch of ['⁺', '⁻', '²']) {
    assert.ok(BIOIQ_SPECIAL_CHARS.includes(ch), `нет знака заряда ${ch}`);
  }
  assert.ok(BIOIQ_SPECIAL_CHARS.includes('→'), 'нет стрелки — нужна и реакции, и цепи питания');
});

test('дубликатов в наборе нет', () => {
  // Две одинаковые кнопки подряд выглядят как ошибка вёрстки, и найти их
  // глазами среди сорока символов трудно.
  assert.equal(new Set(BIOIQ_SPECIAL_CHARS).size, BIOIQ_SPECIAL_CHARS.length);
});

test('полный греческий алфавит в набор не попал', () => {
  // Осознанное ограничение: нужны α и β, остальные превратили бы панель в
  // двадцать четыре кнопки, среди которых нужные две пришлось бы искать.
  assert.ok(BIOIQ_SPECIAL_CHARS.includes('α'));
  assert.ok(BIOIQ_SPECIAL_CHARS.includes('β'));
  for (const ch of ['γ', 'δ', 'ω', 'σ']) {
    assert.ok(!BIOIQ_SPECIAL_CHARS.includes(ch), `в наборе лишняя греческая буква ${ch}`);
  }
});
