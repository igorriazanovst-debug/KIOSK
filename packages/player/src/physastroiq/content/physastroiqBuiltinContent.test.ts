// packages/player/src/physastroiq/content/physastroiqBuiltinContent.test.ts
//
// Встроенные викторины в поставке (FR-021, строка 342). Их ДВЕ, по числу
// предметов (FR-004, строка 325: «Предмет — физика, астрономия»), и каждая
// проверяется отдельно: викторина по физике, прошедшая все проверки, ничего
// не говорит о викторине по астрономии.
//
// Проверяется не «файл читается», а то, на чём этот класс виджета уже
// спотыкался: разъехавшийся размер карты, одна картинка на три уровня,
// вопрос без подсказки, тема не из списка тем.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PhysastroiqQuizSchema, type PhysastroiqQuiz } from '../model/schema.ts';
import { checkPhysastroiqQuiz } from '../model/completeness.ts';
import physicsContent from './physastroiqPhysicsContent.json' with { type: 'json' };
import astroContent from './physastroiqAstroContent.json' with { type: 'json' };

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(HERE, '..', '..', '..', 'public', 'physastroiq');

/** Ширина и высота PNG из заголовка IHDR: байты 16..23 после сигнатуры. */
function pngSize(file: string): { width: number; height: number } {
  const head = Buffer.alloc(24);
  const fd = fs.openSync(file, 'r');
  try {
    fs.readSync(fd, head, 0, 24, 0);
  } finally {
    fs.closeSync(fd);
  }
  assert.equal(head.subarray(1, 4).toString('ascii'), 'PNG', `${path.basename(file)} — не PNG`);
  return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
}

const SUBJECTS: { name: string; raw: unknown; expectTitle: string }[] = [
  { name: 'Физика', raw: physicsContent, expectTitle: 'Физика' },
  { name: 'Астрономия', raw: astroContent, expectTitle: 'Астрономия' },
];

const parsed = (raw: unknown): PhysastroiqQuiz => PhysastroiqQuizSchema.parse(raw);

for (const subject of SUBJECTS) {
  test(`«${subject.name}»: викторина проходит схему`, () => {
    parsed(subject.raw);
  });

  test(`«${subject.name}»: викторина проходит проверку комплектности`, () => {
    assert.deepEqual(checkPhysastroiqQuiz(parsed(subject.raw)), []);
  });

  test(`«${subject.name}»: ОБЪЯВЛЕННЫЙ размер карты совпадает с НАСТОЯЩИМ размером файла`, () => {
    // Это не придирка. Заявленный в схеме размер изображения — система
    // координат, в которой лежат все точки ответов. Разойдись он с реальным
    // пикселем PNG, точки поедут пропорционально: картинка на месте, вопросы
    // на месте, а нажимать надо рядом с прибором. Ровно так «РусIQ» потерял
    // около пятой части кликабельных вопросов (см. шапку model/schema.ts).
    const quiz = parsed(subject.raw);
    for (const [level, meta] of Object.entries(quiz.images)) {
      const file = path.join(PUBLIC, meta.fileName);
      assert.ok(fs.existsSync(file), `уровень ${level}: нет файла ${meta.fileName}`);
      const real = pngSize(file);
      assert.deepEqual(
        { width: meta.width, height: meta.height },
        real,
        `уровень ${level} (${meta.fileName}): в схеме ${meta.width}×${meta.height}, в файле ${real.width}×${real.height}`
      );
    }
  });

  test(`«${subject.name}»: у каждого уровня СВОЯ карта`, () => {
    // Одна картинка на три уровня — признак недоделанного контента: у «ХимIQ»
    // так выглядел образец Фазы 3, который чуть не уехал в поставку.
    const quiz = parsed(subject.raw);
    const files = Object.values(quiz.images).map((i) => i.fileName);
    assert.equal(new Set(files).size, files.length, `карты повторяются: ${files.join(', ')}`);
  });

  test(`«${subject.name}»: у каждого уровня СВОЙ набор вопросов (FR-008)`, () => {
    // Требование говорит не «три уровня», а «каждый из уровней должен иметь
    // уникальный набор вопросов». Один и тот же текст на двух уровнях — это
    // формально три уровня и фактически один.
    const quiz = parsed(subject.raw);
    const seen = new Map<string, number>();
    const repeats: string[] = [];
    for (const q of quiz.questions) {
      const prev = seen.get(q.text);
      if (prev !== undefined && prev !== q.level) repeats.push(`«${q.text}» — уровни ${prev} и ${q.level}`);
      seen.set(q.text, q.level);
    }
    assert.deepEqual(repeats, []);
  });

  test(`«${subject.name}»: вопросов не меньше тридцати на уровень`, () => {
    const quiz = parsed(subject.raw);
    for (const level of [1, 2, 3] as const) {
      const count = quiz.questions.filter((q) => q.level === level).length;
      assert.ok(count >= 30, `уровень ${level}: вопросов ${count}`);
    }
  });

  test(`«${subject.name}»: у каждого вопроса есть подсказка (FR-006)`, () => {
    const quiz = parsed(subject.raw);
    const silent = quiz.questions.filter((q) => q.helpText.trim().length === 0);
    assert.deepEqual(
      silent.map((q) => q.text),
      []
    );
  });

  test(`«${subject.name}»: подсказка не повторяет ответ`, () => {
    // Подсказка (FR-006) должна объяснять признак, а не называть ответ.
    // «Это резистор» подсказкой не является — с ней вопрос перестаёт быть
    // вопросом, и проверить это глазами на 180 вопросах нереально.
    const quiz = parsed(subject.raw);
    const giveaway = quiz.questions.filter((q) =>
      q.helpText.toLowerCase().includes(q.answer.toLowerCase())
    );
    assert.deepEqual(
      giveaway.map((q) => `${q.text} → подсказка «${q.helpText}»`),
      []
    );
  });

  test(`«${subject.name}»: тема каждого вопроса объявлена в списке тем викторины`, () => {
    const quiz = parsed(subject.raw);
    const unknown = quiz.questions.filter((q) => !quiz.themes.includes(q.theme));
    assert.deepEqual(
      unknown.map((q) => `${q.text} → ${q.theme}`),
      []
    );
  });

  test(`«${subject.name}»: цена и время растут и убывают от уровня к уровню`, () => {
    // Уровень «Профессионал» должен стоить дороже и давать меньше времени,
    // иначе разделение на уровни ни на что не влияет.
    const quiz = parsed(subject.raw);
    const price = (lvl: number) => quiz.questions.find((q) => q.level === lvl)!.price;
    const time = (lvl: number) => quiz.questions.find((q) => q.level === lvl)!.timeSeconds;
    assert.ok(price(1) < price(2) && price(2) < price(3), 'цена вопроса не растёт с уровнем');
    assert.ok(time(1) > time(2) && time(2) > time(3), 'время на вопрос не убывает с уровнем');
  });

  test(`«${subject.name}»: точек без привязки не меньше десяти на уровень (FR-013)`, () => {
    const quiz = parsed(subject.raw);
    for (const level of [1, 2, 3] as const) {
      const count = quiz.genericDecoyPoints.filter((d) => d.level === level).length;
      assert.ok(count >= 10, `уровень ${level}: точек без привязки ${count}`);
    }
  });
}

