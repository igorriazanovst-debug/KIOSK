# Тип 6 «Матемашка» — Этап 2b, волна 1: пять новых типов заданий и контент — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить в движок «Матемашки» пять новых типов заданий (Вычитание, Сравнение, Цифры, Состав числа, Упорядочение) и наполнить каталог реальным контентом через offline-генератор, доводя покрытие категорий ТЗ (FR-022) с 2 до 7 из 13.

**Architecture:** Каждый новый тип задания — регистрация в `TASK_TYPE_REGISTRY` (переиспользует уже существующие `numericCheck`/`choiceCheck` — новой логики проверки не требуется) + новый кейс рендера в `TaskVisual.tsx` + подсказка в `TaskRunner.tsx`. Контент — offline-генератор (чистые функции, детерминированная перечислением, без RNG) материализует статические записи `Task`/`Group`/`Topic` в `pilotContent.json` один раз при сборке контента; рантайм (`CatalogScreen.tsx`, прогресс) не меняется.

**Tech Stack:** TypeScript, zod (`packages/shared`), React (`packages/player`), `node:test`/`node:assert/strict`.

**Spec:** `docs/superpowers/specs/2026-09-08-mathmachine-content-pipeline-design.md`

## Global Constraints

- Ни один из 5 новых типов не меняет `AnswerInput.tsx` или общий движок проверки ответов (`checkTaskAnswer`/`getAnswerMode` в `taskEngine.ts`) — только регистрация в `TASK_TYPE_REGISTRY` с уже существующими `numericCheck`/`choiceCheck` (спека разд. 1, "без новых UI-парадигм").
- Параметры заданий (`TaskParamsSchema`) допускают только `number` и `number[]` — направление вопроса («больше/меньше», «наименьшее/наибольшее») кодируется числовым полем `direction` (`1` или `0`), не строкой.
- Визуал новых типов — простая геометрия/текст в стиле уже существующих кейсов `TaskVisual.tsx` (спека разд. 3) — без арта через syntx.ai в этой волне.
- Контент генерируется offline-скриптом, результат — обычный статический `pilotContent.json`, которым пользуется рантайм без изменений (спека разд. 1) — генератор не запускается и не импортируется плеером в браузере/Electron.
- «Проценты» из ТЗ FR-022 сознательно не реализуются в этой волне (спека разд. 2) — задача не создаётся.
- Тестовые файлы используют явное расширение `.ts` в относительных импортах (`from './taskEngine.ts'`) — установленная конвенция репозитория для `node --experimental-strip-types --test`.
- `packages/player/package.json`'s `"test"` script уже глобит `src/mathmachine/content/*.test.ts` и `src/mathmachine/*.test.ts` — новые тестовые файлы подхватятся автоматически, package.json трогать не нужно.
- Ветка — существующая `feat/mathmachine-widget` (не создавать новую), продолжение той же фичи.

---

### Task 1: Регистрация 5 новых типов заданий (схема + движок + подсказки)

**Files:**
- Modify: `packages/shared/src/mathmachine/model/schema.ts:22-28`
- Modify: `packages/shared/src/mathmachine/model/schema.test.ts`
- Modify: `packages/shared/src/mathmachine/taskEngine.ts:25-31`
- Modify: `packages/shared/src/mathmachine/taskEngine.test.ts`
- Modify: `packages/player/src/mathmachine/TaskRunner.tsx:18-24`

**Interfaces:**
- Consumes: ничего нового — расширяет уже существующие `TASK_TYPE_IDS`/`TASK_TYPE_REGISTRY`/`HINTS`.
- Produces (используется Задачей 2 и Задачей 3): пять новых `TaskTypeId` — `'number_subtract_two'`, `'number_compare'`, `'digit_recognition'`, `'number_composition'`, `'number_ordering'` — все зарегистрированы с `answerMode` и присутствуют в `HINTS`, иначе `tsc` упадёт (`HINTS` типизирован как `Record<Task['typeId'], string>` — исчерпывающая запись, не допускающая пропущенных ключей).

- [ ] **Step 1: Написать падающий тест схемы**

В `packages/shared/src/mathmachine/model/schema.test.ts` добавь `TaskTypeIdSchema` в список импортов (строка 3-15, после `TaskSchema,`):

