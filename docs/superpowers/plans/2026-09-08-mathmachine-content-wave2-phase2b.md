# Тип 6 «Матемашка» — Этап 2b, волна 2: пять новых типов заданий — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить в движок «Матемашки» пять новых типов заданий (Умножение, Деление с остатком, Кратные, Оценки/округление, Порядковые числительные) и наполнить каталог 76 новыми заданиями, доводя покрытие категорий ТЗ (FR-022) с 7 до 12 из 13.

**Architecture:** Тот же паттерн, что и в волне 1: регистрация в `TASK_TYPE_REGISTRY` (переиспользует `numericCheck`/`choiceCheck`) + рендер в `TaskVisual.tsx` + подсказка в `TaskRunner.tsx`. Контент — offline-генератор (детерминированный перебор, без RNG) материализует статические записи в `pilotContent.json`. **Отличие от волны 1**: вариация позиции правильного ответа в группах с выбором закладывается в генератор и его тесты с первого коммита (урок финального ревью волны 1 — там это исправлялось постфактум отдельным раундом).

**Tech Stack:** TypeScript, zod (`packages/shared`), React (`packages/player`), `node:test`/`node:assert/strict`.

**Spec:** `docs/superpowers/specs/2026-09-08-mathmachine-content-wave2-design.md`

## Global Constraints

- Все 5 новых типов переиспользуют существующие `numericCheck`/`choiceCheck` — новой логики проверки ответа не пишется.
- Деление с остатком — единственный тип, где `correctAnswer` не число, а строка вида `"{частное} ост. {остаток}"` (схема это уже поддерживает: `correctAnswer: z.union([z.number(), z.string()])`, `choices` аналогично) — включая явное «ост. 0» для деления без остатка в будущих волнах (эта волна генерирует только пары с ненулевым остатком).
- **Обязательно с первого коммита генератора** (не постфактум): для каждой группы с режимом ответа `choice` (Деление, Кратные) позиция правильного варианта среди `choices` варьируется детерминированно по индексу задания внутри группы — и юнит-тест, проверяющий, что позиция не константна в каждой такой группе, пишется вместе с генератором, а не добавляется отдельным фикс-раундом.
- «Порядковые числительные» — режим ответа `numeric` (ввод числа с клавиатуры), у него физически нет «позиции кнопки» для эксплуатации — вариация позиции для этого типа не требуется, только вариация запрашиваемой позиции ряда (для разнообразия покрытия, не защиты от эксплойта).
- Параметры заданий — только `number`/`number[]` (без строк) — для Кратных `options`/`choices` хранят числа, только `correctAnswer` для Деления — строка.
- Визуал — простая геометрия/текст в `TaskVisual.tsx`, без арта через syntx.ai в этой волне.
- «Проценты» не реализуются в этой волне (последняя из 13 категорий ТЗ, отложена сознательно).
- Тестовые файлы используют явное расширение `.ts` в относительных импортах.
- `packages/player/package.json`'s `"test"` script уже глобит `src/mathmachine/content/*.test.ts` и `src/mathmachine/*.test.ts` — новые тестовые файлы подхватятся автоматически.
- Ветка — существующая `feat/mathmachine-widget` (не создавать новую).
- Итоговый объём этой волны (76 заданий, посчитано конкретным генератором ниже) — меньше грубой оценки, но точное и полностью проверяемое построением число, тот же принцип, что и в волне 1.

---

### Task 1: Регистрация 5 новых типов заданий (схема + движок + подсказки)

**Files:**
- Modify: `packages/shared/src/mathmachine/model/schema.ts:21-33`
- Modify: `packages/shared/src/mathmachine/model/schema.test.ts`
- Modify: `packages/shared/src/mathmachine/taskEngine.ts:25-36`
- Modify: `packages/shared/src/mathmachine/taskEngine.test.ts`
- Modify: `packages/player/src/mathmachine/TaskRunner.tsx:18-29`

**Interfaces:**
- Produces (используется Задачами 2 и 3): пять новых `TaskTypeId` — `'number_multiply_two'`, `'number_divide_remainder'`, `'number_multiple_check'`, `'round_to_ten'`, `'ordinal_position'` — все зарегистрированы с `answerMode` и присутствуют в `HINTS` (`Record<Task['typeId'], string>` — исчерпывающая запись, `tsc` упадёт без всех пяти).

- [ ] **Step 1: Написать падающий тест схемы**

В `packages/shared/src/mathmachine/model/schema.test.ts`, найди тест `'TaskTypeIdSchema accepts the five Этап 2b wave 1 task types'` (добавлен в волне 1) и добавь СРАЗУ ПОСЛЕ него новый тест:

```ts
test('TaskTypeIdSchema accepts the five Этап 2b wave 2 task types', () => {
  const wave2Types = ['number_multiply_two', 'number_divide_remainder', 'number_multiple_check', 'round_to_ten', 'ordinal_position'];
  for (const id of wave2Types) {
    assert.equal(TaskTypeIdSchema.safeParse(id).success, true, `expected ${id} to be a valid TaskTypeId`);
  }
});
```

(`TaskTypeIdSchema` уже импортирован в этом файле волной 1 — новый импорт не нужен.)

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

Run: `cd packages/shared && npx tsx --test src/mathmachine/model/schema.test.ts`
Expected: FAIL — новые id ещё не входят в `TASK_TYPE_IDS`.

