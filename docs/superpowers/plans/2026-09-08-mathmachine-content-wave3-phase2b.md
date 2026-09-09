# Тип 6 «Матемашка» — Этап 2b, волна 3 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить новый тип задания «Доли целого» (`share_of_whole`, закрывает последнюю категорию ТЗ FR-022 — «проценты», переосмысленную под возраст 4-9 лет) и углубить 4 существующие категории (Умножение, Деление, Сложение, Вычитание) новыми темами/группами, доведя каталог с 174 до 309 заданий (12→25 тем, 22→37 групп).

**Architecture:** Тот же offline-генератор без RNG, что и в волнах 1-2: чистые функции в `generateWave3Content.ts`, детерминированное перечисление диапазонов, материализация в `pilotContent.json` через отдельный CLI-скрипт `runGenerateWave3.ts`. Новый тип регистрируется в 4 местах (schema/engine/hints/visual), реиспользует существующие `numericCheck` — новой логики проверки не требуется.

**Tech Stack:** TypeScript, zod, node:test, React (TaskVisual/TaskRunner уже существуют).

**Spec:** `docs/superpowers/specs/2026-09-08-mathmachine-content-wave3-design.md`

## Global Constraints

- Единственный новый `TaskTypeId` в этой волне — `share_of_whole` (numeric-режим, реиспользует `numericCheck`). Все остальные новые темы используют уже существующие типы (`number_multiply_two`, `number_divide_remainder`, `number_sum_two`, `number_subtract_two`) — новых типов для них не создаётся.
- `share_of_whole`: params `{total, parts}`, `parts` — только `2` или `4`, `total` кратно `parts`, диапазон `total` 4-40. `correctAnswer = total / parts`. У заданий этого типа НЕТ поля `choices` (numeric-режим) — это проверяется отдельным тестом-негативом, не предполагается молча.
- Choice-режим есть только у углубления «Деления» (3 новые группы). Эти группы ОБЯЗАНЫ с первого коммита генератора проходить оба теста-инварианта, уже написанных в волне 2 (`generateWave2Content.test.ts`): «позиция правильного ответа в группе не константна» и «ни одна структурная эвристика (majority quotient+remainder, odd-quotient, odd-remainder) не решает всю группу». Эти тесты пишутся ВМЕСТЕ с генератором в Задаче 3, не постфактум — самый нагруженный процессный урок проекта (финальное ревью трижды подряд находило дефекты именно этого класса, когда тест писался позже кода).
- Деление: частное каждого показанного варианта (правильного и дистракторов) должно быть ≥1, остаток — ненулевой и в диапазоне `[0, b)`. Делимое — в диапазоне 3-50, делитель — 2-10 (спека Этапа 2b, волна 2, §1.2, тот же диапазон действует и здесь).
- Генератор этой волны — самодостаточный файл `generateWave3Content.ts` (по образцу волн 1-2): хелперы `buildGroup`/`rotate`/`mergeIntoContent`/`DIVISION_DECOY_SCHEMES`/`formatDivision` дублируются из `generateWave2Content.ts`, а не импортируются. (Пересмотр этого дублирования — явно вынесен за рамки волны 3, задача для планирования волны 4.)
- `pilotContent.json` меняется ТОЛЬКО через запуск `runGenerateWave3.ts` — никогда не редактируется руками.
- Не в объёме волны: арт через syntx.ai (простая геометрия/текст, как раньше), дробный ввод ответа, углубление остальных 8 категорий, полный количественный охват ТЗ (2800+/40+).

---

## Task 1: Регистрация типа `share_of_whole`

**Files:**
- Modify: `packages/shared/src/mathmachine/model/schema.ts`
- Modify: `packages/shared/src/mathmachine/model/schema.test.ts`
- Modify: `packages/shared/src/mathmachine/taskEngine.ts`
- Modify: `packages/shared/src/mathmachine/taskEngine.test.ts`
- Modify: `packages/player/src/mathmachine/TaskRunner.tsx`

**Interfaces:**
- Consumes: ничего из более ранних задач волны 3 (это первая задача).
- Produces: `TaskTypeId` union включает `'share_of_whole'`; `TASK_TYPE_REGISTRY['share_of_whole'] = { id: 'share_of_whole', answerMode: 'numeric', checkAnswer: numericCheck }`; `HINTS['share_of_whole']` — строка подсказки. Задача 2 (TaskVisual) и Задача 3 (генератор) полагаются на существование этого типа.

- [ ] **Step 1: Добавить `share_of_whole` в `TASK_TYPE_IDS`**

В `packages/shared/src/mathmachine/model/schema.ts` заменить:

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

на:

```ts
/** Типы заданий Этапа 1 + Этапа 2b, волны 1-3 (спеки 2026-09-08). */
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
  'share_of_whole',
] as const;
```

- [ ] **Step 2: Тест на схему**

Добавить в конец `packages/shared/src/mathmachine/model/schema.test.ts`:

```ts
test('TaskTypeIdSchema accepts the Этап 2b wave 3 task type (share_of_whole)', () => {
  assert.equal(TaskTypeIdSchema.safeParse('share_of_whole').success, true);
});
```

- [ ] **Step 3: Запустить тесты — упадёт таргетный тест НЕ должен, т.к. TASK_TYPE_IDS уже расширен Step 1; вместо этого запускаем как smoke-проверку**