```ts
import {
  MediaAssetSchema,
  TaskSchema,
  TaskTypeIdSchema,
  GroupSchema,
  TopicSchema,
  SectionSchema,
  MathToolSchema,
  MathMachineContentSchema,
  MATHMACHINE_CONTENT_SCHEMA_VERSION,
  GroupProgressSchema,
  MathMachineUserDataSchema,
  MATHMACHINE_USERDATA_SCHEMA_VERSION,
} from './schema.ts';
```

И добавь в конец файла:

```ts
test('TaskTypeIdSchema accepts the five Этап 2b wave 1 task types', () => {
  const wave1Types = ['number_subtract_two', 'number_compare', 'digit_recognition', 'number_composition', 'number_ordering'];
  for (const id of wave1Types) {
    assert.equal(TaskTypeIdSchema.safeParse(id).success, true, `expected ${id} to be a valid TaskTypeId`);
  }
});
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

Run: `cd packages/shared && npx tsx --test src/mathmachine/model/schema.test.ts`
Expected: FAIL — новые id ещё не входят в `TASK_TYPE_IDS`.

- [ ] **Step 3: Расширить `TASK_TYPE_IDS`**

В `packages/shared/src/mathmachine/model/schema.ts`, замени (строки 21-28):

```ts
/** Пилотные типы заданий Этапа 1 (спека, разд. 4). Этап 2 расширит список. */
export const TASK_TYPE_IDS = [
  'number_counting',
  'number_sum_two',
  'number_sum_three',
  'number_missing',
  'compare_length',
] as const;
```

на:

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

- [ ] **Step 4: Запустить тест схемы и убедиться, что он проходит**

Run: `cd packages/shared && npx tsx --test src/mathmachine/model/schema.test.ts`
Expected: PASS, все тесты в файле зелёные.

- [ ] **Step 5: Написать падающие тесты движка**

В `packages/shared/src/mathmachine/taskEngine.test.ts` добавь после существующих констант (после строки 10) новые тестовые задания:

```ts
const subtractTask: Task = {
  id: 't3', typeId: 'number_subtract_two', text: 'Сколько будет 5 минус 2?', params: { a: 5, b: 2 },
  correctAnswer: 3,
};
const numberCompareTask: Task = {
  id: 't4', typeId: 'number_compare', text: 'Какое число больше: 3 или 7?', params: { a: 3, b: 7, direction: 0 },
  correctAnswer: 7, choices: [3, 7],
};
const digitTask: Task = {
  id: 't5', typeId: 'digit_recognition', text: 'Найди цифру 4', params: { target: 4 },
  correctAnswer: 4, choices: [4, 3, 5],
};
const compositionTask: Task = {
  id: 't6', typeId: 'number_composition', text: '5 = 2 + ?', params: { whole: 5, knownPart: 2 },
  correctAnswer: 3,
};
const orderingTask: Task = {
  id: 't7', typeId: 'number_ordering', text: 'Какое число самое маленькое?', params: { series: [4, 7, 2], direction: 1 },
  correctAnswer: 2, choices: [4, 7, 2],
};
```

И в конец файла (после существующего последнего теста):

```ts
test('getAnswerMode returns the right mode for each Этап 2b wave 1 type', () => {
  assert.equal(getAnswerMode('number_subtract_two'), 'numeric');
  assert.equal(getAnswerMode('number_compare'), 'choice');
  assert.equal(getAnswerMode('digit_recognition'), 'choice');
  assert.equal(getAnswerMode('number_composition'), 'numeric');
  assert.equal(getAnswerMode('number_ordering'), 'choice');
});