- [ ] **Step 3: Расширить `TASK_TYPE_IDS`**

В `packages/shared/src/mathmachine/model/schema.ts`, замени (строки 21-33):

```ts
/** Типы заданий Этапа 1 + Этапа 2b, волна 1 (спека 2026-09-08). */
export const TASK_TYPE_IDS = [
  'number_counting',
  'number_sum_two',
  'number_sum_three',
  'number_missing',
  'compare_length',
  'number_subtract_two',
  'number_compare',
  'digit_recognition',
  'number_composition',
  'number_ordering',
] as const;
```

на:

```ts
/** Типы заданий Этапа 1 + Этапа 2b, волны 1-2 (спеки 2026-09-08). */
export const TASK_TYPE_IDS = [
  'number_counting',
  'number_sum_two',
  'number_sum_three',
  'number_missing',
  'compare_length',
  'number_subtract_two',
  'number_compare',
  'digit_recognition',
  'number_composition',
  'number_ordering',
  'number_multiply_two',
  'number_divide_remainder',
  'number_multiple_check',
  'round_to_ten',
  'ordinal_position',
] as const;
```

- [ ] **Step 4: Запустить тест схемы и убедиться, что он проходит**

Run: `cd packages/shared && npx tsx --test src/mathmachine/model/schema.test.ts`
Expected: PASS, все тесты в файле зелёные.

- [ ] **Step 5: Написать падающие тесты движка**

В `packages/shared/src/mathmachine/taskEngine.test.ts`, добавь новые тестовые задания после существующих (после констант волны 1, если они там есть — иначе после `const sumTask`/`const compareTask` в начале файла):

```ts
const multiplyTask: Task = {
  id: 'w2t1', typeId: 'number_multiply_two', text: 'Сколько будет 3 умножить на 4?', params: { a: 3, b: 4 },
  correctAnswer: 12,
};
const divideTask: Task = {
  id: 'w2t2', typeId: 'number_divide_remainder', text: 'Сколько будет 7 разделить на 2?', params: { a: 7, b: 2 },
  correctAnswer: '3 ост. 1', choices: ['3 ост. 1', '3 ост. 2', '2 ост. 1'],
};
const multipleCheckTask: Task = {
  id: 'w2t3', typeId: 'number_multiple_check', text: 'Какое из чисел делится на 3 без остатка?', params: { n: 3, options: [9, 10, 8] },
  correctAnswer: 9, choices: [9, 10, 8],
};
const roundTask: Task = {
  id: 'w2t4', typeId: 'round_to_ten', text: 'Округли 47 до десятков', params: { n: 47 },
  correctAnswer: 50,
};
const ordinalTask: Task = {
  id: 'w2t5', typeId: 'ordinal_position', text: 'Какое число стоит на 3-м месте: 5, 8, 2, 9, 1?', params: { series: [5, 8, 2, 9, 1], position: 3 },
  correctAnswer: 2,
};
```

И в конец файла:

```ts
test('getAnswerMode returns the right mode for each Этап 2b wave 2 type', () => {
  assert.equal(getAnswerMode('number_multiply_two'), 'numeric');
  assert.equal(getAnswerMode('number_divide_remainder'), 'choice');
  assert.equal(getAnswerMode('number_multiple_check'), 'choice');
  assert.equal(getAnswerMode('round_to_ten'), 'numeric');
  assert.equal(getAnswerMode('ordinal_position'), 'numeric');
});

test('checkTaskAnswer validates each Этап 2b wave 2 type correctly', () => {
  assert.equal(checkTaskAnswer(multiplyTask, 12), true);
  assert.equal(checkTaskAnswer(multiplyTask, 11), false);
  assert.equal(checkTaskAnswer(divideTask, '3 ост. 1'), true);
  assert.equal(checkTaskAnswer(divideTask, '3 ост. 2'), false);
  assert.equal(checkTaskAnswer(multipleCheckTask, 9), true);
  assert.equal(checkTaskAnswer(multipleCheckTask, 10), false);
  assert.equal(checkTaskAnswer(roundTask, 50), true);
  assert.equal(checkTaskAnswer(roundTask, 40), false);
  assert.equal(checkTaskAnswer(ordinalTask, 2), true);
  assert.equal(checkTaskAnswer(ordinalTask, 8), false);
});
```

- [ ] **Step 6: Запустить тесты движка и убедиться, что они падают**

Run: `cd packages/shared && npx tsx --test src/mathmachine/taskEngine.test.ts`
Expected: FAIL — новые типы ещё не зарегистрированы (`Unknown task type`).

- [ ] **Step 7: Зарегистрировать 5 новых типов в `TASK_TYPE_REGISTRY`**

В `packages/shared/src/mathmachine/taskEngine.ts`, найди конец объекта `TASK_TYPE_REGISTRY` (строка с `number_ordering: { ... },` — последняя запись волны 1) и добавь сразу после неё, перед закрывающей `};`:

```ts
  number_multiply_two: { id: 'number_multiply_two', answerMode: 'numeric', checkAnswer: numericCheck },
  number_divide_remainder: { id: 'number_divide_remainder', answerMode: 'choice', checkAnswer: choiceCheck },
  number_multiple_check: { id: 'number_multiple_check', answerMode: 'choice', checkAnswer: choiceCheck },
  round_to_ten: { id: 'round_to_ten', answerMode: 'numeric', checkAnswer: numericCheck },
  ordinal_position: { id: 'ordinal_position', answerMode: 'numeric', checkAnswer: numericCheck },
```

