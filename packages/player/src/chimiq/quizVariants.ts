// packages/player/src/chimiq/quizVariants.ts
//
// Альтернативные раскладки встроенной викторины «Химия» (предложение
// пользователя 2026-09-16, продолжение списка доработок): жалоба «пул
// ответов никак не меняется» была закрыта раньше на уровне "какой тайл
// верный", но НАБОР видимых тайлов на картинке уровня оставался
// буквально одним и тем же изображением при каждой партии — у игрока,
// который приходит снова и снова, со временем появляется "память места"
// (помнит, где на картинке лежит верный ответ, а не решает вопрос).
//
// Три варианта — тот же текст всех 168 вопросов (не переписан заново,
// см. тест quizVariants.test.ts на идентичность content-fingerprint),
// та же геометрия сетки (размер тайла/картинки, число колонок и строк) —
// перемешано только то, КАКОЙ тайл попадает в КАКУЮ клетку сетки.
// Сгенерированы скриптом (Python/Pillow), см. план реализации §15.
import { ChimiqQuizSchema, type ChimiqQuiz } from './model/schema.ts';
import realContentJson from './content/chimiqRealContent.json' with { type: 'json' };
import realContentV2Json from './content/chimiqRealContent.v2.json' with { type: 'json' };
import realContentV3Json from './content/chimiqRealContent.v3.json' with { type: 'json' };

export const BUILTIN_QUIZ_VARIANTS: ChimiqQuiz[] = [realContentJson, realContentV2Json, realContentV3Json].map((json) =>
  ChimiqQuizSchema.parse(json),
);

/**
 * Выбирает случайный элемент массива. Принимает rng как параметр (по
 * умолчанию Math.random) - тот же приём, что уже применяется в
 * gameLogic.ts::assignQuestions, для детерминированности в тестах.
 */
export function pickRandomVariant<T>(variants: T[], rng: () => number = Math.random): T {
  if (variants.length === 0) throw new Error('pickRandomVariant: variants array is empty');
  const index = Math.min(Math.floor(rng() * variants.length), variants.length - 1);
  return variants[index];
}
