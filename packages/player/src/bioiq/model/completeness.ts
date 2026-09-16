// packages/player/src/bioiq/model/completeness.ts
//
// Проверка комплектности викторины: то, что схема проверить не может или не
// имеет права.
//
// ПОЧЕМУ НЕ В СХЕМЕ. Схема решает, можно ли ЗАГРУЗИТЬ файл. Если объявить
// «меньше десяти точек-обманок — невалидный файл», то педагог, начавший
// собирать викторину с нуля (FR-018), не сможет сохранить её после первого
// вопроса: обманок у него пока ноль. Требования ТЗ — про готовую поставляемую
// викторину, а не про каждое промежуточное состояние редактора. Поэтому здесь
// отдельная проверка: методическая викторина в поставке обязана её проходить
// (тест), а педагогу она показывает, чего не хватает, и НЕ запрещает сохранять.
//
// ЧТО ПРОВЕРЯЕТСЯ И ОТКУДА ВЗЯТО:
//
// FR-013 (ТЗ строка 307) — «...не менее 10 координат точек без привязки к ним
//   конкретного вопроса». Граница количественная: на приёмке её проверяют
//   пересчётом, значит она должна стоять в проверке, а не держаться на
//   добросовестности автора викторины.
// FR-008 (строка 302) — «каждый из уровней должен иметь УНИКАЛЬНЫЙ набор
//   вопросов». Один и тот же вопрос на двух уровнях — не «сложнее», а тот же
//   вопрос дважды.
// FR-009 (строка 303) — изображение ко всем вопросам: у каждого уровня должна
//   быть своя карта.
//
// ПЕРЕСЕЧЕНИЕ ОБЛАСТЕЙ — не буквальный пункт ТЗ, а урок Типа 4 («Инофон»),
// перенесённый сюда осознанно. Там на сцене подушка оказалась нарисована
// ВНУТРИ кровати, и клик принадлежал обоим объектам сразу; нашлось это
// глазами на снимке, ничем автоматическим. У Типа 9 такого класса дефекта
// быть не могло: его игровое поле — сетка ровных плиток, области не
// налезают друг на друга по построению. У Типа 10 поле становится
// анатомической схемой, и области ставятся по живым структурам — сердце
// рядом с лёгким, ядро внутри клетки. Две наложенные области дают кнопку
// поверх кнопки: клик достаётся верхней, и «правильный» ответ не
// засчитывается. `buildBoardTiles` схлопывает только ТОЧНЫЕ совпадения
// координат — частичное наложение оно пропускает.

import type { BioiqQuiz, BioiqLevelId } from './schema';

/** ТЗ 10, FR-013 (строка 307): «не менее 10 координат точек без привязки». */
export const BIOIQ_MIN_GENERIC_DECOYS_PER_LEVEL = 10;

export interface BioiqQuizProblem {
  /** Пункт ТЗ, из которого требование — чтобы отчёт читался вместе с матрицей трассировки */
  requirement: string;
  message: string;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Пересекаются ли два прямоугольника. Соприкосновение краями (правый край
 * одного равен левому краю другого) пересечением НЕ считается: области,
 * положенные впритык, — обычный приём разметки, и запрещать его нет причин.
 */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/**
 * ПОЛНОЕ СОВПАДЕНИЕ ОБЛАСТЕЙ — НЕ ДЕФЕКТ, а обычное дело: про один и тот же
 * орган спрашивают по-разному («Какой орган перекачивает кровь?» и «Какой
 * орган сокращается 70 раз в минуту?»), и область ответа у таких вопросов
 * одна и та же.
 *
 * Опасность даёт ЧАСТИЧНОЕ наложение: там на поле оказываются ДВЕ разные
 * кнопки, одна поверх другой, и клик достаётся верхней. Совпадающие же
 * `buildBoardTiles` схлопывает в одну плитку по ключу координат — и делает
 * это намеренно, отдельно позаботившись, чтобы правильный ответ победил
 * в такой коллизии.
 */
function sameRect(a: Rect, b: Rect): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

const LEVELS: BioiqLevelId[] = [1, 2, 3];

export function checkBioiqQuiz(quiz: BioiqQuiz): BioiqQuizProblem[] {
  const problems: BioiqQuizProblem[] = [];

  for (const level of LEVELS) {
    const levelQuestions = quiz.questions.filter((q) => q.level === level);
    const levelDecoys = quiz.genericDecoyPoints.filter((p) => p.level === level);

    if (levelQuestions.length === 0) {
      problems.push({
        requirement: 'FR-008',
        message: `уровень ${level}: нет ни одного вопроса`,
      });
    }

    if (!quiz.images[String(level)]) {
      problems.push({
        requirement: 'FR-009',
        message: `уровень ${level}: нет изображения-карты`,
      });
    }

    if (levelDecoys.length < BIOIQ_MIN_GENERIC_DECOYS_PER_LEVEL) {
      problems.push({
        requirement: 'FR-013',
        message:
          `уровень ${level}: точек без привязки к вопросу ${levelDecoys.length}, ` +
          `требуется не меньше ${BIOIQ_MIN_GENERIC_DECOYS_PER_LEVEL}`,
      });
    }

    // Все области, кликабельные на этом уровне одновременно: плитка каждого
    // вопроса уровня (buildBoardTiles делает их обманками для соседних
    // вопросов), общие обманки уровня и собственные обманки вопросов.
    const named: { name: string; rect: Rect }[] = [];
    for (const q of levelQuestions) {
      named.push({ name: `вопрос «${q.text.slice(0, 40)}»`, rect: q });
      q.decoyPoints.forEach((p, i) => {
        named.push({ name: `обманка ${i + 1} вопроса «${q.text.slice(0, 40)}»`, rect: p });
      });
    }
    levelDecoys.forEach((p, i) => {
      named.push({ name: `общая обманка ${i + 1}`, rect: p });
    });

    for (let i = 0; i < named.length; i += 1) {
      for (let j = i + 1; j < named.length; j += 1) {
        if (sameRect(named[i].rect, named[j].rect)) continue;
        if (rectsOverlap(named[i].rect, named[j].rect)) {
          problems.push({
            requirement: 'FR-013',
            message: `уровень ${level}: области налезают друг на друга — ${named[i].name} и ${named[j].name}`,
          });
        }
      }
    }
  }

  // FR-008: наборы уровней должны быть уникальными. Сравниваем по тексту
  // вопроса, а не по id: копия вопроса на другой уровень получает новый id,
  // и по id совпадение не нашлось бы никогда.
  const seen = new Map<string, BioiqLevelId>();
  for (const q of quiz.questions) {
    const key = q.text.trim().toLowerCase();
    const first = seen.get(key);
    if (first !== undefined && first !== q.level) {
      problems.push({
        requirement: 'FR-008',
        message: `вопрос «${q.text.slice(0, 40)}» встречается и на уровне ${first}, и на уровне ${q.level}`,
      });
    } else if (first === undefined) {
      seen.set(key, q.level);
    }
  }

  return problems;
}