- [ ] **Step 8: Запустить тесты движка и убедиться, что они проходят**

Run: `cd packages/shared && npx tsx --test src/mathmachine/taskEngine.test.ts`
Expected: PASS, все тесты зелёные.

- [ ] **Step 9: Пересобрать `packages/shared`**

Run: `cd packages/shared && npm run build`
Expected: успешная сборка. Пересоздать симлинк `node_modules/@kiosk/shared` в `packages/player`, если сломан, перед Step 10.

- [ ] **Step 10: Обновить `HINTS` в `TaskRunner.tsx`**

В `packages/player/src/mathmachine/TaskRunner.tsx`, найди конец объекта `HINTS` (строка с `number_ordering: '...',` — последняя запись волны 1) и добавь сразу после неё, перед закрывающей `};`:

```ts
  number_multiply_two: 'Сложи первое число само с собой столько раз, сколько указывает второе.',
  number_divide_remainder: 'Подумай, сколько раз второе число помещается в первом, и что останется.',
  number_multiple_check: 'Проверь каждое число по очереди — делится ли оно без остатка.',
  round_to_ten: 'Посмотри на цифру единиц: если она 5 или больше — округляй вверх, иначе вниз.',
  ordinal_position: 'Посчитай числа по порядку слева направо, пока не дойдёшь до нужного места.',
```

- [ ] **Step 11: Проверить сборку TypeScript**

