// packages/player/src/periodictable/quizEngine.ts
// Генерация вопросов викторины — чистые функции, не завязаны на React,
// принимают генератор случайности как параметр (по умолчанию Math.random),
// чтобы тесты могли подставить детерминированную последовательность и
// проверить реальную логику выбора вопроса/дистракторов, а не просто
// "что-то вернулось".

import type { PeriodicElement } from './model/schema.ts';

// Только поля с гарантированно УНИКАЛЬНЫМ значением на элемент (символ,
// русское название, номер — все по определению не повторяются в наборе
// из 118) — иначе два разных элемента могли бы дать одинаковый вариант
// ответа, и у вопроса оказалось бы больше одного "правильного" варианта.
export type QuizField = 'symbol' | 'nameRu' | 'atomicNumber';

const QUIZ_FIELDS: QuizField[] = ['symbol', 'nameRu', 'atomicNumber'];

export const QUIZ_FIELD_LABEL_RU: Record<QuizField, string> = {
  symbol: 'символ',
  nameRu: 'название',
  atomicNumber: 'номер',
};

function fieldValue(el: PeriodicElement, field: QuizField): string | number {
  return el[field];
}

export interface QuizQuestion {
  promptField: QuizField;
  promptValue: string | number;
  answerField: QuizField;
  correctAnswer: string | number;
  options: (string | number)[];
  correctAtomicNumber: number;
}

function pickRandom<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

// Тасование Фишера-Йейтса с внешним rng — детерминируемо в тестах.
function shuffle<T>(arr: T[], rng: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Требует минимум 4 элемента (1 правильный + 3 дистрактора) — с 118
 *  реальными элементами это всегда выполняется, но явная проверка не даёт
 *  функции тихо вернуть вопрос с повторяющимися/отсутствующими опциями. */
export function generateQuestion(elements: PeriodicElement[], rng: () => number = Math.random): QuizQuestion {
  if (elements.length < 4) {
    throw new Error('generateQuestion needs at least 4 elements to build distractors');
  }

  const correctElement = pickRandom(elements, rng);
  const promptField = pickRandom(QUIZ_FIELDS, rng);
  const answerField = pickRandom(
    QUIZ_FIELDS.filter((f) => f !== promptField),
    rng
  );

  const others = elements.filter((el) => el.atomicNumber !== correctElement.atomicNumber);
  const distractorElements: PeriodicElement[] = [];
  const pool = [...others];
  while (distractorElements.length < 3 && pool.length > 0) {
    const idx = Math.floor(rng() * pool.length);
    distractorElements.push(pool[idx]);
    pool.splice(idx, 1);
  }

  const correctAnswer = fieldValue(correctElement, answerField);
  const options = shuffle([correctAnswer, ...distractorElements.map((el) => fieldValue(el, answerField))], rng);

  return {
    promptField,
    promptValue: fieldValue(correctElement, promptField),
    answerField,
    correctAnswer,
    options,
    correctAtomicNumber: correctElement.atomicNumber,
  };
}

export function checkAnswer(question: QuizQuestion, chosen: string | number): boolean {
  return chosen === question.correctAnswer;
}