Run: `cd packages/shared && npx tsx --test src/mathmachine/model/schema.test.ts`
Expected: PASS (все тесты, включая новый)

- [ ] **Step 4: Зарегистрировать `share_of_whole` в движке проверки**

В `packages/shared/src/mathmachine/taskEngine.ts` заменить:

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
  number_multiply_two: { id: 'number_multiply_two', answerMode: 'numeric', checkAnswer: numericCheck },
  number_divide_remainder: { id: 'number_divide_remainder', answerMode: 'choice', checkAnswer: choiceCheck },
  number_multiple_check: { id: 'number_multiple_check', answerMode: 'choice', checkAnswer: choiceCheck },
  round_to_ten: { id: 'round_to_ten', answerMode: 'numeric', checkAnswer: numericCheck },
  ordinal_position: { id: 'ordinal_position', answerMode: 'numeric', checkAnswer: numericCheck },
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
  number_multiply_two: { id: 'number_multiply_two', answerMode: 'numeric', checkAnswer: numericCheck },
  number_divide_remainder: { id: 'number_divide_remainder', answerMode: 'choice', checkAnswer: choiceCheck },
  number_multiple_check: { id: 'number_multiple_check', answerMode: 'choice', checkAnswer: choiceCheck },
  round_to_ten: { id: 'round_to_ten', answerMode: 'numeric', checkAnswer: numericCheck },
  ordinal_position: { id: 'ordinal_position', answerMode: 'numeric', checkAnswer: numericCheck },
  share_of_whole: { id: 'share_of_whole', answerMode: 'numeric', checkAnswer: numericCheck },
};
```

- [ ] **Step 5: Тесты движка**

Добавить в конец `packages/shared/src/mathmachine/taskEngine.test.ts`:

```ts
const shareTask: Task = {
  id: 'w3t1', typeId: 'share_of_whole',
  text: 'У Матвея 8 яблок. Он разделил их поровну на две части — сколько досталось на одну часть?',
  params: { total: 8, parts: 2 }, correctAnswer: 4,
};

test('getAnswerMode returns numeric for the Этап 2b wave 3 type (share_of_whole)', () => {
  assert.equal(getAnswerMode('share_of_whole'), 'numeric');
});

test('checkTaskAnswer validates share_of_whole correctly', () => {
  assert.equal(checkTaskAnswer(shareTask, 4), true);
  assert.equal(checkTaskAnswer(shareTask, 8), false);
  assert.equal(checkTaskAnswer(shareTask, '4'), true);
});
```

- [ ] **Step 6: Запустить тесты shared**

Run: `cd packages/shared && npx tsx --test $(find src -name "*.test.ts")`
Expected: все тесты PASS (324 + 3 новых = 327; TaskTypeIdSchema-тест из Step 2, getAnswerMode-тест и checkTaskAnswer-тест из Step 5)

- [ ] **Step 7: Добавить подсказку в `HINTS`**

В `packages/player/src/mathmachine/TaskRunner.tsx` заменить:

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
  number_multiply_two: 'Сложи первое число само с собой столько раз, сколько указывает второе.',
  number_divide_remainder: 'Подумай, сколько раз второе число помещается в первом, и что останется.',
  number_multiple_check: 'Проверь каждое число по очереди — делится ли оно без остатка.',
  round_to_ten: 'Посмотри на цифру единиц: если она 5 или больше — округляй вверх, иначе вниз.',
  ordinal_position: 'Посчитай числа по порядку слева направо, пока не дойдёшь до нужного места.',
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
  number_multiply_two: 'Сложи первое число само с собой столько раз, сколько указывает второе.',
  number_divide_remainder: 'Подумай, сколько раз второе число помещается в первом, и что останется.',
  number_multiple_check: 'Проверь каждое число по очереди — делится ли оно без остатка.',
  round_to_ten: 'Посмотри на цифру единиц: если она 5 или больше — округляй вверх, иначе вниз.',
  ordinal_position: 'Посчитай числа по порядку слева направо, пока не дойдёшь до нужного места.',
  share_of_whole: 'Раздели общее количество предметов поровну между всеми частями — можно раздавать по одному, пока не закончатся.',
};
```

**Важно:** `HINTS` — исчерпывающий `Record<Task['typeId'], string>`. Если пропустить этот шаг, `tsc --noEmit` в `packages/player` упадёт с ошибкой отсутствующего ключа — это единственный сигнал, который надёжно ловит забытую регистрацию.

- [ ] **Step 8: Проверить типы плеера**

Run: `cd packages/player && npx tsc --noEmit`
Expected: exit 0, без ошибок (в частности, без ошибки про отсутствующий ключ `share_of_whole` в `HINTS`)

- [ ] **Step 9: Коммит**

```bash
git add packages/shared/src/mathmachine/model/schema.ts packages/shared/src/mathmachine/model/schema.test.ts packages/shared/src/mathmachine/taskEngine.ts packages/shared/src/mathmachine/taskEngine.test.ts packages/player/src/mathmachine/TaskRunner.tsx
git commit -m "feat(mathmachine): register Этап 2b wave 3 task type (share_of_whole)"
```

---

## Task 2: `TaskVisual.tsx` — рендер `share_of_whole`