Run: `cd packages/player && npx tsc --noEmit`
Expected: без новых ошибок типов (`HINTS`'s exhaustiveness check проходит).

- [ ] **Step 12: Закоммитить**

```bash
git add packages/shared/src/mathmachine/model/schema.ts packages/shared/src/mathmachine/model/schema.test.ts packages/shared/src/mathmachine/taskEngine.ts packages/shared/src/mathmachine/taskEngine.test.ts packages/player/src/mathmachine/TaskRunner.tsx
git commit -m "feat(mathmachine): register 5 Этап 2b wave 2 task types (multiply/divide/multiples/round/ordinal)"
```

---

### Task 2: Визуал новых типов заданий в `TaskVisual.tsx`

**Files:**
- Modify: `packages/player/src/mathmachine/TaskVisual.tsx`

**Interfaces:**
- Consumes: 5 `TaskTypeId` из Задачи 1.
- Produces: ничего нового для последующих задач — чисто рендер.

Без автотеста (нет React-тестовой инфраструктуры в этом пакете — установленная конвенция). `tsc --noEmit` — единственная механическая проверка, полная верификация — в Задаче 5.

- [ ] **Step 1: Добавить 5 новых кейсов в `switch`**

В `packages/player/src/mathmachine/TaskVisual.tsx`, найди блок:

```tsx
    case 'number_ordering': {
      const series = (task.params.series as unknown as number[]) ?? [];
      return <div style={equationStyle}>{series.join('   ')}</div>;
    }
    default:
      return null;
```

Замени на:

```tsx
    case 'number_ordering': {
      const series = (task.params.series as unknown as number[]) ?? [];
      return <div style={equationStyle}>{series.join('   ')}</div>;
    }
    case 'number_multiply_two':
      return <div style={equationStyle}>{String(task.params.a)} × {String(task.params.b)} = ?</div>;
    case 'number_divide_remainder':
      return <div style={equationStyle}>{String(task.params.a)} : {String(task.params.b)} = ?</div>;
    case 'number_multiple_check':
      return <div style={equationStyle}>Делится на {String(task.params.n)}?</div>;
    case 'round_to_ten':
      return <div style={equationStyle}>{String(task.params.n)} ≈ ?</div>;
    case 'ordinal_position': {
      const series = (task.params.series as unknown as number[]) ?? [];
      return <div style={equationStyle}>{series.join('   ')}</div>;
    }
    default:
      return null;
```

- [ ] **Step 2: Проверить сборку TypeScript**

Run: `cd packages/player && npx tsc --noEmit`
Expected: без новых ошибок типов.

- [ ] **Step 3: Закоммитить**

```bash
git add packages/player/src/mathmachine/TaskVisual.tsx
git commit -m "feat(mathmachine): render 5 Этап 2b wave 2 task types in TaskVisual"
```

---

### Task 3: Offline-генератор контента волны 2 (чистая логика, вариация позиции с первого коммита)

**Files:**
- Create: `packages/player/src/mathmachine/content/generateWave2Content.ts`
- Test: `packages/player/src/mathmachine/content/generateWave2Content.test.ts`

**Interfaces:**
- Consumes: 5 `TaskTypeId` из Задачи 1, типы `MathMachineContent`/`Task`/`Group`/`Topic` из `@kiosk/shared`.
- Produces (используется Задачей 4):
  - `WAVE2_TOPICS: TopicSpec[]` (5 элементов)
  - `countWave2Tasks(): number`
  - `mergeIntoContent(content: MathMachineContent): MathMachineContent`

Этот модуль независим от `generateWave1Content.ts` (дублирует крошечные хелперы `buildGroup`/`rotate` вместо импорта — каждый скрипт волны самодостаточен и может быть изменён/удалён отдельно от других волн, тот же принцип, что уже применён между волной 1 и волной 2).

- [ ] **Step 1: Написать падающие тесты**

Создай `packages/player/src/mathmachine/content/generateWave2Content.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MathMachineContentSchema, type MathMachineContent } from '@kiosk/shared';
import { WAVE2_TOPICS, countWave2Tasks, mergeIntoContent } from './generateWave2Content.ts';

test('countWave2Tasks returns the exact expected total (20+16+16+16+8)', () => {
  assert.equal(countWave2Tasks(), 76);
});

test('WAVE2_TOPICS has exactly 5 topics, one per Этап 2b wave 2 category', () => {
  assert.equal(WAVE2_TOPICS.length, 5);
});

test('no duplicate topic, group, or task ids across all of WAVE2_TOPICS', () => {
  const topicIds = new Set<string>();
  const groupIds = new Set<string>();
  const taskIds = new Set<string>();
  for (const topic of WAVE2_TOPICS) {
    assert.ok(!topicIds.has(topic.id), `duplicate topic id: ${topic.id}`);
    topicIds.add(topic.id);
    for (const group of topic.groups) {
      assert.ok(!groupIds.has(group.id), `duplicate group id: ${group.id}`);
      groupIds.add(group.id);
      for (const task of group.tasks) {
        assert.ok(!taskIds.has(task.id), `duplicate task id: ${task.id}`);
        taskIds.add(task.id);
      }
    }
  }
});

test('within every choice-mode group, the correct answer is not always at the same button position', () => {
  for (const topic of WAVE2_TOPICS) {
    for (const group of topic.groups) {
      const choiceTasks = group.tasks.filter((t) => Array.isArray(t.choices));
      if (choiceTasks.length < 2) continue;
      const positions = new Set(
        choiceTasks.map((t) => t.choices!.findIndex((c) => String(c) === String(t.correctAnswer))),
      );
      assert.ok(
        positions.size > 1,
        `group ${group.id} always places the correct answer at button position ${[...positions]} — a child could solve it without reading`,
      );
    }
  }
});

test('every generated task has a correctAnswer consistent with its own params', () => {
  for (const topic of WAVE2_TOPICS) {
    for (const group of topic.groups) {
      for (const task of group.tasks) {
        if (task.typeId === 'number_multiply_two') {
          const { a, b } = task.params as { a: number; b: number };
          assert.equal(task.correctAnswer, a * b);
        }
        if (task.typeId === 'number_divide_remainder') {
          const { a, b } = task.params as { a: number; b: number };
          const quotient = Math.floor(a / b);
          const remainder = a % b;
          assert.equal(task.correctAnswer, `${quotient} ост. ${remainder}`);
          assert.ok(quotient >= 1, `division quotient must be >= 1 to keep decoys well-formed: ${task.id}`);
          assert.ok(remainder >= 1, `this wave only generates non-zero-remainder division tasks: ${task.id}`);
          assert.equal(new Set(task.choices).size, 3, `all 3 choice options must be distinct: ${task.id}`);
          assert.ok(task.choices!.includes(task.correctAnswer as string));
        }
        if (task.typeId === 'number_multiple_check') {
          const { n } = task.params as { n: number; options: number[] };
          assert.equal((task.correctAnswer as number) % n, 0, `correctAnswer must be a genuine multiple of n: ${task.id}`);
          for (const choice of task.choices as number[]) {
            if (choice !== task.correctAnswer) {
              assert.notEqual(choice % n, 0, `distractor ${choice} must NOT be a multiple of ${n}: ${task.id}`);
            }
          }
          assert.equal(new Set(task.choices).size, 3, `all 3 choice options must be distinct: ${task.id}`);
        }
        if (task.typeId === 'round_to_ten') {
          const { n } = task.params as { n: number };
          assert.equal(task.correctAnswer, Math.round(n / 10) * 10);
          assert.ok(n % 10 !== 0, `round_to_ten tasks should use a number that isn't already a multiple of 10: ${task.id}`);
        }
        if (task.typeId === 'ordinal_position') {
          const { series, position } = task.params as { series: number[]; position: number };
          assert.equal(task.correctAnswer, series[position - 1]);
          assert.equal(series.length, 5);
          assert.ok(position >= 1 && position <= 5);
          assert.equal(new Set(series).size, 5, `series must have 5 distinct numbers: ${task.id}`);
        }
      }
    }
  }
});

const BASE_CONTENT: MathMachineContent = {
  schemaVersion: 1,
  sections: [{ id: 'sec_arithmetic', name: 'Арифметика', topicIds: ['top_addition'] }],
  topics: { top_addition: { id: 'top_addition', name: 'Сложение', groupIds: ['grp_add_1'] } },
  groups: { grp_add_1: { id: 'grp_add_1', name: 'Сложение до 10', taskIds: ['add1_intro'] } },
  tasks: { add1_intro: { id: 'add1_intro', typeId: 'number_sum_two', text: '1+1', params: { a: 1, b: 1 }, correctAnswer: 2 } },
  mathTools: [],
  media: {},
};