test('checkTaskAnswer validates each Этап 2b wave 1 type correctly', () => {
  assert.equal(checkTaskAnswer(subtractTask, 3), true);
  assert.equal(checkTaskAnswer(subtractTask, 4), false);
  assert.equal(checkTaskAnswer(numberCompareTask, 7), true);
  assert.equal(checkTaskAnswer(numberCompareTask, 3), false);
  assert.equal(checkTaskAnswer(digitTask, 4), true);
  assert.equal(checkTaskAnswer(digitTask, 3), false);
  assert.equal(checkTaskAnswer(compositionTask, 3), true);
  assert.equal(checkTaskAnswer(compositionTask, 2), false);
  assert.equal(checkTaskAnswer(orderingTask, 2), true);
  assert.equal(checkTaskAnswer(orderingTask, 7), false);
});
```

- [ ] **Step 6: Запустить тесты движка и убедиться, что они падают**

Run: `cd packages/shared && npx tsx --test src/mathmachine/taskEngine.test.ts`
Expected: FAIL — новые типы ещё не зарегистрированы в `TASK_TYPE_REGISTRY` (`getAnswerMode`/`checkTaskAnswer` бросят `Unknown task type`).

- [ ] **Step 7: Зарегистрировать 5 новых типов в `TASK_TYPE_REGISTRY`**

В `packages/shared/src/mathmachine/taskEngine.ts`, замени (строки 25-31):

```ts
export const TASK_TYPE_REGISTRY: Record<TaskTypeId, TaskTypeDefinition> = {
  number_counting: { id: 'number_counting', answerMode: 'numeric', checkAnswer: numericCheck },
  number_sum_two: { id: 'number_sum_two', answerMode: 'numeric', checkAnswer: numericCheck },
  number_sum_three: { id: 'number_sum_three', answerMode: 'numeric', checkAnswer: numericCheck },
  number_missing: { id: 'number_missing', answerMode: 'numeric', checkAnswer: numericCheck },
  compare_length: { id: 'compare_length', answerMode: 'choice', checkAnswer: choiceCheck },
};
```

на:

```ts
export const TASK_TYPE_REGISTRY: Record<TaskTypeId, TaskTypeDefinition> = {
  number_counting: { id: 'number_counting', answerMode: 'numeric', checkAnswer: numericCheck },
  number_sum_two: { id: 'number_sum_two', answerMode: 'numeric', checkAnswer: numericCheck },
  number_sum_three: { id: 'number_sum_three', answerMode: 'numeric', checkAnswer: numericCheck },
  number_missing: { id: 'number_missing', answerMode: 'numeric', checkAnswer: numericCheck },
  compare_length: { id: 'compare_length', answerMode: 'choice', checkAnswer: choiceCheck },
  number_subtract_two: { id: 'number_subtract_two', answerMode: 'numeric', checkAnswer: numericCheck },
  number_compare: { id: 'number_compare', answerMode: 'choice', checkAnswer: choiceCheck },
  digit_recognition: { id: 'digit_recognition', answerMode: 'choice', checkAnswer: choiceCheck },
  number_composition: { id: 'number_composition', answerMode: 'numeric', checkAnswer: numericCheck },
  number_ordering: { id: 'number_ordering', answerMode: 'choice', checkAnswer: choiceCheck },
};
```

- [ ] **Step 8: Запустить тесты движка и убедиться, что они проходят**

Run: `cd packages/shared && npx tsx --test src/mathmachine/taskEngine.test.ts`
Expected: PASS, все тесты зелёные.

- [ ] **Step 9: Пересобрать `packages/shared`**

Run: `cd packages/shared && npm run build`
Expected: успешная сборка. Если сломан симлинк `node_modules/@kiosk/shared` в `packages/player` — пересоздать перед Step 10.

- [ ] **Step 10: Обновить `HINTS` в `TaskRunner.tsx` (иначе `tsc` упадёт — `Record<Task['typeId'], string>` требует все ключи)**

В `packages/player/src/mathmachine/TaskRunner.tsx`, замени (строки 18-24):

```ts
const HINTS: Record<Task['typeId'], string> = {
  number_counting: 'Посчитай предметы по одному, указывая на каждый пальцем.',
  number_sum_two: 'Сложи первое число со вторым — можно посчитать на пальцах.',
  number_sum_three: 'Складывай числа по порядку, слева направо.',
  number_missing: 'Посмотри, на сколько увеличивается каждое следующее число в ряду.',
  compare_length: 'Сравни отрезки — посмотри, какой из них длиннее визуально.',
};
```

на:

```ts
const HINTS: Record<Task['typeId'], string> = {
  number_counting: 'Посчитай предметы по одному, указывая на каждый пальцем.',
  number_sum_two: 'Сложи первое число со вторым — можно посчитать на пальцах.',
  number_sum_three: 'Складывай числа по порядку, слева направо.',
  number_missing: 'Посмотри, на сколько увеличивается каждое следующее число в ряду.',
  compare_length: 'Сравни отрезки — посмотри, какой из них длиннее визуально.',
  number_subtract_two: 'Убери из первого числа второе — можно посчитать на пальцах.',
  number_compare: 'Посмотри на оба числа и найди нужное — большее или меньшее.',
  digit_recognition: 'Вспомни, как выглядит эта цифра, и найди такую же среди вариантов.',
  number_composition: 'Подумай, сколько нужно прибавить к известной части, чтобы получить целое число.',
  number_ordering: 'Сравни все числа между собой, чтобы найти нужное.',
};
```

- [ ] **Step 11: Проверить сборку TypeScript**

Run: `cd packages/player && npx tsc --noEmit`
Expected: без новых ошибок типов (в частности, `HINTS`'s exhaustiveness check проходит).

- [ ] **Step 12: Закоммитить**

```bash
git add packages/shared/src/mathmachine/model/schema.ts packages/shared/src/mathmachine/model/schema.test.ts packages/shared/src/mathmachine/taskEngine.ts packages/shared/src/mathmachine/taskEngine.test.ts packages/player/src/mathmachine/TaskRunner.tsx
git commit -m "feat(mathmachine): register 5 Этап 2b wave 1 task types (subtract/compare/digits/composition/ordering)"
```

---

### Task 2: Визуал новых типов заданий в `TaskVisual.tsx`

**Files:**
- Modify: `packages/player/src/mathmachine/TaskVisual.tsx`

**Interfaces:**
- Consumes: 5 `TaskTypeId` из Задачи 1.
- Produces: ничего нового для последующих задач — чисто рендер, используется существующим `TaskRunner.tsx` (уже импортирует `TaskVisual`, не требует изменений).

Без автотеста (см. Global Constraints Этапа 2a — тот же принцип: простой презентационный компонент без React-тестовой инфраструктуры). `tsc --noEmit` — единственная механическая проверка здесь, полная верификация — в Задаче 5 (живая проверка).

- [ ] **Step 1: Добавить 5 новых кейсов в `switch`**

В `packages/player/src/mathmachine/TaskVisual.tsx`, найди блок:

```tsx
    case 'compare_length': {
      const left = Number(task.params.leftLength ?? 1);
      const right = Number(task.params.rightLength ?? 1);
      return (
        <div style={barsColumnStyle}>
          <div style={{ ...barStyle, width: left * 20 }} />
          <div style={{ ...barStyle, width: right * 20, background: '#e67e22' }} />
        </div>
      );
    }
    default:
      return null;