**Files:**
- Modify: `packages/player/src/mathmachine/TaskVisual.tsx`

**Interfaces:**
- Consumes: `TaskTypeId` включает `'share_of_whole'` (Задача 1); `task.params.total`, `task.params.parts` — оба `number` (схема `TaskParamsSchema` уже допускает `number` в `params`, без изменений).
- Produces: ничего, что нужно последующим задачам — TaskVisual не экспортирует ничего кроме компонента.

- [ ] **Step 1: Добавить case в switch**

В `packages/player/src/mathmachine/TaskVisual.tsx` заменить:

```tsx
    case 'ordinal_position': {
      const series = (task.params.series as unknown as number[]) ?? [];
      return <div style={equationStyle}>{series.join('   ')}</div>;
    }
    default:
      return null;
```

на:

```tsx
    case 'ordinal_position': {
      const series = (task.params.series as unknown as number[]) ?? [];
      return <div style={equationStyle}>{series.join('   ')}</div>;
    }
    case 'share_of_whole':
      return <div style={equationStyle}>{String(task.params.total)} : {String(task.params.parts)} = ?</div>;
    default:
      return null;
```

- [ ] **Step 2: Проверить типы**

Run: `cd packages/player && npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 3: Коммит**

```bash
git add packages/player/src/mathmachine/TaskVisual.tsx
git commit -m "feat(mathmachine): render Этап 2b wave 3 task type (share_of_whole) in TaskVisual"
```

---

## Task 3: `generateWave3Content.ts` — offline-генератор волны 3

**Files:**
- Create: `packages/player/src/mathmachine/content/generateWave3Content.ts`
- Create: `packages/player/src/mathmachine/content/generateWave3Content.test.ts`

**Interfaces:**
- Consumes: `Task`, `Group`, `Topic`, `MathMachineContent` из `@kiosk/shared`; `share_of_whole` typeId (Задача 1).
- Produces: `WAVE3_TOPICS: TopicSpec[]`, `countWave3Tasks(): number`, `mergeIntoContent(content: MathMachineContent): MathMachineContent` — те же имена/сигнатуры, что в `generateWave1Content.ts`/`generateWave2Content.ts` (Задача 4 полагается на эти три экспорта с этими именами).

**Важно перед началом:** это самодостаточный файл, ПО ОБРАЗЦУ `generateWave2Content.ts` — хелперы `buildGroup`, `rotate`, `DIVISION_DECOY_SCHEMES`, `formatDivision`, `mergeIntoContent` копируются с идентичной логикой (не импортируются). Прочитайте `packages/player/src/mathmachine/content/generateWave2Content.ts` целиком перед началом — там уже есть верно работающая реализация `buildGroup`/`rotate`/схемы дистракторов деления, которую нужно скопировать без изменений логики (только заголовок файла и содержимое волны меняются).

- [ ] **Step 1: Написать генератор**

Создать `packages/player/src/mathmachine/content/generateWave3Content.ts`:

```ts
// Offline-генератор контента Этапа 2b, волна 3 (спека
// docs/superpowers/specs/2026-09-08-mathmachine-content-wave3-design.md).
// Тот же принцип, что и в волнах 1-2 — чистые функции, детерминированное
// перечисление без RNG, файловый ввод-вывод вынесен в отдельный
// runGenerateWave3.ts. Единственная choice-группа этой волны — углубление
// «Деления» (3 новые темы) — с первого коммита проходит оба
// теста-инварианта волны 2 (позиция правильного ответа не константна;
// ни одна структурная эвристика не решает всю группу) — те же схемы
// дистракторов, что уже доказали себя в волне 2, скопированы без
// изменений. Хелперы buildGroup/rotate/DIVISION_DECOY_SCHEMES/
// formatDivision продублированы из generateWave2Content.ts, а не
// импортированы — каждый скрипт волны самодостаточен (решение спеки
// волны 2, разд. 3, подтверждено и здесь; пересмотр этого дублирования
// вынесен за рамки волны 3).

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

// ─── Доли целого (16 заданий: 8 + 8) — закрывает последнюю категорию ТЗ
// FR-022 («проценты»), переосмысленную под возраст 4-9 лет как деление
// целого на равные доли (решение пользователя). Numeric-режим — у
// заданий этого типа физически нет choices, поэтому класс дефекта
// «структурная решаемость по форме вариантов» (уроки волн 1-2) к нему
// неприменим; это явно проверяется тестом-негативом, а не подразумевается.

function shareTask(total: number, parts: 2 | 4): Omit<Task, 'id'> {
  const partsWord = parts === 2 ? 'две части' : 'четыре части';
  return {
    typeId: 'share_of_whole',
    text: `У Матвея ${total} яблок. Он разделил их поровну на ${partsWord} — сколько досталось на одну часть?`,
    params: { total, parts },
    correctAnswer: total / parts,
  };
}

const SHARE_HALF_TOTALS = [4, 6, 8, 10, 14, 18, 24, 30];
const SHARE_QUARTER_TOTALS = [8, 12, 16, 20, 24, 28, 32, 36];

function buildShareTopic(): TopicSpec {
  const half = buildGroup('share_half', 'Половина', SHARE_HALF_TOTALS.map((total) => shareTask(total, 2)));
  const quarter = buildGroup('share_quarter', 'Четверть', SHARE_QUARTER_TOTALS.map((total) => shareTask(total, 4)));
  return { id: 'top_shares', name: 'Доли целого', groups: [half, quarter] };
}