test('mergeIntoContent adds all wave 2 topics without touching existing content', () => {
  const merged = mergeIntoContent(BASE_CONTENT);
  assert.ok(merged.topics.top_addition, 'existing topic must survive the merge');
  assert.equal(Object.keys(merged.topics).length, 1 + WAVE2_TOPICS.length);
  const arithmeticSection = merged.sections.find((s) => s.id === 'sec_arithmetic')!;
  assert.equal(arithmeticSection.topicIds.length, 1 + WAVE2_TOPICS.length);
  assert.equal(Object.keys(merged.tasks).length, 1 + countWave2Tasks());
});

test('mergeIntoContent throws instead of silently overwriting a colliding topic id', () => {
  const colliding: MathMachineContent = {
    ...BASE_CONTENT,
    topics: { ...BASE_CONTENT.topics, top_multiplication: { id: 'top_multiplication', name: 'existing', groupIds: ['x'] } },
  };
  assert.throws(() => mergeIntoContent(colliding), /top_multiplication/);
});

test('the merged content validates against MathMachineContentSchema', () => {
  const merged = mergeIntoContent(BASE_CONTENT);
  const result = MathMachineContentSchema.safeParse(merged);
  assert.equal(result.success, true, result.success ? '' : JSON.stringify((result as any).error?.issues, null, 2));
});
```

- [ ] **Step 2: Запустить тесты и убедиться, что они падают**

Run: `cd packages/player && node --experimental-strip-types --test src/mathmachine/content/generateWave2Content.test.ts`
Expected: FAIL с `ERR_MODULE_NOT_FOUND` (`./generateWave2Content.ts` ещё не существует).

- [ ] **Step 3: Реализовать `generateWave2Content.ts`**

Создай `packages/player/src/mathmachine/content/generateWave2Content.ts`:

```ts
// Offline-генератор контента Этапа 2b, волна 2 (спека
// docs/superpowers/specs/2026-09-08-mathmachine-content-wave2-design.md).
// Тот же принцип, что и в волне 1 (generateWave1Content.ts) — чистые
// функции, детерминированное перечисление без RNG, файловый ввод-вывод
// вынесен в отдельный runGenerateWave2.ts. В отличие от волны 1, вариация
// позиции правильного ответа в группах с выбором заложена с первого
// коммита (финальное ревью волны 1 нашло, что фиксированная позиция
// позволяла решать задания без чтения условия — там это чинилось
// отдельным фикс-раундом постфактум). Хелперы buildGroup/rotate
// продублированы, а не импортированы из generateWave1Content.ts — каждый
// скрипт волны самодостаточен.

import type { MathMachineContent, Task, Group, Topic } from '@kiosk/shared';

export interface GroupSpec {
  id: string;
  name: string;
  tasks: Task[];
}

export interface TopicSpec {
  id: string;
  name: string;
  groups: GroupSpec[];
}

function buildGroup(idPrefix: string, name: string, tasks: Omit<Task, 'id'>[]): GroupSpec {
  const builtTasks: Task[] = tasks.map((t, i) => ({
    ...t,
    id: i === 0 ? `${idPrefix}_intro` : `${idPrefix}_${i}`,
  }));
  return { id: `grp_${idPrefix}`, name, tasks: builtTasks };
}

function rotate<T>(arr: T[], shift: number): T[] {
  const n = arr.length;
  const s = ((shift % n) + n) % n;
  return [...arr.slice(s), ...arr.slice(0, s)];
}

// ─── Умножение (20 заданий: 10 + 10) ───────────────────────────────────

function multiplyTask(a: number, b: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_multiply_two',
    text: `Сколько будет ${a} умножить на ${b}?`,
    params: { a, b },
    correctAnswer: a * b,
  };
}

function buildMultiplicationTopic(): TopicSpec {
  const by2 = buildGroup(
    'mult_by2',
    'Таблица умножения на 2',
    Array.from({ length: 10 }, (_, i) => multiplyTask(i + 1, 2)),
  );
  const by5 = buildGroup(
    'mult_by5',
    'Таблица умножения на 5',
    Array.from({ length: 10 }, (_, i) => multiplyTask(i + 1, 5)),
  );
  return { id: 'top_multiplication', name: 'Умножение', groups: [by2, by5] };
}

// ─── Деление с остатком (16 заданий: 8 + 8) ────────────────────────────
// correctAnswer — строка "частное ост. остаток", не число (составной
// ответ не укладывается в единственное числовое поле ввода). Позиция
// правильного варианта среди трёх вариантов-строк варьируется по
// positionIndex С ПЕРВОГО КОММИТА. Пары (a,b) подобраны так, чтобы
// частное было >= 1 (иначе вариант "частное-1" выглядел бы отрицательным)
// и остаток был ненулевым (эта волна учит именно наличию остатка).

function formatDivision(quotient: number, remainder: number): string {
  return `${quotient} ост. ${remainder}`;
}

function divideTask(a: number, b: number, positionIndex: number): Omit<Task, 'id'> {
  const quotient = Math.floor(a / b);
  const remainder = a % b;
  const correct = formatDivision(quotient, remainder);
  const decoyRemainder = formatDivision(quotient, (remainder + 1) % b);
  const decoyQuotient = formatDivision(quotient - 1, remainder);
  const options = [correct, decoyRemainder, decoyQuotient];
  const choices = rotate(options, positionIndex);
  return {
    typeId: 'number_divide_remainder',
    text: `Сколько будет ${a} разделить на ${b}?`,
    params: { a, b },
    correctAnswer: correct,
    choices,
  };
}

