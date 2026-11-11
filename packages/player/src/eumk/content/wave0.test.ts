// Автотесты волны 0 (K5): автоматизируемая часть проверки E-10.
// Каждая правка волны 0 (K5_волна0_отчёт.md §1.2) прогоняется здесь
// end-to-end: схема + движок проверки заданий + генерация раундов игр.
// Ручная часть E-10 (как задания выглядят на экране) остаётся за
// пользователем; эти тесты закрывают механику.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EumkContentSchema, TaskSchema, type EumkContent, type EumkTask } from '../model/schema.ts';
import { checkTask } from '../tasks.ts';
import { buildGameRounds, gameLevels, ROUNDS_PER_PLAY } from '../gameRounds.ts';
import { seededRng } from '../rng.ts';

function load(name: string): EumkContent {
  return EumkContentSchema.parse(JSON.parse(readFileSync(new URL(`./${name}.content.json`, import.meta.url), 'utf8')));
}

const nach = load('nach');
const dosh = load('dosh');

// Правильный ответ для каждого типа задания в терминах UI (tasks.ts).
function correctAnswer(task: EumkTask): unknown {
  switch (task.type) {
    case 'choice':
    case 'multi':
      return [...task.data.correct];
    case 'order':
      return [...task.data.items];
    case 'sort':
      // Ответ сортировки - запись «текст элемента -> категория» (как в UI).
      return Object.fromEntries(task.data.items.map((i) => [i.text, i.category]));
    case 'match':
      // Ответ соответствия - запись «левая часть -> правая».
      return Object.fromEntries(task.data.pairs.map(([left, right]) => [left, right]));
    case 'gaps':
      return [...task.data.answers];
    case 'input':
      return task.data.accepted[0];
  }
}

// Все юниты, изменённые волной 0 (перестановки, дистракторы, замены пар).
const WAVE0_CHANGED: ReadonlyArray<{ product: 'nach' | 'dosh'; ids: string[] }> = [
  { product: 'nach', ids: ['nt-003', 'nt-004', 'nt-006', 'nt-007', 'nt-008', 'nt-009', 'nt-012', 'nt-013', 'nt-017', 'nt-019', 'nt-021', 'nt-023', 'nt-025'] },
  { product: 'dosh', ids: ['dt-005', 'dt-011', 'dt-012', 'dt-017', 'dt-018', 'dt-020', 'dt-024'] },
];

for (const { product, ids } of WAVE0_CHANGED) {
  test(`волна 0 (${product}): изменённые задания валидны и решаются правильным ответом`, () => {
    const content = product === 'nach' ? nach : dosh;
    for (const id of ids) {
      const raw = content.tasks.find((t) => t.id === id);
      assert.ok(raw, `${id}: задания нет в контенте`);
      const task = TaskSchema.parse(raw);
      const check = checkTask(task, correctAnswer(task));
      assert.equal(check.isCorrect, true, `${id}: правильный ответ не зачтён (share=${check.share})`);
      assert.equal(check.share, 1, `${id}: доля зачёта < 1`);
    }
  });
}

// Изменённые вопросы банка: правильный индекс указывает на осмысленный
// вариант (замена дистракторов не задела ответ).
test('волна 0: изменённые вопросы банка валидны, ответ на месте', () => {
  const edits: Array<[EumkContent, string, string]> = [
    [nach, 'nq-019', '675 часов'],
    [nach, 'nq-037', '136 часов, то есть четыре часа в неделю'],
    [dosh, 'dq-023', 'В возрасте 5–6 лет'],
    [dosh, 'dq-030', 'В возрасте 6–7 лет'],
    [dosh, 'dq-048', 'С 5–6 лет'],
  ];
  for (const [content, id, expected] of edits) {
    const q = content.bank.find((x) => x.id === id);
    assert.ok(q, `${id}: вопроса нет`);
    assert.equal(q.options[q.answer], expected, `${id}: верный вариант сместился при правке дистракторов`);
    assert.equal(new Set(q.options).size, 4, `${id}: варианты повторяются`);
  }
});

// ng-3: уровни после переразбивки дают полную серию на каждом уровне.
test('волна 0: ng-3 «Логические задачи» - два уровня по полной серии', () => {
  const logic = nach.games.find((g) => g.id === 'ng-3');
  assert.ok(logic);
  const levels = gameLevels(logic);
  assert.deepEqual(levels, [1, 2], 'уровни после переразбивки');
  for (const level of levels) {
    const rounds = buildGameRounds(logic, level, seededRng(20261111));
    assert.equal(rounds.length, ROUNDS_PER_PLAY, `уровень ${level}: раундов ${rounds.length}`);
    for (const r of rounds) {
      assert.equal(checkTask(r.task, correctAnswer(r.task)).isCorrect, true, `уровень ${level}: раунд не решается своим ответом`);
    }
  }
});

// ng-4: пул после добавления героев и их раунды.
test('волна 0: ng-4 «Костюм» - 10 героев, новые герои дают корректные раунды', () => {
  const costume = nach.games.find((g) => g.id === 'ng-4');
  assert.ok(costume);
  const heroes = costume.data.heroes as Array<Record<string, unknown>>;
  assert.equal(heroes.length, 10, 'размер пула');
  const names = heroes.map((h) => String(h.hero));
  for (const hero of ['Буратино', 'Мальвина']) {
    assert.ok(names.includes(hero), `${hero}: героя нет в пуле`);
  }
  // Раунды с новыми героями: каждый герой достижим в серии на каком-то сиде.
  const seenHeroes = new Set<string>();
  for (let seed = 1; seed <= 40 && seenHeroes.size < 10; seed++) {
    for (const r of buildGameRounds(costume, 1, seededRng(seed))) {
      seenHeroes.add(r.task.title);
      // Механика multi: 6 вариантов, 3 верных - атрибуты облика героя.
      const task = TaskSchema.parse(r.task);
      assert.equal(task.type, 'multi');
      assert.equal(task.data.options.length, 6);
      assert.equal(task.data.correct.length, 3);
      assert.equal(checkTask(task, correctAnswer(task)).isCorrect, true);
    }
  }
  assert.equal(seenHeroes.size, 10, `за 40 сидов достигнуты не все герои: ${[...seenHeroes]}`);
  for (const hero of ['Буратино', 'Мальвина']) {
    assert.ok(seenHeroes.has(hero), `${hero}: не выпал ни в одной серии`);
  }
});