// ─── Умножение — 7 новых таблиц (70 заданий: 10 × 7) ────────────────────
// Волна 2 материализовала только таблицы ×2 и ×5 из разрешённого спекой
// диапазона a,b∈[1,10] — эта волна добавляет оставшиеся 7 таблиц. Один
// и тот же генераторный паттерн, что уже дал темы ×2/×5.

function multiplyTask(a: number, b: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_multiply_two',
    text: `Сколько будет ${a} умножить на ${b}?`,
    params: { a, b },
    correctAnswer: a * b,
  };
}

const MULTIPLICATION_TABLES = [3, 4, 6, 7, 8, 9, 10];

function buildMultiplicationTopic(b: number): TopicSpec {
  const group = buildGroup(
    `mult_by${b}`,
    `Таблица умножения на ${b}`,
    Array.from({ length: 10 }, (_, i) => multiplyTask(i + 1, b)),
  );
  return { id: `top_multiplication_${b}`, name: `Умножение на ${b}`, groups: [group] };
}

// ─── Деление — 3 новые темы (24 задания: 8 + 8 + 8) — делители 6-10 ─────
// Волна 2 материализовала только делители 2-5, делимое ≤13. Эта волна
// добавляет делители 6-10, впервые задействуя делимое до 50 (тема
// «Деление на 10»). Схема дистракторов и позиционная логика — БЕЗ
// ИЗМЕНЕНИЙ скопированы из generateWave2Content.ts (там уже независимо
// перепроверены финальным ревью волны 2 — цикл схем период 4, поворот
// кнопок период 3, взаимно просты, поэтому ни позиция, ни структура
// вариантов не выводятся друг из друга и ни одна структурная эвристика
// не решает больше половины группы). Пары (a,b) подобраны так же, как в
// волне 2: частное каждого показанного варианта ≥1 (значит исходное
// частное каждой пары ≥2 — иначе дистрактор "частное-1" ушёл бы в 0),
// остаток ненулевой, делимое в допустимом диапазоне 3-50.

const DIVISION_DECOY_SCHEMES: [number, number][][] = [
  [[0, 1], [-1, 0]],
  [[-1, 1], [-1, 2]],
  [[0, 1], [1, 1]],
  [[-1, 1], [1, 2]],
];

function formatDivision(quotient: number, remainder: number): string {
  return `${quotient} ост. ${remainder}`;
}

function divideTask(a: number, b: number, positionIndex: number): Omit<Task, 'id'> {
  const quotient = Math.floor(a / b);
  const remainder = a % b;
  const correct = formatDivision(quotient, remainder);
  const scheme = DIVISION_DECOY_SCHEMES[positionIndex % DIVISION_DECOY_SCHEMES.length];
  if (scheme.some(([dq]) => quotient + dq < 1)) {
    throw new Error(`Division decoy quotient would fall below 1 for ${a}:${b} — pick a pair with a bigger quotient`);
  }
  const options = [correct, ...scheme.map(([dq, dr]) => formatDivision(quotient + dq, (remainder + dr) % b))];
  if (new Set(options).size !== 3) {
    throw new Error(`Division decoys collided for ${a}:${b} — options: ${options.join(' | ')}`);
  }
  const choices = rotate(options, positionIndex);
  return {
    typeId: 'number_divide_remainder',
    text: `Сколько будет ${a} разделить на ${b}?`,
    params: { a, b },
    correctAnswer: correct,
    choices,
  };
}

const DIVISION_PAIRS_67: [number, number][] = [
  [13, 6], [19, 6], [25, 6], [31, 6],
  [15, 7], [22, 7], [29, 7], [36, 7],
];
const DIVISION_PAIRS_89: [number, number][] = [
  [17, 8], [25, 8], [33, 8], [41, 8],
  [19, 9], [28, 9], [37, 9], [46, 9],
];
const DIVISION_PAIRS_10: [number, number][] = [
  [21, 10], [24, 10], [27, 10], [33, 10],
  [36, 10], [38, 10], [41, 10], [47, 10],
];

function buildDivision67Topic(): TopicSpec {
  const group = buildGroup('div_67', 'Деление на 6 и 7', DIVISION_PAIRS_67.map(([a, b], i) => divideTask(a, b, i)));
  return { id: 'top_division_67', name: 'Деление на 6 и 7', groups: [group] };
}

function buildDivision89Topic(): TopicSpec {
  const group = buildGroup('div_89', 'Деление на 8 и 9', DIVISION_PAIRS_89.map(([a, b], i) => divideTask(a, b, i)));
  return { id: 'top_division_89', name: 'Деление на 8 и 9', groups: [group] };
}

function buildDivision10Topic(): TopicSpec {
  const group = buildGroup('div_10', 'Деление на 10', DIVISION_PAIRS_10.map(([a, b], i) => divideTask(a, b, i)));
  return { id: 'top_division_10', name: 'Деление на 10', groups: [group] };
}

// ─── Сложение — переход через десяток (9 заданий) ───────────────────────
// Волна 1/Этап 1 материализовали только суммы ≤10. Эта тема впервые
// вводит сумму, превышающую 10 (11-18) — переход через десяток.