const DIVISION_PAIRS_23: [number, number][] = [
  [5, 2], [7, 2], [9, 2], [11, 2],
  [7, 3], [8, 3], [10, 3], [11, 3],
];
const DIVISION_PAIRS_45: [number, number][] = [
  [9, 4], [11, 4], [13, 4], [14, 4],
  [7, 5], [8, 5], [12, 5], [13, 5],
];

function buildDivisionTopic(): TopicSpec {
  const div23 = buildGroup(
    'div_23',
    'Деление на 2 и 3',
    DIVISION_PAIRS_23.map(([a, b], i) => divideTask(a, b, i)),
  );
  const div45 = buildGroup(
    'div_45',
    'Деление на 4 и 5',
    DIVISION_PAIRS_45.map(([a, b], i) => divideTask(a, b, i)),
  );
  return { id: 'top_division', name: 'Деление', groups: [div23, div45] };
}

// ─── Кратные (16 заданий: 8 + 8) ────────────────────────────────────────
// Дистракторы — correct±1: два соседних целых не могут оба делиться на
// n>=2, поэтому дистракторы всегда корректны без отдельной проверки на
// генерацию (но проверяются тестом всё равно — дешёвая перепроверка).
// Позиция правильного варианта варьируется по positionIndex С ПЕРВОГО
// КОММИТА.

function multipleTask(n: number, k: number, positionIndex: number): Omit<Task, 'id'> {
  const correct = n * k;
  const options = [correct, correct + 1, correct - 1];
  const choices = rotate(options, positionIndex);
  return {
    typeId: 'number_multiple_check',
    text: `Какое из чисел делится на ${n} без остатка?`,
    params: { n, options: choices },
    correctAnswer: correct,
    choices,
  };
}

function buildMultiplesTopic(): TopicSpec {
  const tasks23: Omit<Task, 'id'>[] = [];
  [2, 3].forEach((n) => {
    for (let k = 2; k <= 5; k++) tasks23.push(multipleTask(n, k, tasks23.length));
  });
  const group23 = buildGroup('kratn_23', 'Кратные 2 и 3', tasks23);

  const tasks45: Omit<Task, 'id'>[] = [];
  [4, 5].forEach((n) => {
    for (let k = 2; k <= 5; k++) tasks45.push(multipleTask(n, k, tasks45.length));
  });
  const group45 = buildGroup('kratn_45', 'Кратные 4 и 5', tasks45);

  return { id: 'top_multiples', name: 'Кратные', groups: [group23, group45] };
}

// ─── Оценки: округление до десятков (16 заданий: 8 + 8) ────────────────
// Числа подобраны вручную, чтобы избежать ровно половины (…5) — этой
// волной не проверяется конвенция округления половины, только
// однозначные случаи.

function roundTask(n: number): Omit<Task, 'id'> {
  return {
    typeId: 'round_to_ten',
    text: `Округли ${n} до десятков`,
    params: { n },
    correctAnswer: Math.round(n / 10) * 10,
  };
}

const ROUND_GROUP_A = [12, 17, 23, 28, 34, 41, 47, 53];
const ROUND_GROUP_B = [58, 62, 69, 74, 81, 86, 93, 97];

function buildRoundingTopic(): TopicSpec {
  const groupA = buildGroup('round_a', 'Округление до 60', ROUND_GROUP_A.map((n) => roundTask(n)));
  const groupB = buildGroup('round_b', 'Округление от 60', ROUND_GROUP_B.map((n) => roundTask(n)));
  return { id: 'top_rounding', name: 'Оценки', groups: [groupA, groupB] };
}

// ─── Порядковые числительные (8 заданий) ────────────────────────────────
// Режим ответа — numeric (клавиатура), у него физически нет "позиции
// кнопки" для эксплуатации, поэтому вариация позиции здесь не нужна.
// Позиция ЗАПРОСА (какое место по счёту спрашиваем) циклически меняется
// 1..5 просто ради разнообразия покрытия.

function ordinalTask(series: number[], position: number): Omit<Task, 'id'> {
  return {
    typeId: 'ordinal_position',
    text: `Какое число стоит на ${position}-м месте: ${series.join(', ')}?`,
    params: { series, position },
    correctAnswer: series[position - 1],
  };
}

const ORDINAL_SERIES: number[][] = [
  [3, 7, 2, 9, 15],
  [5, 12, 1, 8, 17],
  [6, 14, 3, 11, 19],
  [2, 9, 16, 4, 13],
  [7, 1, 18, 10, 5],
  [11, 3, 15, 8, 20],
  [4, 17, 9, 2, 14],
  [13, 6, 19, 1, 10],
];

function buildOrdinalTopic(): TopicSpec {
  const group = buildGroup(
    'ordpos',
    'Найди число по номеру',
    ORDINAL_SERIES.map((series, i) => ordinalTask(series, (i % 5) + 1)),
  );
  return { id: 'top_ordinal', name: 'Порядковые числительные', groups: [group] };
}

// ─── Сборка ─────────────────────────────────────────────────────────────

export const WAVE2_TOPICS: TopicSpec[] = [
  buildMultiplicationTopic(),
  buildDivisionTopic(),
  buildMultiplesTopic(),
  buildRoundingTopic(),
  buildOrdinalTopic(),
];