test('у викторин разные идентификаторы и разные карты', () => {
  // Обе собираются одним скриптом из общего шаблона: одинаковый id означал бы,
  // что вторая затирает первую в каталоге, а общие карты — что вопрос по
  // астрономии показывает электрическую цепь.
  const phys = parsed(physicsContent);
  const astro = parsed(astroContent);
  assert.notEqual(phys.id, astro.id);
  const physFiles = Object.values(phys.images).map((i) => i.fileName);
  const astroFiles = Object.values(astro.images).map((i) => i.fileName);
  for (const f of physFiles) {
    assert.ok(!astroFiles.includes(f), `карта ${f} используется обеими викторинами`);
  }
});

test('предметы не перепутаны: в физике нет астрономии и наоборот', () => {
  // Обе викторины собираются одним скриптом из двух банков. Перепутать банки
  // местами — правка в одну строку, и заметить её без этой проверки можно
  // только открыв игру.
  const phys = parsed(physicsContent);
  const astro = parsed(astroContent);
  const textOf = (q: PhysastroiqQuiz) =>
    q.questions.map((x) => `${x.text} ${x.answer}`).join(' ').toLowerCase();

  const physText = textOf(phys);
  for (const word of ['планет', 'созвезди', 'затмени', 'орбит']) {
    assert.ok(!physText.includes(word), `в викторине по физике встретилось слово «${word}»`);
  }
  const astroText = textOf(astro);
  for (const word of ['резистор', 'амперметр', 'линз', 'рычаг']) {
    assert.ok(!astroText.includes(word), `в викторине по астрономии встретилось слово «${word}»`);
  }
});

test('в текстах вопросов не осталось биологии Типа 10 и химии Типа 9', () => {
  for (const subject of SUBJECTS) {
    const quiz = parsed(subject.raw);
    const all = quiz.questions
      .map((q) => `${q.text} ${q.answer} ${q.helpText}`)
      .join(' ')
      .toLowerCase();
    for (const word of ['менделеев', 'валентн', 'реактив', 'клетк', 'органоид', 'фотосинтез']) {
      assert.ok(!all.includes(word), `«${subject.name}»: в вопросах осталось слово «${word}»`);
    }
  }
});