```

Замени на:

```tsx
    case 'compare_length': {
      const left = Number(task.params.leftLength ?? 1);
      const right = Number(task.params.rightLength ?? 1);
      return (
        <div style={barsColumnStyle}>
          <div style={{ ...barStyle, width: left * 20 }} />
          <div style={{ ...barStyle, width: right * 20, background: '#e67e22' }} />
        </div>
      );
    }
    case 'number_subtract_two':
      return <div style={equationStyle}>{String(task.params.a)} - {String(task.params.b)} = ?</div>;
    case 'number_compare': {
      const a = String(task.params.a);
      const b = String(task.params.b);
      return <div style={equationStyle}>{a} &nbsp;&nbsp;&nbsp; {b}</div>;
    }
    case 'digit_recognition':
      return <div style={equationStyle}>{String(task.params.target)}</div>;
    case 'number_composition':
      return <div style={equationStyle}>{String(task.params.whole)} = {String(task.params.knownPart)} + ?</div>;
    case 'number_ordering': {
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
git commit -m "feat(mathmachine): render 5 Этап 2b wave 1 task types in TaskVisual"
```

---

### Task 3: Offline-генератор контента волны 1 (чистая логика)

**Files:**
- Create: `packages/player/src/mathmachine/content/generateWave1Content.ts`
- Test: `packages/player/src/mathmachine/content/generateWave1Content.test.ts`

**Interfaces:**
- Consumes: 5 `TaskTypeId` из Задачи 1, типы `MathMachineContent`/`Task`/`Group`/`Topic` из `@kiosk/shared`.
- Produces (используется Задачей 4):
  - `WAVE1_TOPICS: TopicSpec[]` (5 элементов, по одному на категорию)
  - `countWave1Tasks(): number`
  - `mergeIntoContent(content: MathMachineContent): MathMachineContent`

Это чистый модуль без побочных эффектов (никакого чтения/записи файлов) — файловый ввод-вывод изолирован в Задаче 4.

- [ ] **Step 1: Написать падающие тесты**

Создай `packages/player/src/mathmachine/content/generateWave1Content.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MathMachineContentSchema, type MathMachineContent } from '@kiosk/shared';
import { WAVE1_TOPICS, countWave1Tasks, mergeIntoContent } from './generateWave1Content.ts';

test('countWave1Tasks returns the exact expected total (17+17+10+20+16)', () => {
  assert.equal(countWave1Tasks(), 80);
});