function sumTwoTask(a: number, b: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_sum_two',
    text: `Сколько будет ${a} плюс ${b}?`,
    params: { a, b },
    correctAnswer: a + b,
  };
}

const ADDITION_CARRY_PAIRS: [number, number][] = [
  [2, 9], [3, 9], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [9, 8],
];

function buildAdditionCarryTopic(): TopicSpec {
  const group = buildGroup('add_carry', 'Сложение с переходом через десяток', ADDITION_CARRY_PAIRS.map(([a, b]) => sumTwoTask(a, b)));
  return { id: 'top_addition_carry', name: 'Сложение: переход через десяток', groups: [group] };
}

// ─── Вычитание — числа побольше (16 заданий: 8 + 8) ─────────────────────
// Волна 1 материализовала только вычитаемое 1 или 2, уменьшаемое ≤10.
// Эта тема расширяет уменьшаемое до 20 и вычитаемое до 9.

function subtractTwoTask(a: number, b: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_subtract_two',
    text: `Сколько будет ${a} минус ${b}?`,
    params: { a, b },
    correctAnswer: a - b,
  };
}

const SUBTRACT_WIDE_LOW: [number, number][] = [
  [4, 3], [12, 3], [19, 3], [5, 4], [14, 4], [20, 4], [6, 5], [17, 5],
];
const SUBTRACT_WIDE_HIGH: [number, number][] = [
  [7, 6], [18, 6], [8, 7], [19, 7], [9, 8], [20, 8], [10, 9], [19, 9],
];

function buildSubtractionWideTopic(): TopicSpec {
  const low = buildGroup('sub_wide_low', 'Вычесть 3, 4, 5', SUBTRACT_WIDE_LOW.map(([a, b]) => subtractTwoTask(a, b)));
  const high = buildGroup('sub_wide_high', 'Вычесть 6, 7, 8, 9', SUBTRACT_WIDE_HIGH.map(([a, b]) => subtractTwoTask(a, b)));
  return { id: 'top_subtraction_wide', name: 'Вычитание: числа побольше', groups: [low, high] };
}

// ─── Сборка ─────────────────────────────────────────────────────────────

export const WAVE3_TOPICS: TopicSpec[] = [
  buildShareTopic(),
  ...MULTIPLICATION_TABLES.map((b) => buildMultiplicationTopic(b)),
  buildDivision67Topic(),
  buildDivision89Topic(),
  buildDivision10Topic(),
  buildAdditionCarryTopic(),
  buildSubtractionWideTopic(),
];

export function countWave3Tasks(): number {
  return WAVE3_TOPICS.reduce(
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

  for (const topic of WAVE3_TOPICS) {
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
    throw new Error(`Section ${ARITHMETIC_SECTION_ID} not found — cannot attach wave 3 topics`);
  }
  const newSections = content.sections.map((section) =>
    section.id === ARITHMETIC_SECTION_ID
      ? { ...section, topicIds: [...section.topicIds, ...newTopicIds] }
      : section,
  );

  return { ...content, sections: newSections, topics: newTopics, groups: newGroups, tasks: newTasks };
}
```

- [ ] **Step 2: Запустить сборку типов, чтобы поймать опечатки до тестов**

Run: `cd packages/player && npx tsc --noEmit`
Expected: exit 0. Если генератор бросает `Error` при импорте (например, «Division decoy quotient would fall below 1» или «Division decoys collided») — это означает, что какая-то из пар `(a,b)` в `DIVISION_PAIRS_67`/`_89`/`_10` не проходит собственные защитные проверки генератора; замените конкретную пару на другую с тем же делителем и частным ≥2 (тот же класс правки, что уже случался в волне 2 — см. комментарий в `generateWave2Content.ts` про замену `7:5`/`8:5` на `17:5`/`18:5`).

- [ ] **Step 3: Написать тесты генератора**

Создать `packages/player/src/mathmachine/content/generateWave3Content.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MathMachineContentSchema, type MathMachineContent } from '@kiosk/shared';
import { WAVE3_TOPICS, countWave3Tasks, mergeIntoContent } from './generateWave3Content.ts';

test('countWave3Tasks returns the exact expected total (16+70+24+9+16)', () => {
  assert.equal(countWave3Tasks(), 135);
});

test('WAVE3_TOPICS has exactly 13 topics (1 доли + 7 умножение + 3 деление + 1 сложение + 1 вычитание)', () => {
  assert.equal(WAVE3_TOPICS.length, 13);
});