export function countWave2Tasks(): number {
  return WAVE2_TOPICS.reduce(
    (sum, topic) => sum + topic.groups.reduce((s, g) => s + g.tasks.length, 0),
    0,
  );
}

const ARITHMETIC_SECTION_ID = 'sec_arithmetic';

export function mergeIntoContent(content: MathMachineContent): MathMachineContent {
  const newTopics: Record<string, Topic> = { ...content.topics };
  const newGroups: Record<string, Group> = { ...content.groups };
  const newTasks: Record<string, Task> = { ...content.tasks };
  const newTopicIds: string[] = [];

  for (const topic of WAVE2_TOPICS) {
    if (newTopics[topic.id]) {
      throw new Error(`Topic id already exists, refusing to overwrite: ${topic.id}`);
    }
    const groupIds: string[] = [];
    for (const group of topic.groups) {
      if (newGroups[group.id]) {
        throw new Error(`Group id already exists, refusing to overwrite: ${group.id}`);
      }
      for (const task of group.tasks) {
        if (newTasks[task.id]) {
          throw new Error(`Task id already exists, refusing to overwrite: ${task.id}`);
        }
        newTasks[task.id] = task;
      }
      newGroups[group.id] = { id: group.id, name: group.name, taskIds: group.tasks.map((t) => t.id) };
      groupIds.push(group.id);
    }
    newTopics[topic.id] = { id: topic.id, name: topic.name, groupIds };
    newTopicIds.push(topic.id);
  }

  if (!content.sections.some((s) => s.id === ARITHMETIC_SECTION_ID)) {
    throw new Error(`Section ${ARITHMETIC_SECTION_ID} not found — cannot attach wave 2 topics`);
  }
  const newSections = content.sections.map((section) =>
    section.id === ARITHMETIC_SECTION_ID
      ? { ...section, topicIds: [...section.topicIds, ...newTopicIds] }
      : section,
  );

  return { ...content, sections: newSections, topics: newTopics, groups: newGroups, tasks: newTasks };
}
```

- [ ] **Step 4: Запустить тесты и убедиться, что они проходят**

Run: `cd packages/player && node --experimental-strip-types --test src/mathmachine/content/generateWave2Content.test.ts`
Expected: PASS, все 8 тестов зелёные.

- [ ] **Step 5: Закоммитить**

```bash
git add packages/player/src/mathmachine/content/generateWave2Content.ts packages/player/src/mathmachine/content/generateWave2Content.test.ts
git commit -m "feat(mathmachine): add offline content generator for Этап 2b wave 2 (76 tasks, 5 topics, position-invariant from day one)"
```

---

### Task 4: Материализовать контент в `pilotContent.json`

**Files:**
- Create: `packages/player/src/mathmachine/content/runGenerateWave2.ts`
- Modify: `packages/player/src/mathmachine/content/pilotContent.json` (через запуск скрипта, не вручную)
- Modify: `packages/player/src/mathmachine/content/pilotContent.test.ts`

**Interfaces:**
- Consumes: `mergeIntoContent`/`countWave2Tasks` из Задачи 3.
- Produces: обновлённый `pilotContent.json` — 12 тем (было 7), 174 задания (было 98).

- [ ] **Step 1: Создать `runGenerateWave2.ts`**

Создай `packages/player/src/mathmachine/content/runGenerateWave2.ts`:

```ts
// Разовый CLI-скрипт: применяет offline-генератор Этапа 2b, волна 2, к
// pilotContent.json. Не часть рантайма плеера. Запуск (из любой директории):
// node --experimental-strip-types packages/player/src/mathmachine/content/runGenerateWave2.ts

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { MathMachineContent } from '@kiosk/shared';
import { mergeIntoContent, countWave2Tasks } from './generateWave2Content.ts';

const contentPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'pilotContent.json');
const content = JSON.parse(fs.readFileSync(contentPath, 'utf-8')) as MathMachineContent;
const merged = mergeIntoContent(content);
fs.writeFileSync(contentPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
console.log(`Wave 2: added ${countWave2Tasks()} tasks across 5 topics to ${contentPath}`);
```

- [ ] **Step 2: Запустить скрипт**

Run: `cd packages/player && node --experimental-strip-types src/mathmachine/content/runGenerateWave2.ts`
Expected: выводит `Wave 2: added 76 tasks across 5 topics to .../pilotContent.json`.

Проверь через `git diff --stat packages/player/src/mathmachine/content/pilotContent.json`, что изменения — только добавления (существующий контент волны 1 и Этапа 1 не тронут). **Если файл на диске в этот момент отформатирован не как обычный `JSON.stringify(x, null, 2)`** (например, из-за стороннего редактирования между волнами), диф может показать переформатирование всего файла — это тот же класс ситуации, что уже был явно разобран и принят в волне 1 (см. ledger этого плана при выполнении или коммит `21d17e0` для истории): если так, проверяй через `JSON.parse` + сравнение объектов, что данные волны 1 и Этапа 1 не изменились по значению, а не через построчный текстовый diff.

- [ ] **Step 3: Обновить `pilotContent.test.ts` под новый объём контента**

В `packages/player/src/mathmachine/content/pilotContent.test.ts`, найди тест про количество тем (после волны 1 он утверждает 7 тем/98 заданий) и замени оба числа:

Find:
```ts
test('pilotContent has exactly seven topics (2 from Этап 1 + 5 from Этап 2b wave 1) with at least one group each', () => {
  const parsed = MathMachineContentSchema.parse(pilotContent);
  const topicIds = Object.keys(parsed.topics);
  assert.equal(topicIds.length, 7);
  for (const id of topicIds) {
    assert.ok(parsed.topics[id].groupIds.length >= 1);
  }
});

test('pilotContent has exactly 98 tasks (18 from Этап 1 + 80 from Этап 2b wave 1)', () => {
  const parsed = MathMachineContentSchema.parse(pilotContent);
  assert.equal(Object.keys(parsed.tasks).length, 98);
});
```

Replace with:
```ts
test('pilotContent has exactly twelve topics (2 from Этап 1 + 5 from wave 1 + 5 from wave 2) with at least one group each', () => {
  const parsed = MathMachineContentSchema.parse(pilotContent);
  const topicIds = Object.keys(parsed.topics);
  assert.equal(topicIds.length, 12);
  for (const id of topicIds) {
    assert.ok(parsed.topics[id].groupIds.length >= 1);
  }
});

test('pilotContent has exactly 174 tasks (18 from Этап 1 + 80 from wave 1 + 76 from wave 2)', () => {
  const parsed = MathMachineContentSchema.parse(pilotContent);
  assert.equal(Object.keys(parsed.tasks).length, 174);
});
```

(If the exact text above doesn't match the current file character-for-character — e.g. if wave 1's fix round changed something nearby — read the file first and adapt the find/replace to the ACTUAL current content, keeping the same intent: update both hardcoded numbers to 12 topics / 174 tasks.)

- [ ] **Step 4: Запустить тесты контента и убедиться, что они проходят**

Run: `cd packages/player && node --experimental-strip-types --test src/mathmachine/content/pilotContent.test.ts`
Expected: PASS, все тесты зелёные.

- [ ] **Step 5: Прогнать полный тестовый набор пакета**

Run: `cd packages/player && npm test`
Expected: все тесты зелёные.

- [ ] **Step 6: Закоммитить**

```bash
git add packages/player/src/mathmachine/content/runGenerateWave2.ts packages/player/src/mathmachine/content/pilotContent.json packages/player/src/mathmachine/content/pilotContent.test.ts
git commit -m "feat(mathmachine): materialize Этап 2b wave 2 content (174 tasks, 12 topics)"
```

---

### Task 5: Живая проверка (packaged Electron + CDP)

**Files:** нет изменений кода, если живая проверка не найдёт багов.

**Interfaces:** нет новых — верифицирует поведение всего, что произвели Задачи 1-4.

- [ ] **Step 1: Собрать и запустить пакетированный Electron**

Тот же процесс, что и в предыдущих финальных живых проверках этого виджета: собрать `packages/chrono-ui`, если не собран; подставить в `packages/player/electron/project.json` проект с виджетом `mathmachine`; `cd packages/player && npm run package`; запустить `dist-electron/win-unpacked/Музей СВО.exe --remote-debugging-port=9333`; подключиться через CDP.

- [ ] **Step 2: Пройти по одному заданию каждого из 5 новых типов**

Через каталог заданий («Задания» → новые темы «Умножение», «Деление», «Кратные», «Оценки», «Порядковые числительные»): для КАЖДОГО типа прочитать реальный текст обучающего задания, вычислить правильный ответ вручную ДО клика (не подбирать методом «любая кнопка» — урок финального ревью волны 1), ввести/выбрать именно это значение, убедиться в зелёной обратной связи и переходе к следующему заданию. Отдельно для Деления и Кратных (choice-mode) — убедиться, что кнопка с правильным значением реально присутствует среди вариантов. Проверить, что неверный ответ на первой попытке показывает подсказку из `HINTS`, специфичную для типа.

- [ ] **Step 3: Проверить консоль на отсутствие ошибок**

CDP-монитор (`Runtime.consoleAPICalled`/`Runtime.exceptionThrown`) за весь сценарий Step 2. Ожидается пустой лог.

- [ ] **Step 4: Прогнать полный юнит-тестовый набор**

Run: `cd packages/player && npm test`
Expected: все тесты зелёные (174 задания, 12 тем подтверждены тестом из Задачи 4).

Run: `cd packages/shared && npx tsx --test $(find src -name "*.test.ts")` (bash) или эквивалент.
Expected: все тесты зелёные.

- [ ] **Step 5: Откат временных правок и уборка**

```bash
git checkout -- packages/player/electron/project.json
git status --short packages/player/dist-electron
```
Убить процесс `Музей СВО.exe`, если запущен. Удалить временные CDP-скрипты/логи из scratch-директории. Проверить, не осталось ли файла живого прогресса (`%APPDATA%/kiosk-mathmachine/userdata.json`), способного сломать несвязанный юнит-тест при повторном запуске `npm test` (известная особенность из волны 1 — если он появился, удалить и перезапустить тесты, код не трогать).

- [ ] **Step 6: Зафиксировать результат**

Если живая проверка нашла реальный баг — исправить в соответствующем файле (Задача 1-4), повторить Steps 1-4, закоммитить фикс отдельным коммитом (`fix(mathmachine): ...`) с пометкой, что баг найден именно живой проверкой. Если багов не найдено — дополнительный коммит не требуется.

---
