// packages/player/src/physastroiq/model/completeness.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PhysastroiqQuizSchema, PHYSASTROIQ_QUIZ_SCHEMA_VERSION } from './schema.ts';
import {
  checkPhysastroiqQuiz,
  rectsOverlap,
  PHYSASTROIQ_MIN_GENERIC_DECOYS_PER_LEVEL,
} from './completeness.ts';
import realContent from '../content/physastroiqRealContent.json' with { type: 'json' };

function decoys(level: 1 | 2 | 3, count: number, startX = 0) {
  return Array.from({ length: count }, (_, i) => ({
    x: startX + i * 120,
    y: 900,
    width: 100,
    height: 100,
    level,
  }));
}

function question(level: 1 | 2 | 3, id: string, text: string, x: number, y: number) {
  return {
    id,
    text,
    answer: 'ответ',
    helpText: '',
    x,
    y,
    width: 100,
    height: 100,
    decoyPoints: [],
    price: 10,
    timeSeconds: 30,
    level,
    theme: 'Тема',
    questionImage: null,
    answerImage: null,
    hintImage: null,
  };
}

function quizWith(overrides: Record<string, unknown> = {}) {
  const base = {
    schemaVersion: PHYSASTROIQ_QUIZ_SCHEMA_VERSION,
    id: 'q1',
    title: 'Проверочная',
    intro: '',
    themes: ['Тема'],
    passwordHash: null,
    images: {
      '1': { fileName: 'a.png', width: 2000, height: 1400 },
      '2': { fileName: 'b.png', width: 2000, height: 1400 },
      '3': { fileName: 'c.png', width: 2000, height: 1400 },
    },
    levels: [
      { id: 1, label: 'Начинающий' },
      { id: 2, label: 'Опытный' },
      { id: 3, label: 'Профессионал' },
    ],
    questions: [
      question(1, 'q-1', 'Вопрос первого уровня', 0, 0),
      question(2, 'q-2', 'Вопрос второго уровня', 0, 0),
      question(3, 'q-3', 'Вопрос третьего уровня', 0, 0),
    ],
    genericDecoyPoints: [
      ...decoys(1, PHYSASTROIQ_MIN_GENERIC_DECOYS_PER_LEVEL),
      ...decoys(2, PHYSASTROIQ_MIN_GENERIC_DECOYS_PER_LEVEL),
      ...decoys(3, PHYSASTROIQ_MIN_GENERIC_DECOYS_PER_LEVEL),
    ],
    ...overrides,
  };
  return PhysastroiqQuizSchema.parse(base);
}

test('полная викторина замечаний не вызывает', () => {
  assert.deepEqual(checkPhysastroiqQuiz(quizWith()), []);
});

test('FR-013: девять точек без привязки на уровне — замечание с точным числом', () => {
  const quiz = quizWith({
    genericDecoyPoints: [
      ...decoys(1, PHYSASTROIQ_MIN_GENERIC_DECOYS_PER_LEVEL - 1),
      ...decoys(2, PHYSASTROIQ_MIN_GENERIC_DECOYS_PER_LEVEL),
      ...decoys(3, PHYSASTROIQ_MIN_GENERIC_DECOYS_PER_LEVEL),
    ],
  });
  const found = checkPhysastroiqQuiz(quiz).filter((p) => p.requirement === 'FR-013');
  assert.equal(found.length, 1);
  assert.match(found[0].message, /уровень 1/);
  assert.match(found[0].message, /9/);
  assert.match(found[0].message, /10/);
});

test('FR-013: ровно десять точек — замечания нет, граница включительная', () => {
  const found = checkPhysastroiqQuiz(quizWith()).filter((p) => p.requirement === 'FR-013');
  assert.deepEqual(found, []);
});

test('FR-008: один и тот же вопрос на двух уровнях замечен', () => {
  const quiz = quizWith({
    questions: [
      question(1, 'q-1', 'Где расположено сердце', 0, 0),
      question(2, 'q-2', 'Где расположено сердце', 0, 0),
      question(3, 'q-3', 'Вопрос третьего уровня', 0, 0),
    ],
  });
  const found = checkPhysastroiqQuiz(quiz).filter((p) => p.requirement === 'FR-008');
  assert.equal(found.length, 1);
  assert.match(found[0].message, /уровне 1.*уровне 2/);
});

