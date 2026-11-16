// Тесты разбивки «стены текста» на короткие абзацы (AAA).
import test from 'node:test';
import assert from 'node:assert/strict';
import { splitParagraphs } from './theoryText.ts';

test('splitParagraphs: короткие абзацы проходят как есть', () => {
  // Arrange
  const text = 'Первый абзац.\n\nВторой абзац из двух предложений. Всё влезает.';
  // Act
  const parts = splitParagraphs(text, 480);
  // Assert
  assert.deepEqual(parts, ['Первый абзац.', 'Второй абзац из двух предложений. Всё влезает.']);
});

test('splitParagraphs: длинный абзац режется по границе предложения, текст сохраняется', () => {
  // Arrange
  const s1 = 'Предложение номер один достаточно длинное само по себе и занимает много места в абзаце целиком.';
  const s2 = 'Предложение номер два короче.';
  const s3 = 'Предложение номер три завершает абзац с существенным объёмом текста.';
  const text = [s1, s2, s3].join(' ');
  // Act
  const parts = splitParagraphs(text, 120);
  // Assert
  assert.ok(parts.length >= 2, 'разрезан: ' + parts.length);
  assert.equal(parts.join(' ').replace(/\s+/g, ' ').trim(), text.replace(/\s+/g, ' ').trim(), 'текст не изменился');
});

test('splitParagraphs: каждый кусок не сильно превышает лимит (одиночное длинное предложение не режется посреди)', () => {
  // Arrange
  const text = 'Одно очень длинное предложение без точек '.repeat(30) + 'конец.';
  // Act
  const parts = splitParagraphs(text, 100);
  // Assert
  assert.equal(parts.length, 1, 'неразрезанное предложение остаётся целым');
});

test('splitParagraphs: многоточие и вопросительный знак тоже границы', () => {
  // Arrange
  const text = 'Что такое ФГОС? Это стандарт… Он обязателен. ' + 'А здесь длинное продолжение текста которое потребует разреза при достаточно большом объёме добавленных символов.';
  // Act
  const parts = splitParagraphs(text, 40);
  // Assert
  assert.ok(parts.length >= 2, 'разрезан');
  assert.equal(parts[0], 'Что такое ФГОС? Это стандарт…');
});