test('WAVE1_TOPICS has exactly 5 topics, one per Этап 2b wave 1 category', () => {
  assert.equal(WAVE1_TOPICS.length, 5);
});

test('no duplicate topic, group, or task ids across all of WAVE1_TOPICS', () => {
  const topicIds = new Set<string>();
  const groupIds = new Set<string>();
  const taskIds = new Set<string>();
  for (const topic of WAVE1_TOPICS) {
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

test('every generated task has a correctAnswer consistent with its own params', () => {
  for (const topic of WAVE1_TOPICS) {
    for (const group of topic.groups) {
      for (const task of group.tasks) {
        if (task.typeId === 'number_subtract_two') {
          const { a, b } = task.params as { a: number; b: number };
          assert.equal(task.correctAnswer, a - b);
          assert.ok(a - b >= 1, `subtraction result must be positive: ${task.id}`);
        }
        if (task.typeId === 'number_compare') {
          const { a, b, direction } = task.params as { a: number; b: number; direction: number };
          const expected = direction === 1 ? Math.min(a, b) : Math.max(a, b);
          assert.equal(task.correctAnswer, expected);
          assert.deepEqual(task.choices, [a, b]);
        }
        if (task.typeId === 'digit_recognition') {
          const { target } = task.params as { target: number };
          assert.equal(task.correctAnswer, target);
          assert.ok(Array.isArray(task.choices) && task.choices.length === 3);
          assert.ok(new Set(task.choices).size === 3, `choices must be distinct: ${task.id}`);
          assert.ok(task.choices!.includes(target));
        }
        if (task.typeId === 'number_composition') {
          const { whole, knownPart } = task.params as { whole: number; knownPart: number };
          assert.equal(task.correctAnswer, whole - knownPart);
          assert.ok(whole - knownPart >= 1, `composition remainder must be positive: ${task.id}`);
        }
        if (task.typeId === 'number_ordering') {
          const { series, direction } = task.params as { series: number[]; direction: number };
          const expected = direction === 1 ? Math.min(...series) : Math.max(...series);
          assert.equal(task.correctAnswer, expected);
          assert.deepEqual(task.choices, series);
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

test('mergeIntoContent adds all wave 1 topics without touching existing content', () => {
  const merged = mergeIntoContent(BASE_CONTENT);
  assert.ok(merged.topics.top_addition, 'existing topic must survive the merge');
  assert.equal(Object.keys(merged.topics).length, 1 + WAVE1_TOPICS.length);
  const arithmeticSection = merged.sections.find((s) => s.id === 'sec_arithmetic')!;
  assert.equal(arithmeticSection.topicIds.length, 1 + WAVE1_TOPICS.length);
  assert.equal(Object.keys(merged.tasks).length, 1 + countWave1Tasks());
});

test('mergeIntoContent throws instead of silently overwriting a colliding topic id', () => {
  const colliding: MathMachineContent = {
    ...BASE_CONTENT,
    topics: { ...BASE_CONTENT.topics, top_subtraction: { id: 'top_subtraction', name: 'existing', groupIds: ['x'] } },
  };
  assert.throws(() => mergeIntoContent(colliding), /top_subtraction/);
});

test('the merged content validates against MathMachineContentSchema', () => {
  const merged = mergeIntoContent(BASE_CONTENT);
  const result = MathMachineContentSchema.safeParse(merged);
  assert.equal(result.success, true, result.success ? '' : JSON.stringify((result as any).error?.issues, null, 2));
});
```

- [ ] **Step 2: Запустить тесты и убедиться, что они падают**

Run: `cd packages/player && node --experimental-strip-types --test src/mathmachine/content/generateWave1Content.test.ts`
Expected: FAIL с `ERR_MODULE_NOT_FOUND` (`./generateWave1Content.ts` ещё не существует).

- [ ] **Step 3: Реализовать `generateWave1Content.ts`**

Создай `packages/player/src/mathmachine/content/generateWave1Content.ts`:

```ts
// Offline-генератор контента Этапа 2b, волна 1 (спека
// docs/superpowers/specs/2026-09-08-mathmachine-content-pipeline-design.md,
// разд. 1-2). Чистые функции без побочных эффектов — файловый ввод-вывод
// в отдельном runGenerateWave1.ts. Перечисление детерминировано (без RNG) —
// для конечных арифметических диапазонов это проще и надёжнее случайной
// генерации: результат воспроизводим построчным чтением кода.

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

// ─── Вычитание (17 заданий: 9 + 8) ────────────────────────────────────

function subtractTask(a: number, b: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_subtract_two',
    text: `Сколько будет ${a} минус ${b}?`,
    params: { a, b },
    correctAnswer: a - b,
  };
}

function buildSubtractionTopic(): TopicSpec {
  const minus1 = buildGroup(
    'sub_b1',
    'Вычесть 1',
    Array.from({ length: 9 }, (_, i) => subtractTask(i + 2, 1)),
  );
  const minus2 = buildGroup(
    'sub_b2',
    'Вычесть 2',
    Array.from({ length: 8 }, (_, i) => subtractTask(i + 3, 2)),
  );
  return { id: 'top_subtraction', name: 'Вычитание', groups: [minus1, minus2] };
}

// ─── Сравнение (17 заданий: 9 + 8) ─────────────────────────────────────
// direction: 1 = спрашиваем "меньше" (ищем минимум); 0 = "больше" (максимум).

function numberCompareTask(a: number, b: number, direction: 0 | 1): Omit<Task, 'id'> {
  const question = direction === 1 ? 'меньше' : 'больше';
  const correct = direction === 1 ? Math.min(a, b) : Math.max(a, b);
  return {
    typeId: 'number_compare',
    text: `Какое число ${question}: ${a} или ${b}?`,
    params: { a, b, direction },
    correctAnswer: correct,
    choices: [a, b],
  };
}

function buildComparisonTopic(): TopicSpec {
  const askBigger = buildGroup(
    'cmp_next',
    'Сравнение соседних чисел',
    Array.from({ length: 9 }, (_, i) => numberCompareTask(i + 1, i + 2, 0)),
  );
  const askSmaller = buildGroup(
    'cmp_gap',
    'Сравнение через число',
    Array.from({ length: 8 }, (_, i) => numberCompareTask(i + 1, i + 3, 1)),
  );
  return { id: 'top_comparison', name: 'Сравнение чисел', groups: [askBigger, askSmaller] };
}

// ─── Цифры (10 заданий) ────────────────────────────────────────────────

function digitTask(target: number): Omit<Task, 'id'> {
  const distractors: number[] = [target - 1, target + 1].filter((d) => d >= 0 && d <= 9 && d !== target);
  let fallback = (target + 2) % 10;
  while (distractors.length < 2) {
    if (!distractors.includes(fallback) && fallback !== target) distractors.push(fallback);
    fallback = (fallback + 1) % 10;
  }
  return {
    typeId: 'digit_recognition',
    text: `Найди цифру ${target}`,
    params: { target },
    correctAnswer: target,
    choices: [target, ...distractors.slice(0, 2)],
  };
}

function buildDigitsTopic(): TopicSpec {
  const group = buildGroup(
    'digit',
    'Учим цифры 0-9',
    Array.from({ length: 10 }, (_, i) => digitTask(i)),
  );
  return { id: 'top_digits', name: 'Цифры', groups: [group] };
}

// ─── Состав числа (20 заданий: 10 + 10) ────────────────────────────────

function compositionTask(whole: number, knownPart: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_composition',
    text: `${whole} = ${knownPart} + ?`,
    params: { whole, knownPart },
    correctAnswer: whole - knownPart,
  };
}

function buildCompositionTopic(): TopicSpec {
  const small: Omit<Task, 'id'>[] = [];
  for (let whole = 2; whole <= 5; whole++) {
    for (let knownPart = 1; knownPart < whole; knownPart++) {
      small.push(compositionTask(whole, knownPart));
    }
  }
  const upTo5 = buildGroup('comp_5', 'Состав чисел до 5', small);

  const bigger: Omit<Task, 'id'>[] = [];
  for (let whole = 6; whole <= 10; whole++) {
    bigger.push(compositionTask(whole, 1));
    bigger.push(compositionTask(whole, whole - 1));
  }
  const upTo10 = buildGroup('comp_10', 'Состав чисел до 10', bigger);

  return { id: 'top_composition', name: 'Состав числа', groups: [upTo5, upTo10] };
}

// ─── Упорядочение (16 заданий: 8 + 8) ──────────────────────────────────
// direction: 1 = ищем наименьшее; 0 = ищем наибольшее (та же конвенция, что number_compare).

function orderingTask(series: number[], direction: 0 | 1): Omit<Task, 'id'> {
  const question = direction === 1 ? 'самое маленькое' : 'самое большое';
  const correct = direction === 1 ? Math.min(...series) : Math.max(...series);
  return {
    typeId: 'number_ordering',
    text: `Какое число ${question}?`,
    params: { series, direction },
    correctAnswer: correct,
    choices: [...series],
  };
}

function buildOrderingTopic(): TopicSpec {
  const findMin = buildGroup(
    'order_min',
    'Найди наименьшее',
    Array.from({ length: 8 }, (_, i) => orderingTask([i + 1, i + 4, i + 8], 1)),
  );
  const findMax = buildGroup(
    'order_max',
    'Найди наибольшее',
    Array.from({ length: 8 }, (_, i) => orderingTask([i + 1, i + 3, i + 6], 0)),
  );
  return { id: 'top_ordering', name: 'Порядок чисел', groups: [findMin, findMax] };
}

// ─── Сборка ─────────────────────────────────────────────────────────────

export const WAVE1_TOPICS: TopicSpec[] = [
  buildSubtractionTopic(),
  buildComparisonTopic(),
  buildDigitsTopic(),
  buildCompositionTopic(),
  buildOrderingTopic(),
];

export function countWave1Tasks(): number {
  return WAVE1_TOPICS.reduce(
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

  for (const topic of WAVE1_TOPICS) {
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
    throw new Error(`Section ${ARITHMETIC_SECTION_ID} not found — cannot attach wave 1 topics`);
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

Run: `cd packages/player && node --experimental-strip-types --test src/mathmachine/content/generateWave1Content.test.ts`
Expected: PASS, все 7 тестов зелёные.

- [ ] **Step 5: Закоммитить**

```bash
git add packages/player/src/mathmachine/content/generateWave1Content.ts packages/player/src/mathmachine/content/generateWave1Content.test.ts
git commit -m "feat(mathmachine): add offline content generator for Этап 2b wave 1 (80 tasks, 5 topics)"
```

---

### Task 4: Материализовать контент в `pilotContent.json`

**Files:**
- Create: `packages/player/src/mathmachine/content/runGenerateWave1.ts`
- Modify: `packages/player/src/mathmachine/content/pilotContent.json` (через запуск скрипта, не вручную)
- Modify: `packages/player/src/mathmachine/content/pilotContent.test.ts`

**Interfaces:**
- Consumes: `mergeIntoContent`/`countWave1Tasks` из Задачи 3.
- Produces: обновлённый `pilotContent.json` — 7 тем (было 2), 98 заданий (было 18) — используется рантаймом без изменений кода (`CatalogScreen.tsx` уже обходит `content.topics`/`content.groups` универсально).

- [ ] **Step 1: Создать `runGenerateWave1.ts`**

Создай `packages/player/src/mathmachine/content/runGenerateWave1.ts`:

```ts
// Разовый CLI-скрипт: применяет offline-генератор Этапа 2b, волна 1, к
// pilotContent.json. Не часть рантайма плеера, не импортируется приложением.
// Запуск: node --experimental-strip-types packages/player/src/mathmachine/content/runGenerateWave1.ts
// (путь к pilotContent.json резолвится от расположения этого файла, а не
// от текущей директории — можно запускать из любого места).

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { MathMachineContent } from '@kiosk/shared';
import { mergeIntoContent, countWave1Tasks } from './generateWave1Content.ts';

const contentPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'pilotContent.json');
const content = JSON.parse(fs.readFileSync(contentPath, 'utf-8')) as MathMachineContent;
const merged = mergeIntoContent(content);
fs.writeFileSync(contentPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
console.log(`Wave 1: added ${countWave1Tasks()} tasks across 5 topics to ${contentPath}`);
```

- [ ] **Step 2: Запустить скрипт**

Run: `cd packages/player && node --experimental-strip-types src/mathmachine/content/runGenerateWave1.ts`
Expected: выводит `Wave 1: added 80 tasks across 5 topics to .../pilotContent.json`, `git diff --stat packages/player/src/mathmachine/content/pilotContent.json` показывает существенный прирост файла (новые темы/группы/задания), существующие `top_addition`/`top_counting` и их задания не изменились (проверить: `git diff packages/player/src/mathmachine/content/pilotContent.json` не должен содержать удалений внутри старых секций, только добавления).

- [ ] **Step 3: Обновить `pilotContent.test.ts` под новый объём контента**

В `packages/player/src/mathmachine/content/pilotContent.test.ts`, замени:

```ts
test('pilotContent has exactly two topics with at least one group each', () => {
  const parsed = MathMachineContentSchema.parse(pilotContent);
  const topicIds = Object.keys(parsed.topics);
  assert.equal(topicIds.length, 2);
  for (const id of topicIds) {
    assert.ok(parsed.topics[id].groupIds.length >= 1);
  }
});
```

на:

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

- [ ] **Step 4: Запустить тесты контента и убедиться, что они проходят**

Run: `cd packages/player && node --experimental-strip-types --test src/mathmachine/content/pilotContent.test.ts`
Expected: PASS, все тесты зелёные (включая уже существующий тест "every task referenced by a group actually exists in tasks" — генератор гарантирует это по построению, но тест перепроверяет фактический файл на диске).

- [ ] **Step 5: Прогнать полный тестовый набор пакета**

Run: `cd packages/player && npm test`
Expected: все тесты зелёные, включая новые из Задач 1, 3 и обновлённые из этой задачи.

- [ ] **Step 6: Закоммитить**

```bash
git add packages/player/src/mathmachine/content/runGenerateWave1.ts packages/player/src/mathmachine/content/pilotContent.json packages/player/src/mathmachine/content/pilotContent.test.ts
git commit -m "feat(mathmachine): materialize Этап 2b wave 1 content (98 tasks, 7 topics)"
```

---

### Task 5: Живая проверка (packaged Electron + CDP)

**Files:** нет изменений кода, если живая проверка не найдёт багов (если найдёт — фикс-раунд по файлу(ам), вызвавшим баг, тем же процессом, что в предыдущих этапах).

**Interfaces:** нет новых — верифицирует поведение всего, что произвели Задачи 1-4.

- [ ] **Step 1: Собрать и запустить пакетированный Electron**

Тот же процесс, что и в предыдущих финальных живых проверках этого виджета: собрать `packages/chrono-ui`, если не собран; подставить в `packages/player/electron/project.json` проект с виджетом `mathmachine` (сохранить оригинал, восстановить после через `git checkout --`); `cd packages/player && npm run package`; запустить `dist-electron/win-unpacked/Музей СВО.exe --remote-debugging-port=9333`; подключиться через CDP (`ws`-пакет уже есть в `node_modules`).

- [ ] **Step 2: Пройти по одному заданию каждого из 5 новых типов**

Через каталог заданий («Задания» → новые темы «Вычитание», «Сравнение чисел», «Цифры», «Состав числа», «Порядок чисел»): открыть первое (обучающее) задание каждой новой темы, убедиться что: (а) текст задания и визуал (уравнение/числа) отображаются корректно и совпадают друг с другом; (б) режим ответа соответствует ожидаемому — числовая клавиатура для «Вычитание»/«Состав числа», кнопки-варианты для «Сравнение чисел»/«Цифры»/«Порядок чисел»; (в) правильный ответ засчитывается (зелёная обратная связ��, переход к следующему заданию); (г) неверный ответ на первой попытке показывает подсказку из `HINTS`, соответствующую типу задания. Сделать скриншот минимум одного задания каждого типа.

- [ ] **Step 3: Проверить консоль на отсутствие ошибок**

Через CDP слушать `Runtime.consoleAPICalled`/`Runtime.exceptionThrown` за весь сценарий Step 2 (открытие каждой из 5 новых тем + прохождение заданий). Ожидается пустой лог ошибок.

- [ ] **Step 4: Прогнать полный юнит-тестовый набор**

Run: `cd packages/player && npm test`
Expected: все тесты зелёные (98 заданий, 7 тем подтверждены тестом из Задачи 4).

Run: `cd packages/shared && npx tsx --test $(find src -name "*.test.ts")` (bash) или эквивалент на используемой ОС.
Expected: все тесты зелёные, включая новый тест `TaskTypeIdSchema` из Задачи 1.

- [ ] **Step 5: Откат временных правок и уборка**

```bash
git checkout -- packages/player/electron/project.json
git status --short packages/player/dist-electron
```
Убить процесс `Музей СВО.exe`, если ещё запущен. Удалить временные CDP-скрипты/логи из scratch-директории.

- [ ] **Step 6: Зафиксировать результат**

Если живая проверка нашла реальный баг — исправить в соответствующем файле (Задача 1-4), повторить Steps 1-4, закоммитить фикс отдельным коммитом (`fix(mathmachine): ...`) с пометкой, что баг найден именно живой проверкой. Если багов не найдено — дополнительный коммит не требуется.

---