test('FR-008: повтор вопроса ВНУТРИ одного уровня замечанием не считается', () => {
  // Два одинаковых текста на одном уровне — это дубликат в работе автора, а не
  // нарушение «уникального набора уровней»: ТЗ говорит про наборы уровней.
  const quiz = quizWith({
    questions: [
      question(1, 'q-1', 'Один и тот же текст', 0, 0),
      question(1, 'q-1b', 'Один и тот же текст', 400, 0),
      question(2, 'q-2', 'Вопрос второго уровня', 0, 0),
      question(3, 'q-3', 'Вопрос третьего уровня', 0, 0),
    ],
  });
  assert.deepEqual(checkPhysastroiqQuiz(quiz).filter((p) => p.requirement === 'FR-008'), []);
});

test('налезающие друг на друга области названы поимённо', () => {
  const quiz = quizWith({
    questions: [
      question(1, 'q-1', 'Сердце', 100, 100),
      question(1, 'q-1b', 'Лёгкое', 150, 150),
      question(2, 'q-2', 'Вопрос второго уровня', 0, 0),
      question(3, 'q-3', 'Вопрос третьего уровня', 0, 0),
    ],
  });
  const found = checkPhysastroiqQuiz(quiz).filter((p) => p.message.includes('налезают'));
  assert.equal(found.length, 1);
  assert.match(found[0].message, /Сердце/);
  assert.match(found[0].message, /Лёгкое/);
});

test('два вопроса про ОДИН И ТОТ ЖЕ орган замечания не вызывают', () => {
  // Про сердце спрашивают по-разному, а область ответа у обоих вопросов одна.
  // Совпадающие координаты buildBoardTiles схлопывает в одну плитку намеренно
  // — опасно частичное наложение, а не полное совпадение.
  const quiz = quizWith({
    questions: [
      question(1, 'q-1', 'Какой орган перекачивает кровь', 100, 100),
      question(1, 'q-1b', 'Какой орган сокращается 70 раз в минуту', 100, 100),
      question(2, 'q-2', 'Вопрос второго уровня', 0, 0),
      question(3, 'q-3', 'Вопрос третьего уровня', 0, 0),
    ],
  });
  assert.deepEqual(checkPhysastroiqQuiz(quiz), []);
});

test('области впритык пересечением не считаются', () => {
  // Правый край одного ровно на левом крае другого — обычная разметка, а не
  // ошибка. Будь проверка нестрогой, ровные ряды областей давали бы
  // замечание на каждой паре соседей.
  assert.equal(
    rectsOverlap({ x: 0, y: 0, width: 100, height: 100 }, { x: 100, y: 0, width: 100, height: 100 }),
    false
  );
  assert.equal(
    rectsOverlap({ x: 0, y: 0, width: 100, height: 100 }, { x: 99, y: 0, width: 100, height: 100 }),
    true
  );
});

test('FR-009: уровень без изображения-карты назван', () => {
  // Схема требует картинку на каждый уровень из quiz.levels; здесь уровень 3
  // убран из levels, поэтому схема молчит, а проверка комплектности — нет.
  const quiz = quizWith({
    levels: [
      { id: 1, label: 'Начинающий' },
      { id: 2, label: 'Опытный' },
    ],
    images: {
      '1': { fileName: 'a.png', width: 2000, height: 1400 },
      '2': { fileName: 'b.png', width: 2000, height: 1400 },
    },
    questions: [
      question(1, 'q-1', 'Вопрос первого уровня', 0, 0),
      question(2, 'q-2', 'Вопрос второго уровня', 0, 0),
    ],
    genericDecoyPoints: [
      ...decoys(1, PHYSASTROIQ_MIN_GENERIC_DECOYS_PER_LEVEL),
      ...decoys(2, PHYSASTROIQ_MIN_GENERIC_DECOYS_PER_LEVEL),
    ],
  });
  const found = checkPhysastroiqQuiz(quiz);
  assert.ok(found.some((p) => p.requirement === 'FR-009' && p.message.includes('уровень 3')));
  assert.ok(found.some((p) => p.requirement === 'FR-008' && p.message.includes('уровень 3')));
});

test('поставляемая методическая викторина проходит проверку комплектности', () => {
  // Главный тест файла: всё остальное здесь проверяет саму проверку, а этот —
  // то, что едет заказчику. Если в поставке меньше десяти точек-обманок на
  // уровне или области налезают друг на друга, узнать об этом надо здесь, а
  // не на приёмке.
  const quiz = PhysastroiqQuizSchema.parse(realContent);
  assert.deepEqual(checkPhysastroiqQuiz(quiz), []);
});