test('no duplicate topic, group, or task ids across all of WAVE3_TOPICS', () => {
  const topicIds = new Set<string>();
  const groupIds = new Set<string>();
  const taskIds = new Set<string>();
  for (const topic of WAVE3_TOPICS) {
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

// Урок волны 2, обобщённый до класса «правильный ответ не должен
// вычисляться из ФОРМЫ вариантов» — с первого коммита, не постфактум.

test('within every choice-mode group, the correct answer is not always at the same button position', () => {
  for (const topic of WAVE3_TOPICS) {
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

function parseDivisionOption(option: string): { quotient: number; remainder: number } {
  const match = /^(-?\d+) ост\. (\d+)$/.exec(option);
  assert.ok(match, `unparseable division option: ${option}`);
  return { quotient: Number(match![1]), remainder: Number(match![2]) };
}

function majorityOf(values: number[]): number | null {
  const winners = [...new Set(values)].filter((v) => values.filter((x) => x === v).length >= 2);
  return winners.length === 1 ? winners[0] : null;
}

function minorityOf(values: number[]): number | null {
  const singles = [...new Set(values)].filter((v) => values.filter((x) => x === v).length === 1);
  return singles.length === 1 ? singles[0] : null;
}

const DIVISION_SHORTCUTS: Record<string, (choices: string[]) => string | null> = {
  'majority quotient + majority remainder': (choices) => {
    const parsed = choices.map(parseDivisionOption);
    const quotient = majorityOf(parsed.map((p) => p.quotient));
    const remainder = majorityOf(parsed.map((p) => p.remainder));
    if (quotient === null || remainder === null) return null;
    const guess = `${quotient} ост. ${remainder}`;
    return choices.includes(guess) ? guess : null;
  },
  'the option with the odd-one-out quotient': (choices) => {
    const parsed = choices.map(parseDivisionOption);
    const quotient = minorityOf(parsed.map((p) => p.quotient));
    if (quotient === null) return null;
    return choices[parsed.findIndex((p) => p.quotient === quotient)];
  },
  'the option with the odd-one-out remainder': (choices) => {
    const parsed = choices.map(parseDivisionOption);
    const remainder = minorityOf(parsed.map((p) => p.remainder));
    if (remainder === null) return null;
    return choices[parsed.findIndex((p) => p.remainder === remainder)];
  },
};

test('within every number_divide_remainder group, no structural shortcut solves every task', () => {
  let checkedGroups = 0;
  for (const topic of WAVE3_TOPICS) {
    for (const group of topic.groups) {
      const tasks = group.tasks.filter((t) => t.typeId === 'number_divide_remainder');
      if (tasks.length < 2) continue;
      checkedGroups += 1;
      for (const [name, shortcut] of Object.entries(DIVISION_SHORTCUTS)) {
        const solved = tasks.filter((t) => shortcut(t.choices as string[]) === t.correctAnswer).length;
        assert.ok(
          solved < tasks.length,
          `group ${group.id} is fully solvable by "${name}" (${solved}/${tasks.length}) — no division required`,
        );
        assert.ok(
          solved <= Math.floor(tasks.length / 2),
          `group ${group.id}: shortcut "${name}" hits the correct answer in ${solved}/${tasks.length} tasks — too reliable to be safe`,
        );
      }
    }
  }
  assert.ok(checkedGroups > 0, 'expected at least one number_divide_remainder group to exist');
});

test('share_of_whole tasks never have a choices field (numeric-only type)', () => {
  let checked = 0;
  for (const topic of WAVE3_TOPICS) {
    for (const group of topic.groups) {
      for (const task of group.tasks) {
        if (task.typeId !== 'share_of_whole') continue;
        checked += 1;
        assert.equal(task.choices, undefined, `share_of_whole task ${task.id} must not have choices`);
      }
    }
  }
  assert.equal(checked, 16, 'expected exactly 16 share_of_whole tasks');
});

test('every generated task has a correctAnswer consistent with its own params', () => {
  for (const topic of WAVE3_TOPICS) {
    for (const group of topic.groups) {
      for (const task of group.tasks) {
        if (task.typeId === 'share_of_whole') {
          const { total, parts } = task.params as { total: number; parts: number };
          assert.ok(parts === 2 || parts === 4, `parts must be 2 or 4: ${task.id}`);
          assert.equal(total % parts, 0, `total must be evenly divisible by parts: ${task.id}`);
          assert.equal(task.correctAnswer, total / parts);
          assert.ok(total >= 4 && total <= 40, `total must be within spec range 4-40: ${task.id}`);
        }
        if (task.typeId === 'number_multiply_two') {
          const { a, b } = task.params as { a: number; b: number };
          assert.equal(task.correctAnswer, a * b);
          assert.ok(a >= 1 && a <= 10 && b >= 1 && b <= 10, `a and b must be within spec range 1-10: ${task.id}`);
        }
        if (task.typeId === 'number_divide_remainder') {
          const { a, b } = task.params as { a: number; b: number };
          const quotient = Math.floor(a / b);
          const remainder = a % b;
          assert.equal(task.correctAnswer, `${quotient} ост. ${remainder}`);
          assert.ok(quotient >= 1, `division quotient must be >= 1: ${task.id}`);
          assert.ok(remainder >= 1, `this wave only generates non-zero-remainder division tasks: ${task.id}`);
          assert.ok(a >= 3 && a <= 50, `dividend must be within spec range 3-50: ${task.id}`);
          assert.ok(b >= 6 && b <= 10, `wave 3 division only covers divisors 6-10: ${task.id}`);
          assert.equal(new Set(task.choices).size, 3, `all 3 choice options must be distinct: ${task.id}`);
          assert.ok(task.choices!.includes(task.correctAnswer as string));
          for (const choice of task.choices as string[]) {
            const shown = parseDivisionOption(choice);
            assert.ok(shown.quotient >= 1, `no option may show a quotient below 1: ${task.id} → "${choice}"`);
            assert.ok(
              shown.remainder >= 0 && shown.remainder < b,
              `every option's remainder must be a valid remainder for divisor ${b}: ${task.id} → "${choice}"`,
            );
          }
        }
        if (task.typeId === 'number_sum_two' && task.id.startsWith('add_carry')) {
          const { a, b } = task.params as { a: number; b: number };
          assert.equal(task.correctAnswer, a + b);
          assert.ok(a + b > 10, `Сложение: переход через десяток must actually cross 10: ${task.id}`);
        }
        if (task.typeId === 'number_subtract_two' && task.id.startsWith('sub_wide')) {
          const { a, b } = task.params as { a: number; b: number };
          assert.equal(task.correctAnswer, a - b);
          assert.ok(a <= 20, `Вычитание: числа побольше must keep уменьшаемое within 20: ${task.id}`);
          assert.ok(b >= 3, `Вычитание: числа побольше must use вычитаемое >= 3 (1 and 2 already covered by wave 1): ${task.id}`);
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

test('mergeIntoContent adds all wave 3 topics without touching existing content', () => {
  const merged = mergeIntoContent(BASE_CONTENT);
  assert.ok(merged.topics.top_addition, 'existing topic must survive the merge');
  assert.equal(Object.keys(merged.topics).length, 1 + WAVE3_TOPICS.length);
  const arithmeticSection = merged.sections.find((s) => s.id === 'sec_arithmetic')!;
  assert.equal(arithmeticSection.topicIds.length, 1 + WAVE3_TOPICS.length);
  assert.equal(Object.keys(merged.tasks).length, 1 + countWave3Tasks());
});

test('mergeIntoContent throws instead of silently overwriting a colliding topic id', () => {
  const colliding: MathMachineContent = {
    ...BASE_CONTENT,
    topics: { ...BASE_CONTENT.topics, top_shares: { id: 'top_shares', name: 'existing', groupIds: ['x'] } },
  };
  assert.throws(() => mergeIntoContent(colliding), /top_shares/);
});

test('the merged content validates against MathMachineContentSchema', () => {
  const merged = mergeIntoContent(BASE_CONTENT);
  const result = MathMachineContentSchema.safeParse(merged);
  assert.equal(result.success, true, result.success ? '' : JSON.stringify((result as any).error?.issues, null, 2));
});
```

- [ ] **Step 4: Запустить тесты генератора**

Run: `cd packages/player && node --experimental-strip-types --test src/mathmachine/content/generateWave3Content.test.ts`
Expected: все тесты PASS. Если `share_of_whole tasks never have a choices field` падает с числом ≠16 — пересчитайте `SHARE_HALF_TOTALS.length + SHARE_QUARTER_TOTALS.length` (должно быть 8+8=16). Если тест на структурную эвристику деления падает — это означает, что конкретные пары `(a,b)` в одной из трёх новых тем случайно попали в комбинацию, где эвристика решает больше половины группы; замените 1-2 пары на соседние значения с тем же делителем (частное должно остаться ≥2).

- [ ] **Step 5: Полный прогон пакета**

Run: `cd packages/player && npm test`
Expected: все тесты PASS (259 существующих + столько новых тестов, сколько добавлено в этой задаче, все в `generateWave3Content.test.ts`)

- [ ] **Step 6: Коммит**

```bash
git add packages/player/src/mathmachine/content/generateWave3Content.ts packages/player/src/mathmachine/content/generateWave3Content.test.ts
git commit -m "feat(mathmachine): add offline content generator for Этап 2b wave 3 (135 tasks, 13 topics, position/structural invariants from day one)"
```

---

## Task 4: Материализация в `pilotContent.json`

**Files:**
- Create: `packages/player/src/mathmachine/content/runGenerateWave3.ts`
- Modify: `packages/player/src/mathmachine/content/pilotContent.json` (только через запуск скрипта, не руками)
- Modify: `packages/player/src/mathmachine/content/pilotContent.test.ts`

**Interfaces:**
- Consumes: `mergeIntoContent`, `countWave3Tasks` из `generateWave3Content.ts` (Задача 3).
- Produces: обновлённый `pilotContent.json` (309 заданий, 25 тем, 37 групп). Ничего, от чего зависят более поздние задачи этого плана (Задача 5 — только живая проверка).

- [ ] **Step 1: Создать CLI-скрипт материализации**

Создать `packages/player/src/mathmachine/content/runGenerateWave3.ts`:

```ts
// Разовый CLI-скрипт: применяет offline-генератор Этапа 2b, волна 3, к
// pilotContent.json. Не часть рантайма плеера. Запуск (из любой директории):
// node --experimental-strip-types packages/player/src/mathmachine/content/runGenerateWave3.ts

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { MathMachineContent } from '@kiosk/shared';
import { mergeIntoContent, countWave3Tasks } from './generateWave3Content.ts';

const contentPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'pilotContent.json');
const content = JSON.parse(fs.readFileSync(contentPath, 'utf-8')) as MathMachineContent;
const merged = mergeIntoContent(content);
fs.writeFileSync(contentPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
console.log(`Wave 3: added ${countWave3Tasks()} tasks across 13 topics to ${contentPath}`);
```

- [ ] **Step 2: Запустить скрипт**

Run: `cd packages/player && node --experimental-strip-types src/mathmachine/content/runGenerateWave3.ts`
Expected: строка `Wave 3: added 135 tasks across 13 topics to ...pilotContent.json`

- [ ] **Step 3: Проверить, что диф — чистое добавление**

Run: `git diff --stat packages/player/src/mathmachine/content/pilotContent.json`
Expected: только добавленные строки (плюс замена финальной запятой/скобки), без изменений существующих строк. Если diff выглядит как переформатирование всего файла (стилистическая особенность, уже дважды встречавшаяся в этом проекте на волнах 1-2 из-за прежних PowerShell-правок форматирования) — это НЕ блокер: подтвердите через `JSON.parse` + сравнение по значению (не по тексту диффа), что все 174 существующих задания/12 тем/22 группы не изменились по значению, и продолжайте.

- [ ] **Step 4: Обновить хардкод-тесты `pilotContent.test.ts`**

В `packages/player/src/mathmachine/content/pilotContent.test.ts` заменить:

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

на:

```ts
test('pilotContent has exactly twenty-five topics (2 from Этап 1 + 5 from wave 1 + 5 from wave 2 + 13 from wave 3) with at least one group each', () => {
  const parsed = MathMachineContentSchema.parse(pilotContent);
  const topicIds = Object.keys(parsed.topics);
  assert.equal(topicIds.length, 25);
  for (const id of topicIds) {
    assert.ok(parsed.topics[id].groupIds.length >= 1);
  }
});

test('pilotContent has exactly 309 tasks (18 from Этап 1 + 80 from wave 1 + 76 from wave 2 + 135 from wave 3)', () => {
  const parsed = MathMachineContentSchema.parse(pilotContent);
  assert.equal(Object.keys(parsed.tasks).length, 309);
});
```

- [ ] **Step 5: Запустить тесты контента**

Run: `cd packages/player && node --experimental-strip-types --test src/mathmachine/content/pilotContent.test.ts`
Expected: все 4 теста PASS (25 тем, 309 заданий, схема валидна, ссылочная целостность)

- [ ] **Step 6: Полный прогон пакета**

Run: `cd packages/player && npm test`
Expected: все тесты PASS

- [ ] **Step 7: Коммит**

```bash
git add packages/player/src/mathmachine/content/runGenerateWave3.ts packages/player/src/mathmachine/content/pilotContent.json packages/player/src/mathmachine/content/pilotContent.test.ts
git commit -m "feat(mathmachine): materialize Этап 2b wave 3 content (309 tasks, 25 topics)"
```

---

## Task 5: Живая проверка (packaged Electron + CDP)

**Files:** нет изменений кода, если живая проверка не найдёт багов.

**Interfaces:** нет новых — верифицирует поведение всего, что произвели Задачи 1-4.

- [ ] **Step 1: Собрать и запустить пакетированный Electron**

Тот же процесс, что и в предыдущих финальных живых проверках этого виджета: подставить в `packages/player/electron/project.json` проект с виджетом `mathmachine`; `cd packages/player && npm run package`; запустить `dist-electron/win-unpacked/Музей СВО.exe --remote-debugging-port=9333`; подключиться через CDP.

- [ ] **Step 2: Проверить новый тип и по одной теме из каждой углубляемой категории**

Через каталог заданий: для «Доли целого» прочитать реальный текст обучающего задания, вычислить правильный ответ вручную ДО клика, ввести именно это значение. Для каждой из 4 углубляемых категорий (Умножение — любая из 7 новых таблиц, Деление — любая из 3 новых тем, Сложение — «переход через десяток», Вычитание — «числа побольше») — то же самое: вычислить ответ вручную, ввести/выбрать именно его. Для двух choice-режимов среди новых тем деления — убедиться, что кнопка с правильным значением реально присутствует среди вариантов. Проверить, что неверный ответ на первой попытке показывает подсказку `HINTS.share_of_whole`.

- [ ] **Step 3: Проверить консоль на отсутствие ошибок**

CDP-монитор (`Runtime.consoleAPICalled`/`Runtime.exceptionThrown`) за весь сценарий Step 2. Ожидается пустой лог.

- [ ] **Step 4: Прогнать полный юнит-тестовый набор**

Run: `cd packages/player && npm test`
Expected: все тесты зелёные (309 заданий, 25 тем подтверждены тестом из Задачи 4).

Run: `cd packages/shared && npx tsx --test $(find src -name "*.test.ts")`
Expected: все тесты зелёные.

- [ ] **Step 5: Откат временных правок и уборка**

```bash
git checkout -- packages/player/electron/project.json
git status --short packages/player/dist-electron
```
Убить процесс `Музей СВО.exe`, если запущен. Удалить временные CDP-скрипты/логи из scratch-директории. Проверить и удалить, если появился, `%APPDATA%/kiosk-mathmachine/userdata.json` — известная особенность из волн 1-2 (реальный прогресс, записанный живым тестом, может сломать несвязанный юнит-тест `ipc.test.js` при повторном запуске `npm test`; код не трогать, только удалить файл и перезапустить тесты).

- [ ] **Step 6: Зафиксировать результат**

Если живая проверка нашла реальный баг — исправить в соответствующем файле (Задача 1-4), повторить Steps 1-4, закоммитить фикс отдельным коммитом (`fix(mathmachine): ...`) с пометкой, что баг найден именно живой проверкой. Если багов не найдено — дополнительный коммит не требуется.
