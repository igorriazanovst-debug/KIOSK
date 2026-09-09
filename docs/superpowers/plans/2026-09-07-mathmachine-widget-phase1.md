# Тип 6 «Матемашка» — виджет `mathmachine`, Этап 1 (движок) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete engine of the new KIOSK widget `mathmachine` (catalog → group → task → answer-check → hint/reveal → progress, one lab tool «Весы», local storage, offline audio) on a small hand-authored pilot content set (2 темы, ~18 заданий), proven by a live Electron run — no content scale-up in this plan.

**Architecture:** New widget type, local-storage-only (no server), following the `naturalcommunities`/`chronoline` full-viewport pattern already established in this repo. Domain types/schema/task-engine/catalog utilities live once in `packages/shared/src/mathmachine/` (consumed by server for access-gating and by player at runtime — no editor-web runtime needed, since precedent shows `naturalcommunities` has no live preview in editor-web either, only a properties form). All interactive UI lives in `packages/player`.

**Tech Stack:** TypeScript, React, zod (already a `packages/shared` dependency), react-konva (already used by `naturalcommunities`), Node built-in `node:test` for domain unit tests (same no-framework convention as `schema.test.ts`/`navEngine.test.ts` elsewhere in this repo), Electron (existing `packages/player` shell).

**Spec:** `docs/superpowers/specs/2026-09-07-mathmachine-widget-design.md`

## Global Constraints

- Must work **fully offline** — no live network calls at runtime, including no live TTS (spec §6). All audio is pre-generated and bundled.
- Access to the widget in the editor is restricted to `mokretcov.m@poznaikino.ru` for now (spec §2) — double lock: server 403 + client palette hiding, mirroring `natcomAccess.ts`/`chronolineAccess.ts` exactly.
- Content data (catalog/tasks/media) and user data (progress/settings) are physically separate; user data must survive content updates and be written atomically (spec §3/§9).
- Schema version field from day one on both the content schema and the user-data schema (spec §3).
- Original vendor content (images/audio of «ОС3. Матемашка») must never be used — this plan uses simple original geometric visuals (dots/bars/numerals) for the pilot, not vendor assets. Illustrated art (syntx.ai) is explicitly **out of scope for this plan** — noted as a follow-up content task, not silently done here (see Task 17).
- Do not touch unrelated widgets/files. Do not push or deploy without separate explicit confirmation (this plan ends at a locally-verified, committed branch).

---

### Task 1: Shared domain schema (content + user data)

**Files:**
- Create: `packages/shared/src/mathmachine/model/schema.ts`
- Create: `packages/shared/src/mathmachine/model/schema.test.ts`
- Create: `packages/shared/src/mathmachine/widgetProperties.ts`

**Interfaces:**
- Produces: `TaskTypeIdSchema`, `TaskTypeId`, `TaskSchema`, `Task`, `GroupSchema`, `Group`, `TopicSchema`, `Topic`, `SectionSchema`, `Section`, `MathToolSchema`, `MathTool`, `MediaAssetSchema`, `MediaAsset`, `MathMachineContentSchema`, `MathMachineContent`, `MATHMACHINE_CONTENT_SCHEMA_VERSION`, `GroupProgressSchema`, `GroupProgress`, `MathMachineUserDataSchema`, `MathMachineUserData`, `MATHMACHINE_USERDATA_SCHEMA_VERSION` — all later tasks depend on these exact names.
- Produces: `MATHMACHINE_WIDGET_TYPE`, `MathMachineWidgetProperties`, `MATHMACHINE_DEFAULT_PROPS`, `MATHMACHINE_DEFAULT_SIZE`, `MATHMACHINE_PROPS_VERSION`.

- [ ] **Step 1: Write the failing schema test**

```typescript
// packages/shared/src/mathmachine/model/schema.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MediaAssetSchema,
  TaskSchema,
  GroupSchema,
  TopicSchema,
  SectionSchema,
  MathToolSchema,
  MathMachineContentSchema,
  MATHMACHINE_CONTENT_SCHEMA_VERSION,
  GroupProgressSchema,
  MathMachineUserDataSchema,
  MATHMACHINE_USERDATA_SCHEMA_VERSION,
} from './schema';

test('MediaAssetSchema rejects a sha256 that is not 64 lowercase hex chars', () => {
  assert.equal(
    MediaAssetSchema.safeParse({ id: 'm1', fileName: 'a.mp3', mimeType: 'audio/mpeg', fileSize: 1, sha256: 'ABCDEF' }).success,
    false,
  );
});

test('MediaAssetSchema rejects a fileName containing a path separator', () => {
  assert.equal(
    MediaAssetSchema.safeParse({ id: 'm1', fileName: '../a.mp3', mimeType: 'audio/mpeg', fileSize: 1, sha256: 'a'.repeat(64) }).success,
    false,
  );
});

test('TaskSchema rejects an unknown typeId', () => {
  assert.equal(
    TaskSchema.safeParse({ id: 't1', typeId: 'not_a_real_type', text: 'x', params: {}, correctAnswer: 1 }).success,
    false,
  );
});

test('TaskSchema accepts a well-formed numeric task with array params (number_missing)', () => {
  const result = TaskSchema.safeParse({
    id: 't1',
    typeId: 'number_missing',
    text: 'Какое число пропущено?',
    params: { series: [2, 4, 6, 8, 10], missingIndex: 2 },
    correctAnswer: 6,
  });
  assert.equal(result.success, true);
});

test('GroupSchema rejects a group with zero tasks', () => {
  assert.equal(GroupSchema.safeParse({ id: 'g1', name: 'Группа', taskIds: [] }).success, false);
});

test('MathMachineContentSchema requires the exact current schemaVersion', () => {
  assert.equal(
    MathMachineContentSchema.safeParse({ schemaVersion: 999, sections: [], topics: {}, groups: {}, tasks: {}, mathTools: [], media: {} }).success,
    false,
  );
  assert.equal(
    MathMachineContentSchema.safeParse({
      schemaVersion: MATHMACHINE_CONTENT_SCHEMA_VERSION, sections: [], topics: {}, groups: {}, tasks: {}, mathTools: [], media: {},
    }).success,
    true,
  );
});

test('MathMachineUserDataSchema defaults progress to empty and soundOn to true', () => {
  const result = MathMachineUserDataSchema.parse({ schemaVersion: MATHMACHINE_USERDATA_SCHEMA_VERSION });
  assert.deepEqual(result.progress, {});
  assert.equal(result.soundOn, true);
});

test('GroupProgressSchema defaults doneTaskIds to empty and currentTaskId to null', () => {
  const result = GroupProgressSchema.parse({});
  assert.deepEqual(result.doneTaskIds, []);
  assert.equal(result.currentTaskId, null);
});

test('SectionSchema and MathToolSchema accept minimal well-formed records', () => {
  assert.equal(SectionSchema.safeParse({ id: 's1', name: 'Арифметика', topicIds: ['t1'] }).success, true);
  assert.equal(MathToolSchema.safeParse({ id: 'weights', name: 'Весы' }).success, true);
  assert.equal(MathToolSchema.safeParse({ id: 'not_a_tool', name: 'X' }).success, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && node --experimental-strip-types --test src/mathmachine/model/schema.test.ts`
Expected: FAIL with "Cannot find module './schema'"

- [ ] **Step 3: Write the schema implementation**

```typescript
// packages/shared/src/mathmachine/model/schema.ts
// zod-схемы модели виджета «Матемашка» (Тип 6) — единственная точка, через
// которую проходят данные с границы системы (контент, зашитый в дистрибутив,
// пользовательский прогресс на диске) — тот же принцип, что у
// naturalCommunities/model/schema.ts.
//
// Минимальный состав сущностей — из ТЗ (раздел 8): Тема/подтема, Группа
// заданий, Задание, Вариант ответа, Подсказка, Математический инструмент,
// Прогресс выполнения, Медиафайл. Настройки приложения — MathMachineUserData.soundOn.

import { z } from 'zod';

export const MediaAssetSchema = z.object({
  id: z.string().min(1),
  fileName: z.string().min(1).max(255).refine((s) => !/[/\\]/.test(s), 'fileName must not contain path separators'),
  mimeType: z.string(),
  fileSize: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/, 'sha256 must be a 64-character lowercase hex string'),
});
export type MediaAsset = z.infer<typeof MediaAssetSchema>;

/** Пилотные типы заданий Этапа 1 (спека, разд. 4). Этап 2 расширит список. */
export const TASK_TYPE_IDS = [
  'number_counting',
  'number_sum_two',
  'number_sum_three',
  'number_missing',
  'compare_length',
] as const;
export const TaskTypeIdSchema = z.enum(TASK_TYPE_IDS);
export type TaskTypeId = z.infer<typeof TaskTypeIdSchema>;

/** Параметры задания: числа или массивы чисел (для number_missing — сама последовательность). */
export const TaskParamsSchema = z.record(z.string(), z.union([z.number(), z.array(z.number())]));
export type TaskParams = z.infer<typeof TaskParamsSchema>;

export const TaskSchema = z.object({
  id: z.string().min(1),
  typeId: TaskTypeIdSchema,
  /** Текст задания — отображается и озвучивается (FR-013). */
  text: z.string().min(1),
  params: TaskParamsSchema,
  correctAnswer: z.union([z.number(), z.string()]),
  /** Варианты для типов с режимом ответа "выбор" (напр. compare_length). */
  choices: z.array(z.union([z.number(), z.string()])).optional(),
  /** Ссылка на MediaAsset.id с готовой (офлайн) озвучкой текста задания. */
  audioTaskTextId: z.string().min(1).nullable().optional(),
});
export type Task = z.infer<typeof TaskSchema>;

export const GroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Первый id — обучающее задание группы (спека, разд. 6). */
  taskIds: z.array(z.string().min(1)).min(1),
});
export type Group = z.infer<typeof GroupSchema>;

export const TopicSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  groupIds: z.array(z.string().min(1)).min(1),
});
export type Topic = z.infer<typeof TopicSchema>;

export const SectionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  topicIds: z.array(z.string().min(1)).min(1),
});
export type Section = z.infer<typeof SectionSchema>;

/** Этап 1 — только «Весы»; Этап 2 добавит 'chain'/'two_segments' (ТЗ FR-024). */
export const MATH_TOOL_IDS = ['weights'] as const;
export const MathToolSchema = z.object({
  id: z.enum(MATH_TOOL_IDS),
  name: z.string().min(1),
});
export type MathTool = z.infer<typeof MathToolSchema>;

export const MATHMACHINE_CONTENT_SCHEMA_VERSION = 1 as const;

export const MathMachineContentSchema = z.object({
  schemaVersion: z.literal(MATHMACHINE_CONTENT_SCHEMA_VERSION),
  sections: z.array(SectionSchema).default([]),
  topics: z.record(z.string(), TopicSchema).default({}),
  groups: z.record(z.string(), GroupSchema).default({}),
  tasks: z.record(z.string(), TaskSchema).default({}),
  mathTools: z.array(MathToolSchema).default([]),
  media: z.record(z.string(), MediaAssetSchema).default({}),
});
export type MathMachineContent = z.infer<typeof MathMachineContentSchema>;

// ─── Пользовательские данные — отдельно от контента (спека, разд. 3) ────

export const GroupProgressSchema = z.object({
  doneTaskIds: z.array(z.string().min(1)).default([]),
  currentTaskId: z.string().min(1).nullable().default(null),
});
export type GroupProgress = z.infer<typeof GroupProgressSchema>;

export const MATHMACHINE_USERDATA_SCHEMA_VERSION = 1 as const;

export const MathMachineUserDataSchema = z.object({
  schemaVersion: z.literal(MATHMACHINE_USERDATA_SCHEMA_VERSION),
  progress: z.record(z.string(), GroupProgressSchema).default({}),
  soundOn: z.boolean().default(true),
});
export type MathMachineUserData = z.infer<typeof MathMachineUserDataSchema>;
```

```typescript
// packages/shared/src/mathmachine/widgetProperties.ts
// Описание типа виджета "mathmachine" — формат поля widget.properties.
// Единственный источник (editor-web И player подключают отсюда), тот же
// принцип, что у chrono/naturalCommunities/widgetProperties.ts. В отличие от
// naturalcommunities, у этого виджета НЕТ встроенного сервера — только
// локальное хранение (спека, разд. 2).

export const MATHMACHINE_WIDGET_TYPE = 'mathmachine' as const;

export interface MathMachineWidgetProperties {
  /** Заголовок виджета (опционально) */
  title?: string;
}

export const MATHMACHINE_PROPS_VERSION = '1.0';

export const MATHMACHINE_DEFAULT_PROPS: MathMachineWidgetProperties = {
  title: 'Матемашка',
};

export const MATHMACHINE_DEFAULT_SIZE = {
  width: 1024,
  height: 768,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/shared && node --experimental-strip-types --test src/mathmachine/model/schema.test.ts`
Expected: PASS, 9 tests, 0 failures

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/mathmachine/model/schema.ts packages/shared/src/mathmachine/model/schema.test.ts packages/shared/src/mathmachine/widgetProperties.ts
git commit -m "feat(mathmachine): add shared domain schema and widget properties"
```

---

### Task 2: Task engine (answer checking)

**Files:**
- Create: `packages/shared/src/mathmachine/taskEngine.ts`
- Create: `packages/shared/src/mathmachine/taskEngine.test.ts`

**Interfaces:**
- Consumes: `Task`, `TaskTypeId` from `./model/schema` (Task 1).
- Produces: `AnswerMode` (`'numeric' | 'choice'`), `TASK_TYPE_REGISTRY`, `checkTaskAnswer(task: Task, userAnswer: number | string): boolean`, `getAnswerMode(typeId: TaskTypeId): AnswerMode` — consumed by Task 9 (AnswerInput) and Task 11 (TaskRunner).

- [ ] **Step 1: Write the failing test**

```typescript
// packages/shared/src/mathmachine/taskEngine.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkTaskAnswer, getAnswerMode } from './taskEngine';
import type { Task } from './model/schema';

const sumTask: Task = { id: 't1', typeId: 'number_sum_two', text: '2+3', params: { a: 2, b: 3 }, correctAnswer: 5 };
const compareTask: Task = {
  id: 't2', typeId: 'compare_length', text: 'Какой длиннее?', params: { leftLength: 3, rightLength: 7 },
  correctAnswer: 'right', choices: ['left', 'right'],
};

test('checkTaskAnswer accepts a correct numeric answer given as a number', () => {
  assert.equal(checkTaskAnswer(sumTask, 5), true);
});

test('checkTaskAnswer accepts a correct numeric answer given as a numeric string (keyboard entry)', () => {
  assert.equal(checkTaskAnswer(sumTask, '5'), true);
});

test('checkTaskAnswer rejects a wrong numeric answer', () => {
  assert.equal(checkTaskAnswer(sumTask, 4), false);
});

test('checkTaskAnswer rejects a non-numeric string for a numeric task', () => {
  assert.equal(checkTaskAnswer(sumTask, 'five'), false);
});

test('checkTaskAnswer accepts the correct choice for a choice-mode task', () => {
  assert.equal(checkTaskAnswer(compareTask, 'right'), true);
  assert.equal(checkTaskAnswer(compareTask, 'left'), false);
});

test('getAnswerMode returns numeric for number_sum_two and choice for compare_length', () => {
  assert.equal(getAnswerMode('number_sum_two'), 'numeric');
  assert.equal(getAnswerMode('compare_length'), 'choice');
});

test('checkTaskAnswer throws on an unregistered task type', () => {
  const bogus = { ...sumTask, typeId: 'not_real' as any };
  assert.throws(() => checkTaskAnswer(bogus, 5));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && node --experimental-strip-types --test src/mathmachine/taskEngine.test.ts`
Expected: FAIL with "Cannot find module './taskEngine'"

- [ ] **Step 3: Write the implementation**

```typescript
// packages/shared/src/mathmachine/taskEngine.ts
// Реестр параметризуемых типов заданий — ядро масштабируемости к Этапу 2
// (спека, разд. 4). Тип задания — это код (не данные): режим ответа +
// функция проверки. Задание-экземпляр — просто {id, typeId, params}.

import type { Task, TaskTypeId } from './model/schema';

export type AnswerMode = 'numeric' | 'choice';

export interface TaskTypeDefinition {
  id: TaskTypeId;
  answerMode: AnswerMode;
  checkAnswer: (task: Task, userAnswer: number | string) => boolean;
}

function numericCheck(task: Task, userAnswer: number | string): boolean {
  if (typeof task.correctAnswer !== 'number') return false;
  const given = typeof userAnswer === 'number' ? userAnswer : Number(userAnswer);
  return Number.isFinite(given) && given === task.correctAnswer;
}

function choiceCheck(task: Task, userAnswer: number | string): boolean {
  return String(userAnswer) === String(task.correctAnswer);
}

export const TASK_TYPE_REGISTRY: Record<TaskTypeId, TaskTypeDefinition> = {
  number_counting: { id: 'number_counting', answerMode: 'numeric', checkAnswer: numericCheck },
  number_sum_two: { id: 'number_sum_two', answerMode: 'numeric', checkAnswer: numericCheck },
  number_sum_three: { id: 'number_sum_three', answerMode: 'numeric', checkAnswer: numericCheck },
  number_missing: { id: 'number_missing', answerMode: 'numeric', checkAnswer: numericCheck },
  compare_length: { id: 'compare_length', answerMode: 'choice', checkAnswer: choiceCheck },
};

export function checkTaskAnswer(task: Task, userAnswer: number | string): boolean {
  const def = TASK_TYPE_REGISTRY[task.typeId];
  if (!def) throw new Error(`Unknown task type: ${task.typeId}`);
  return def.checkAnswer(task, userAnswer);
}

export function getAnswerMode(typeId: TaskTypeId): AnswerMode {
  const def = TASK_TYPE_REGISTRY[typeId];
  if (!def) throw new Error(`Unknown task type: ${typeId}`);
  return def.answerMode;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/shared && node --experimental-strip-types --test src/mathmachine/taskEngine.test.ts`
Expected: PASS, 7 tests, 0 failures

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/mathmachine/taskEngine.ts packages/shared/src/mathmachine/taskEngine.test.ts
git commit -m "feat(mathmachine): add task-type registry and answer-checking engine"
```

---

### Task 3: Catalog tree utilities

**Files:**
- Create: `packages/shared/src/mathmachine/catalog.ts`
- Create: `packages/shared/src/mathmachine/catalog.test.ts`
- Modify: `packages/shared/src/index.ts` (add exports for all of mathmachine)

**Interfaces:**
- Consumes: `MathMachineContent`, `Group`, `Task`, `GroupProgress` from `./model/schema` (Task 1).
- Produces: `FlatTopicRef`, `listTopics(content)`, `listGroupsForTopic(content, topicId)`, `tasksForGroup(content, groupId)`, `nextUndoneTaskId(group, progress)`, `GroupProgressSummary`, `summarizeGroupProgress(group, progress)` — consumed by Task 12 (CatalogScreen).

- [ ] **Step 1: Write the failing test**

```typescript
// packages/shared/src/mathmachine/catalog.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listTopics, listGroupsForTopic, tasksForGroup, nextUndoneTaskId, summarizeGroupProgress } from './catalog';
import type { MathMachineContent, Group } from './model/schema';

const content: MathMachineContent = {
  schemaVersion: 1,
  sections: [{ id: 's1', name: 'Арифметика', topicIds: ['top1'] }],
  topics: { top1: { id: 'top1', name: 'Сложение', groupIds: ['g1'] } },
  groups: { g1: { id: 'g1', name: 'Группа 1', taskIds: ['t1', 't2', 't3'] } },
  tasks: {
    t1: { id: 't1', typeId: 'number_sum_two', text: '1+1', params: { a: 1, b: 1 }, correctAnswer: 2 },
    t2: { id: 't2', typeId: 'number_sum_two', text: '2+2', params: { a: 2, b: 2 }, correctAnswer: 4 },
    t3: { id: 't3', typeId: 'number_sum_two', text: '3+3', params: { a: 3, b: 3 }, correctAnswer: 6 },
  },
  mathTools: [],
  media: {},
};

test('listTopics flattens sections into topic refs with section context', () => {
  const topics = listTopics(content);
  assert.deepEqual(topics, [{ sectionId: 's1', sectionName: 'Арифметика', topicId: 'top1', topicName: 'Сложение' }]);
});

test('listGroupsForTopic returns the resolved Group objects for a topic', () => {
  const groups = listGroupsForTopic(content, 'top1');
  assert.equal(groups.length, 1);
  assert.equal(groups[0].id, 'g1');
});

test('listGroupsForTopic returns an empty array for an unknown topic', () => {
  assert.deepEqual(listGroupsForTopic(content, 'nope'), []);
});

test('tasksForGroup resolves task ids to Task objects in order', () => {
  const tasks = tasksForGroup(content, 'g1');
  assert.deepEqual(tasks.map((t) => t.id), ['t1', 't2', 't3']);
});

test('nextUndoneTaskId returns the first task not yet in doneTaskIds', () => {
  const group: Group = content.groups.g1;
  assert.equal(nextUndoneTaskId(group, undefined), 't1');
  assert.equal(nextUndoneTaskId(group, { doneTaskIds: ['t1'], currentTaskId: null }), 't2');
});

test('nextUndoneTaskId returns null when the group is fully done', () => {
  const group: Group = content.groups.g1;
  assert.equal(nextUndoneTaskId(group, { doneTaskIds: ['t1', 't2', 't3'], currentTaskId: null }), null);
});

test('summarizeGroupProgress reports total and doneCount', () => {
  const group: Group = content.groups.g1;
  const summary = summarizeGroupProgress(group, { doneTaskIds: ['t1'], currentTaskId: 't2' });
  assert.equal(summary.total, 3);
  assert.equal(summary.doneCount, 1);
  assert.equal(summary.currentIndex, 1);
});

test('summarizeGroupProgress with no progress at all reports zero done', () => {
  const group: Group = content.groups.g1;
  const summary = summarizeGroupProgress(group, undefined);
  assert.equal(summary.doneCount, 0);
  assert.equal(summary.currentIndex, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && node --experimental-strip-types --test src/mathmachine/catalog.test.ts`
Expected: FAIL with "Cannot find module './catalog'"

- [ ] **Step 3: Write the implementation**

```typescript
// packages/shared/src/mathmachine/catalog.ts
// Обход дерева каталога Раздел → Тема → Группа → Задание (спека, разд. 5) и
// расчёт прогресса группы для статус-бара.

import type { MathMachineContent, Group, Task, GroupProgress } from './model/schema';

export interface FlatTopicRef {
  sectionId: string;
  sectionName: string;
  topicId: string;
  topicName: string;
}

export function listTopics(content: MathMachineContent): FlatTopicRef[] {
  const out: FlatTopicRef[] = [];
  for (const section of content.sections) {
    for (const topicId of section.topicIds) {
      const topic = content.topics[topicId];
      if (!topic) continue;
      out.push({ sectionId: section.id, sectionName: section.name, topicId: topic.id, topicName: topic.name });
    }
  }
  return out;
}

export function listGroupsForTopic(content: MathMachineContent, topicId: string): Group[] {
  const topic = content.topics[topicId];
  if (!topic) return [];
  return topic.groupIds.map((id) => content.groups[id]).filter((g): g is Group => !!g);
}

export function tasksForGroup(content: MathMachineContent, groupId: string): Task[] {
  const group = content.groups[groupId];
  if (!group) return [];
  return group.taskIds.map((id) => content.tasks[id]).filter((t): t is Task => !!t);
}

export function nextUndoneTaskId(group: Group, progress: GroupProgress | undefined): string | null {
  const done = new Set(progress?.doneTaskIds ?? []);
  for (const taskId of group.taskIds) {
    if (!done.has(taskId)) return taskId;
  }
  return null;
}

export interface GroupProgressSummary {
  total: number;
  doneCount: number;
  currentIndex: number;
}

export function summarizeGroupProgress(group: Group, progress: GroupProgress | undefined): GroupProgressSummary {
  const done = new Set(progress?.doneTaskIds ?? []);
  const doneCount = group.taskIds.filter((id) => done.has(id)).length;
  const idx = progress?.currentTaskId ? group.taskIds.indexOf(progress.currentTaskId) : doneCount;
  return { total: group.taskIds.length, doneCount, currentIndex: idx < 0 ? doneCount : idx };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/shared && node --experimental-strip-types --test src/mathmachine/catalog.test.ts`
Expected: PASS, 8 tests, 0 failures

- [ ] **Step 5: Wire exports into the shared package index**

In `packages/shared/src/index.ts`, add these three lines next to the other domain exports (near the `naturalCommunities` block):

```typescript
export * from './mathmachine/model/schema';
export * from './mathmachine/widgetProperties';
export * from './mathmachine/taskEngine';
export * from './mathmachine/catalog';
```

- [ ] **Step 6: Rebuild the shared package so consumers can resolve it**

Run: `cd packages/shared && npm run build`
Expected: exits 0, `dist/mathmachine/` now contains compiled `.js`/`.d.ts` files

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/mathmachine/catalog.ts packages/shared/src/mathmachine/catalog.test.ts packages/shared/src/index.ts
git commit -m "feat(mathmachine): add catalog tree utilities and export mathmachine domain from shared"
```

---

### Task 4: Server-side access control

**Files:**
- Create: `packages/server/src/config/mathmachineAccess.ts`
- Create: `packages/server/src/config/mathmachineAccess.test.ts`
- Modify: `packages/server/src/controllers/ProjectController.ts` (import at top near line 8; gate in `createProject` near line 203; gate in `updateProject` near line 356 — exact copy of the existing natcom gates, same location, same shape)

**Interfaces:**
- Consumes: `MATHMACHINE_WIDGET_TYPE` from `@kiosk/shared` (Task 1, exported via Task 3 Step 5).
- Produces: `isEmailAllowedForMathMachine(email)`, `projectDataHasMathMachineWidget(projectData)`.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/server/src/config/mathmachineAccess.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEmailAllowedForMathMachine, projectDataHasMathMachineWidget } from './mathmachineAccess';

test('isEmailAllowedForMathMachine allows the designated email, case-insensitively', () => {
  assert.equal(isEmailAllowedForMathMachine('mokretcov.m@poznaikino.ru'), true);
  assert.equal(isEmailAllowedForMathMachine('MOKRETCOV.M@POZNAIKINO.RU'), true);
});

test('isEmailAllowedForMathMachine denies other emails and empty input', () => {
  assert.equal(isEmailAllowedForMathMachine('test@kiosk.local'), false);
  assert.equal(isEmailAllowedForMathMachine(undefined), false);
  assert.equal(isEmailAllowedForMathMachine(null), false);
});

test('projectDataHasMathMachineWidget detects the widget among other widgets', () => {
  assert.equal(
    projectDataHasMathMachineWidget({ widgets: [{ type: 'text' }, { type: 'mathmachine' }] }),
    true,
  );
});

test('projectDataHasMathMachineWidget returns false when absent or malformed', () => {
  assert.equal(projectDataHasMathMachineWidget({ widgets: [{ type: 'text' }] }), false);
  assert.equal(projectDataHasMathMachineWidget(null), false);
  assert.equal(projectDataHasMathMachineWidget({}), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/server && node --experimental-strip-types --test src/config/mathmachineAccess.test.ts`
Expected: FAIL with "Cannot find module './mathmachineAccess'"

- [ ] **Step 3: Write the implementation**

```typescript
// packages/server/src/config/mathmachineAccess.ts
import { MATHMACHINE_WIDGET_TYPE } from '@kiosk/shared';

// Тот же принцип, что chronolineAccess.ts/natcomAccess.ts — allow-list
// доступа к РЕДАКТИРОВАНИЮ (создание/сохранение) проекта с виджетом
// «Матемашка» по email аккаунта редактора. По решению пользователя
// (2026-09-07, см. docs/superpowers/specs/2026-09-07-mathmachine-widget-design.md).
const MATHMACHINE_ALLOWED_EMAILS = ['mokretcov.m@poznaikino.ru'];

export function isEmailAllowedForMathMachine(email: string | undefined | null): boolean {
  if (!email) return false;
  return MATHMACHINE_ALLOWED_EMAILS.includes(email.toLowerCase());
}

export function projectDataHasMathMachineWidget(projectData: unknown): boolean {
  return (
    !!projectData &&
    typeof projectData === 'object' &&
    Array.isArray((projectData as any).widgets) &&
    (projectData as any).widgets.some(
      (widget: any) => widget && typeof widget === 'object' && widget.type === MATHMACHINE_WIDGET_TYPE
    )
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/server && node --experimental-strip-types --test src/config/mathmachineAccess.test.ts`
Expected: PASS, 4 tests, 0 failures (requires `packages/shared` built from Task 3 Step 6, and `@kiosk/shared` resolvable — if the module can't be found, first restore/verify the local symlink: `ls packages/server/node_modules/@kiosk/shared`)

- [ ] **Step 5: Wire the gate into ProjectController.ts**

In `packages/server/src/controllers/ProjectController.ts`, add the import next to the existing natcom import (near line 8):

```typescript
import { isEmailAllowedForMathMachine, projectDataHasMathMachineWidget } from '../config/mathmachineAccess';
```

In `createProject`, immediately after the existing natcom gate (around line 208), add:

```typescript
      if (projectDataHasMathMachineWidget(projectData) && !isEmailAllowedForMathMachine(req.client.email)) {
        return res.status(403).json({
          error: 'MathMachine widget not allowed',
          message: 'Виджет «Матемашка» пока недоступен для этого аккаунта'
        });
      }
```

In `updateProject`, immediately after the existing natcom gate (around line 363), add:

```typescript
      if (
        Object.prototype.hasOwnProperty.call(updates, 'projectData') &&
        projectDataHasMathMachineWidget(updates.projectData) &&
        !isEmailAllowedForMathMachine(req.client.email)
      ) {
        return res.status(403).json({
          error: 'MathMachine widget not allowed',
          message: 'Виджет «Матемашка» пока недоступен для этого аккаунта'
        });
      }
```

- [ ] **Step 6: Type-check the server package**

Run: `cd packages/server && npx tsc --noEmit`
Expected: no new errors introduced by this change (pre-existing unrelated errors, if any, are not this task's concern)

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/config/mathmachineAccess.ts packages/server/src/config/mathmachineAccess.test.ts packages/server/src/controllers/ProjectController.ts
git commit -m "feat(mathmachine): gate mathmachine widget creation/update behind allow-list"
```

---

### Task 5: Editor-web registration (palette entry + properties panel)

**Files:**
- Create: `packages/editor-web/src/components/MathMachinePropertiesSection.tsx`
- Modify: `packages/editor-web/src/components/WidgetLibrary.tsx` (import, allow-list constant, palette entry)
- Modify: `packages/editor-web/src/components/PropertiesPanel.tsx` (import, render section)

**Interfaces:**
- Consumes: `MATHMACHINE_WIDGET_TYPE`, `MathMachineWidgetProperties`, `MATHMACHINE_DEFAULT_PROPS`, `MATHMACHINE_DEFAULT_SIZE` from `@kiosk/shared` (Task 1/3).

No test for this task — it is pure UI wiring with no logic of its own, matching how `NatComPropertiesSection.tsx` has no test either. Verified by Task 15 (live run) and by the type-check step below.

- [ ] **Step 1: Write the properties section**

```tsx
// packages/editor-web/src/components/MathMachinePropertiesSection.tsx
// Панель свойств виджета «Матемашка» в редакторе. Минимальный набор для
// Этапа 1 (спека, разд. 2) — контент авторизуется офлайн-скриптами, не через
// эту панель (тот же принцип, что у NatComPropertiesSection.tsx: реальная
// интерактивность живёт только в плеере).

import React from 'react';
import type { Widget } from '../types';
import { MATHMACHINE_WIDGET_TYPE, MathMachineWidgetProperties } from '@kiosk/shared';

interface Props {
  widget: Widget;
  onPropertiesChange: (key: string, value: any) => void;
}

const MathMachinePropertiesSection: React.FC<Props> = ({ widget, onPropertiesChange }) => {
  if (widget.type !== MATHMACHINE_WIDGET_TYPE) return null;

  const props = widget.properties as Partial<MathMachineWidgetProperties>;

  return (
    <div className="property-section">
      <h4>Матемашка</h4>

      <div className="property-field">
        <label>Заголовок виджета</label>
        <input
          type="text"
          value={props.title || ''}
          placeholder="Матемашка"
          onChange={(e) => onPropertiesChange('title', e.target.value)}
        />
      </div>
    </div>
  );
};

export default MathMachinePropertiesSection;
```

- [ ] **Step 2: Register the widget in the palette**

In `packages/editor-web/src/components/WidgetLibrary.tsx`, extend the existing shared import (near line 6):

```typescript
import { CHRONOLINE_WIDGET_TYPE, CHRONOLINE_DEFAULT_PROPS, CHRONOLINE_DEFAULT_SIZE, NATCOM_WIDGET_TYPE, NATCOM_DEFAULT_PROPS, NATCOM_DEFAULT_SIZE, MATHMACHINE_WIDGET_TYPE, MATHMACHINE_DEFAULT_PROPS, MATHMACHINE_DEFAULT_SIZE } from '@kiosk/shared';
```

Add a `Calculator` icon import from `lucide-react` next to the existing icon imports (line 3):

```typescript
import { Square, Type, Image, Video, MousePointer, Menu, Globe, Compass, History, TreePine, Calculator } from 'lucide-react';
```

Add the allow-list constant next to the existing two (near line 15):

```typescript
const MATHMACHINE_ALLOWED_EMAILS = ['mokretcov.m@poznaikino.ru'];
```

Add the computed flag next to `isNatcomAllowed` (near line 21):

```typescript
  const isMathMachineAllowed = !!currentUserEmail && MATHMACHINE_ALLOWED_EMAILS.includes(currentUserEmail.toLowerCase());
```

Add the palette entry right after the natcom entry (near line 124):

```typescript
    ...(isMathMachineAllowed ? [{
      type: MATHMACHINE_WIDGET_TYPE,
      name: 'Матемашка',
      icon: Calculator,
      defaultProps: MATHMACHINE_DEFAULT_PROPS,
      defaultSize: MATHMACHINE_DEFAULT_SIZE
    }] : [])
```

(Note: this becomes the last element of the `widgetTypes` array — remove the trailing comma-less closing that was previously on the natcom entry so the array stays valid, i.e. the natcom entry's closing `}] : [])` gets a trailing comma before this new entry.)

- [ ] **Step 3: Wire the properties section into the panel**

In `packages/editor-web/src/components/PropertiesPanel.tsx`, add the import next to `NatComPropertiesSection` (near line 7):

```typescript
import MathMachinePropertiesSection from './MathMachinePropertiesSection';
```

Add the render call right after the `NatComPropertiesSection` block (near line 74):

```tsx
        {/* Секция виджета «Матемашка» */}
        <MathMachinePropertiesSection
          widget={selectedWidget}
          onPropertiesChange={handlePropertiesChange}
        />
```

- [ ] **Step 4: Type-check editor-web**

Run: `cd packages/editor-web && npx tsc --noEmit -p .`
Expected: no new errors from these three files (pre-existing `@kiosk/shared`/chrono-ui errors from an unbuilt dependency, if present, are unrelated to this task — confirm by grepping the output for `mathmachine`/`MathMachine`, same technique used when verifying the navigation pan/zoom fix earlier this session)

- [ ] **Step 5: Commit**

```bash
git add packages/editor-web/src/components/MathMachinePropertiesSection.tsx packages/editor-web/src/components/WidgetLibrary.tsx packages/editor-web/src/components/PropertiesPanel.tsx
git commit -m "feat(mathmachine): register mathmachine widget in editor palette and properties panel"
```

---

### Task 6: Pilot content data set

**Files:**
- Create: `packages/player/src/mathmachine/content/pilotContent.json`
- Create: `packages/player/src/mathmachine/content/pilotContent.test.ts`

**Interfaces:**
- Consumes: `MathMachineContentSchema` from `@kiosk/shared` (Task 1/3) to validate the authored JSON.
- Produces: the JSON file itself, imported directly by Task 14 (`MathMachineRuntime`).

Two topics, two groups each, 18 tasks total — within the agreed pilot size (spec §1). `audioTaskTextId` is left `null` here; Task 16 generates the audio and a follow-up commit fills these in (documented there, not silently left broken).

- [ ] **Step 1: Write the failing schema-validation test**

```typescript
// packages/player/src/mathmachine/content/pilotContent.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MathMachineContentSchema } from '@kiosk/shared';
import pilotContent from './pilotContent.json' with { type: 'json' };

test('pilotContent.json validates against MathMachineContentSchema', () => {
  const result = MathMachineContentSchema.safeParse(pilotContent);
  assert.equal(result.success, true, result.success ? '' : JSON.stringify((result as any).error?.issues, null, 2));
});

test('pilotContent has exactly two topics with at least one group each', () => {
  const parsed = MathMachineContentSchema.parse(pilotContent);
  const topicIds = Object.keys(parsed.topics);
  assert.equal(topicIds.length, 2);
  for (const id of topicIds) {
    assert.ok(parsed.topics[id].groupIds.length >= 1);
  }
});

test('every task referenced by a group actually exists in tasks', () => {
  const parsed = MathMachineContentSchema.parse(pilotContent);
  for (const group of Object.values(parsed.groups)) {
    for (const taskId of group.taskIds) {
      assert.ok(parsed.tasks[taskId], `missing task ${taskId} referenced by group ${group.id}`);
    }
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/player && node --experimental-strip-types --test src/mathmachine/content/pilotContent.test.ts`
Expected: FAIL — `pilotContent.json` does not exist yet

- [ ] **Step 3: Author the pilot content**

```json
{
  "schemaVersion": 1,
  "sections": [
    { "id": "sec_arithmetic", "name": "Арифметика", "topicIds": ["top_addition", "top_counting"] }
  ],
  "topics": {
    "top_addition": { "id": "top_addition", "name": "Сложение", "groupIds": ["grp_add_1", "grp_add_2"] },
    "top_counting": { "id": "top_counting", "name": "Счёт", "groupIds": ["grp_count_1", "grp_count_2"] }
  },
  "groups": {
    "grp_add_1": { "id": "grp_add_1", "name": "Сложение до 10, шаг 1", "taskIds": ["add1_intro", "add1_1", "add1_2", "add1_3", "add1_4"] },
    "grp_add_2": { "id": "grp_add_2", "name": "Сложение трёх чисел", "taskIds": ["add2_intro", "add2_1", "add2_2", "add2_3"] },
    "grp_count_1": { "id": "grp_count_1", "name": "Посчитай предметы", "taskIds": ["count1_intro", "count1_1", "count1_2", "count1_3", "count1_4"] },
    "grp_count_2": { "id": "grp_count_2", "name": "Найди пропущенное число", "taskIds": ["count2_intro", "count2_1", "count2_2", "count2_3"] }
  },
  "tasks": {
    "add1_intro": { "id": "add1_intro", "typeId": "number_sum_two", "text": "Давай научимся складывать числа! Сколько будет 1 плюс 1?", "params": { "a": 1, "b": 1 }, "correctAnswer": 2 },
    "add1_1": { "id": "add1_1", "typeId": "number_sum_two", "text": "Сколько будет 2 плюс 3?", "params": { "a": 2, "b": 3 }, "correctAnswer": 5 },
    "add1_2": { "id": "add1_2", "typeId": "number_sum_two", "text": "Сколько будет 4 плюс 4?", "params": { "a": 4, "b": 4 }, "correctAnswer": 8 },
    "add1_3": { "id": "add1_3", "typeId": "number_sum_two", "text": "Сколько будет 5 плюс 2?", "params": { "a": 5, "b": 2 }, "correctAnswer": 7 },
    "add1_4": { "id": "add1_4", "typeId": "number_sum_two", "text": "Сколько будет 6 плюс 3?", "params": { "a": 6, "b": 3 }, "correctAnswer": 9 },
    "add2_intro": { "id": "add2_intro", "typeId": "number_sum_three", "text": "Теперь сложим сразу три числа! Сколько будет 1 плюс 1 плюс 1?", "params": { "a": 1, "b": 1, "c": 1 }, "correctAnswer": 3 },
    "add2_1": { "id": "add2_1", "typeId": "number_sum_three", "text": "Сколько будет 2 плюс 2 плюс 1?", "params": { "a": 2, "b": 2, "c": 1 }, "correctAnswer": 5 },
    "add2_2": { "id": "add2_2", "typeId": "number_sum_three", "text": "Сколько будет 1 плюс 3 плюс 2?", "params": { "a": 1, "b": 3, "c": 2 }, "correctAnswer": 6 },
    "add2_3": { "id": "add2_3", "typeId": "number_sum_three", "text": "Сколько будет 3 плюс 3 плюс 1?", "params": { "a": 3, "b": 3, "c": 1 }, "correctAnswer": 7 },
    "count1_intro": { "id": "count1_intro", "typeId": "number_counting", "text": "Посчитай, сколько кружков ты видишь?", "params": { "count": 3 }, "correctAnswer": 3 },
    "count1_1": { "id": "count1_1", "typeId": "number_counting", "text": "Сколько кружков на этот раз?", "params": { "count": 5 }, "correctAnswer": 5 },
    "count1_2": { "id": "count1_2", "typeId": "number_counting", "text": "Посчитай кружки!", "params": { "count": 7 }, "correctAnswer": 7 },
    "count1_3": { "id": "count1_3", "typeId": "number_counting", "text": "А теперь сколько?", "params": { "count": 4 }, "correctAnswer": 4 },
    "count1_4": { "id": "count1_4", "typeId": "number_counting", "text": "Посчитай все кружки до одного!", "params": { "count": 9 }, "correctAnswer": 9 },
    "count2_intro": { "id": "count2_intro", "typeId": "number_missing", "text": "Какое число пропущено в ряду 2, 4, ?, 8, 10?", "params": { "series": [2, 4, 6, 8, 10], "missingIndex": 2 }, "correctAnswer": 6 },
    "count2_1": { "id": "count2_1", "typeId": "number_missing", "text": "Какое число пропущено в ряду 1, 2, 3, ?, 5?", "params": { "series": [1, 2, 3, 4, 5], "missingIndex": 3 }, "correctAnswer": 4 },
    "count2_2": { "id": "count2_2", "typeId": "number_missing", "text": "Какое число пропущено в ряду 5, ?, 7, 8, 9?", "params": { "series": [5, 6, 7, 8, 9], "missingIndex": 1 }, "correctAnswer": 6 },
    "count2_3": { "id": "count2_3", "typeId": "number_missing", "text": "Какое число пропущено в ряду 3, 4, 5, 6, ??", "params": { "series": [3, 4, 5, 6, 7], "missingIndex": 4 }, "correctAnswer": 7 }
  },
  "mathTools": [
    { "id": "weights", "name": "Весы" }
  ],
  "media": {}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/player && node --experimental-strip-types --test src/mathmachine/content/pilotContent.test.ts`
Expected: PASS, 3 tests, 0 failures

- [ ] **Step 5: Commit**

```bash
git add packages/player/src/mathmachine/content/pilotContent.json packages/player/src/mathmachine/content/pilotContent.test.ts
git commit -m "feat(mathmachine): author pilot content (2 topics, 4 groups, 18 tasks)"
```

---

### Task 7: `compare_length` pilot topic omitted — decision recorded here

The design spec listed `compare_length` as a pilot task type to exercise the "choice" answer mode. During content authoring (Task 6) it became clear that adding a third topic just for one task type would exceed the "2 topics" pilot boundary agreed with the user. **Decision:** `compare_length` and the choice-mode `AnswerInput` path are still fully implemented in code (Tasks 2, 9, 11) and covered by unit tests — only the *pilot content instances* are deferred to Task 17 (content follow-up), not the engine capability itself. This is a deliberate scope note, not a silent gap — flag it to the user when this plan finishes.

*(No files/steps — this is a decision record, kept as its own numbered entry so it isn't lost between the spec and the code.)*

---

### Task 8: `AnswerInput` component (numeric + choice modes)

**Files:**
- Create: `packages/player/src/mathmachine/AnswerInput.tsx`

**Interfaces:**
- Consumes: `AnswerMode` from `@kiosk/shared` (Task 2).
- Produces: `AnswerInput` component with props `{ mode: AnswerMode; choices?: Array<number|string>; value: number|string|null; onChange: (value: number|string) => void; disabled?: boolean }` — consumed by Task 11 (`TaskRunner`).

No unit test — this is a controlled presentational component; verified live in Task 15 (same convention as every other Runtime/UI component in this repo — see `NavigationRuntime.tsx`, none of which have component-level tests).

- [ ] **Step 1: Write the component**

```tsx
// packages/player/src/mathmachine/AnswerInput.tsx
import React, { useState, useEffect } from 'react';
import type { AnswerMode } from '@kiosk/shared';

interface Props {
  mode: AnswerMode;
  choices?: Array<number | string>;
  value: number | string | null;
  onChange: (value: number | string) => void;
  disabled?: boolean;
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

const AnswerInput: React.FC<Props> = ({ mode, choices = [], value, onChange, disabled }) => {
  const [text, setText] = useState(value != null ? String(value) : '');

  useEffect(() => {
    setText(value != null ? String(value) : '');
  }, [value]);

  function commitText(next: string) {
    setText(next);
    if (next.trim() !== '' && /^-?\d+$/.test(next.trim())) {
      onChange(Number(next.trim()));
    }
  }

  if (mode === 'choice') {
    return (
      <div style={choiceRowStyle}>
        {choices.map((choice) => (
          <button
            key={String(choice)}
            disabled={disabled}
            onClick={() => onChange(choice)}
            style={choiceButtonStyle(String(choice) === (value != null ? String(value) : ''))}
          >
            {String(choice)}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div style={numericColumnStyle}>
      <input
        type="text"
        inputMode="numeric"
        value={text}
        disabled={disabled}
        onChange={(e) => commitText(e.target.value.replace(/[^-\d]/g, ''))}
        style={numericInputStyle}
      />
      <div style={digitPadStyle}>
        {DIGITS.map((digit) => (
          <button key={digit} disabled={disabled} onClick={() => commitText(text + digit)} style={digitButtonStyle}>
            {digit}
          </button>
        ))}
        <button disabled={disabled} onClick={() => commitText(text.slice(0, -1))} style={digitButtonStyle}>⌫</button>
      </div>
    </div>
  );
};

function choiceButtonStyle(active: boolean): React.CSSProperties {
  return {
    padding: '14px 28px', fontSize: 18, fontWeight: 700, borderRadius: 10,
    border: active ? '3px solid #2ecc71' : '2px solid #ccc',
    background: active ? '#eafff2' : '#fff', cursor: 'pointer',
  };
}

const choiceRowStyle: React.CSSProperties = { display: 'flex', gap: 12, justifyContent: 'center' };
const numericColumnStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 };
const numericInputStyle: React.CSSProperties = { width: 140, fontSize: 28, textAlign: 'center', padding: '8px 12px', borderRadius: 8, border: '2px solid #ccc' };
const digitPadStyle: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 6, maxWidth: 260, justifyContent: 'center' };
const digitButtonStyle: React.CSSProperties = { width: 40, height: 40, fontSize: 16, borderRadius: 8, border: '1px solid #ccc', background: '#fff', cursor: 'pointer' };

export default AnswerInput;
```

- [ ] **Step 2: Commit**

```bash
git add packages/player/src/mathmachine/AnswerInput.tsx
git commit -m "feat(mathmachine): add multi-mode answer input (numeric keypad + choice buttons)"
```

---

### Task 9: `TaskVisual` component (simple original geometric visuals)

**Files:**
- Create: `packages/player/src/mathmachine/TaskVisual.tsx`

**Interfaces:**
- Consumes: `Task` from `@kiosk/shared` (Task 1).
- Produces: `TaskVisual` component with props `{ task: Task }` — consumed by Task 11.

No unit test (pure rendering, same convention as Task 8). **Scope note for the user:** this uses simple original shapes (dots/bars/numerals), not illustrated art — illustrating the pilot with syntx.ai-generated art per the spec's content-style decision is follow-up work (Task 17), not done here, so the engine can be proven end-to-end without waiting on a content-generation session.

- [ ] **Step 1: Write the component**

```tsx
// packages/player/src/mathmachine/TaskVisual.tsx
import React from 'react';
import type { Task } from '@kiosk/shared';

const TaskVisual: React.FC<{ task: Task }> = ({ task }) => {
  switch (task.typeId) {
    case 'number_counting': {
      const count = Number(task.params.count ?? 0);
      return (
        <div style={dotsRowStyle}>
          {Array.from({ length: count }).map((_, i) => (
            <span key={i} style={dotStyle} />
          ))}
        </div>
      );
    }
    case 'number_sum_two':
      return <div style={equationStyle}>{String(task.params.a)} + {String(task.params.b)} = ?</div>;
    case 'number_sum_three':
      return <div style={equationStyle}>{String(task.params.a)} + {String(task.params.b)} + {String(task.params.c)} = ?</div>;
    case 'number_missing': {
      const series = (task.params.series as unknown as number[]) ?? [];
      const missingIndex = Number(task.params.missingIndex ?? -1);
      return <div style={equationStyle}>{series.map((n, i) => (i === missingIndex ? '?' : n)).join('  ')}</div>;
    }
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
  }
};

const dotsRowStyle: React.CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap', maxWidth: 400, justifyContent: 'center' };
const dotStyle: React.CSSProperties = { width: 28, height: 28, borderRadius: '50%', background: '#3498db' };
const equationStyle: React.CSSProperties = { fontSize: 36, fontWeight: 700 };
const barsColumnStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' };
const barStyle: React.CSSProperties = { height: 24, background: '#9b59b6', borderRadius: 4 };

export default TaskVisual;
```

- [ ] **Step 2: Commit**

```bash
git add packages/player/src/mathmachine/TaskVisual.tsx
git commit -m "feat(mathmachine): add simple original per-type task visuals"
```

---

### Task 10: `userDataStorage` (atomic local persistence)

**Files:**
- Create: `packages/player/src/mathmachine/userDataStorage.ts`
- Create: `packages/player/src/mathmachine/userDataStorage.test.ts`

**Interfaces:**
- Consumes: `MathMachineUserDataSchema`, `MathMachineUserData`, `MATHMACHINE_USERDATA_SCHEMA_VERSION` from `@kiosk/shared` (Task 1).
- Produces: `loadUserData(baseDir?: string): MathMachineUserData`, `saveUserData(data: MathMachineUserData, baseDir?: string): void` — consumed by Task 14.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/player/src/mathmachine/userDataStorage.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadUserData, saveUserData } from './userDataStorage';
import { MATHMACHINE_USERDATA_SCHEMA_VERSION } from '@kiosk/shared';

test('loadUserData returns a valid default when no file exists yet', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-test-'));
  const data = loadUserData(dir);
  assert.equal(data.schemaVersion, MATHMACHINE_USERDATA_SCHEMA_VERSION);
  assert.deepEqual(data.progress, {});
  assert.equal(data.soundOn, true);
});

test('saveUserData then loadUserData round-trips the same data', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-test-'));
  const data = {
    schemaVersion: MATHMACHINE_USERDATA_SCHEMA_VERSION as const,
    progress: { g1: { doneTaskIds: ['t1'], currentTaskId: 't2' } },
    soundOn: false,
  };
  saveUserData(data, dir);
  const loaded = loadUserData(dir);
  assert.deepEqual(loaded, data);
});

test('loadUserData falls back to defaults when the file on disk is corrupt', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-test-'));
  fs.writeFileSync(path.join(dir, 'userdata.json'), 'not valid json{{{', 'utf-8');
  const data = loadUserData(dir);
  assert.deepEqual(data.progress, {});
});

test('saveUserData does not leave a stray .tmp file behind', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-test-'));
  saveUserData({ schemaVersion: MATHMACHINE_USERDATA_SCHEMA_VERSION, progress: {}, soundOn: true }, dir);
  assert.equal(fs.existsSync(path.join(dir, 'userdata.json.tmp')), false);
  assert.equal(fs.existsSync(path.join(dir, 'userdata.json')), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/player && node --experimental-strip-types --test src/mathmachine/userDataStorage.test.ts`
Expected: FAIL with "Cannot find module './userDataStorage'"

- [ ] **Step 3: Write the implementation**

```typescript
// packages/player/src/mathmachine/userDataStorage.ts
// Хранение пользовательских данных (прогресс/настройки), отдельно от
// контента (спека, разд. 3). Атомарная запись — временный файл + rename
// (спека, разд. 9), чтобы обрыв записи не портил файл. `baseDir` — только
// для тестируемости; в бою всегда берётся системный каталог пользователя.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { MathMachineUserDataSchema, MATHMACHINE_USERDATA_SCHEMA_VERSION, type MathMachineUserData } from '@kiosk/shared';

function defaultBaseDir(): string {
  const base = process.env.APPDATA || path.join(os.homedir(), '.config');
  return path.join(base, 'kiosk-mathmachine');
}

function userDataPath(baseDir?: string): string {
  const dir = baseDir ?? defaultBaseDir();
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'userdata.json');
}

const FALLBACK: MathMachineUserData = {
  schemaVersion: MATHMACHINE_USERDATA_SCHEMA_VERSION,
  progress: {},
  soundOn: true,
};

export function loadUserData(baseDir?: string): MathMachineUserData {
  const filePath = userDataPath(baseDir);
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = MathMachineUserDataSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

export function saveUserData(data: MathMachineUserData, baseDir?: string): void {
  const filePath = userDataPath(baseDir);
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/player && node --experimental-strip-types --test src/mathmachine/userDataStorage.test.ts`
Expected: PASS, 4 tests, 0 failures

- [ ] **Step 5: Commit**

```bash
git add packages/player/src/mathmachine/userDataStorage.ts packages/player/src/mathmachine/userDataStorage.test.ts
git commit -m "feat(mathmachine): add atomic local storage for user progress/settings"
```

---

### Task 11: `TaskRunner` (answer-check, hint, reveal, narration)

**Files:**
- Create: `packages/player/src/mathmachine/TaskRunner.tsx`

**Interfaces:**
- Consumes: `Task`, `checkTaskAnswer`, `getAnswerMode` from `@kiosk/shared` (Tasks 1, 2); `AnswerInput` (Task 8); `TaskVisual` (Task 9).
- Produces: `TaskRunner` component with props `{ task: Task; soundOn: boolean; onCorrect: () => void; onClose: () => void }` — consumed by Task 12 (`CatalogScreen`). Must be mounted with `key={task.id}` by its parent so switching tasks resets all internal state (no separate reset prop).

No unit test — stateful UI component, verified live in Task 15. **Scope note:** the "interactive hint" (FR-010) is implemented here as a short static hint text per task *type* (not a full replayed tutorial screen) — a deliberate MVP simplification of spec §6, flagged here rather than silently narrowed.

- [ ] **Step 1: Write the component**

```tsx
// packages/player/src/mathmachine/TaskRunner.tsx
import React, { useEffect, useState } from 'react';
import type { Task } from '@kiosk/shared';
import { checkTaskAnswer, getAnswerMode } from '@kiosk/shared';
import AnswerInput from './AnswerInput';
import TaskVisual from './TaskVisual';

interface Props {
  task: Task;
  soundOn: boolean;
  onCorrect: () => void;
  onClose: () => void;
}

type Phase = 'answering' | 'hint' | 'revealed' | 'success';

const HINTS: Record<Task['typeId'], string> = {
  number_counting: 'Посчитай предметы по одному, указывая на каждый пальцем.',
  number_sum_two: 'Сложи первое число со вторым — можно посчитать на пальцах.',
  number_sum_three: 'Складывай числа по порядку, слева направо.',
  number_missing: 'Посмотри, на сколько увеличивается каждое следующее число в ряду.',
  compare_length: 'Сравни отрезки — посмотри, какой из них длиннее визуально.',
};

function playNarration(task: Task) {
  if (!task.audioTaskTextId) return;
  const audio = new Audio(`./media/${task.audioTaskTextId}.mp3`);
  audio.play().catch(() => {});
}

const TaskRunner: React.FC<Props> = ({ task, soundOn, onCorrect, onClose }) => {
  const [answer, setAnswer] = useState<number | string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [phase, setPhase] = useState<Phase>('answering');

  useEffect(() => {
    if (soundOn) playNarration(task);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit() {
    if (answer == null || phase !== 'answering') return;
    if (checkTaskAnswer(task, answer)) {
      setPhase('success');
      setTimeout(onCorrect, 1200);
      return;
    }
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    setPhase(nextAttempts >= 2 ? 'revealed' : 'hint');
  }

  function handleRestart() {
    setAnswer(null);
    setAttempts(0);
    setPhase('answering');
    if (soundOn) playNarration(task);
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span>{task.text}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => soundOn && playNarration(task)} title="Повторить озвучку">🔊</button>
          <button onClick={handleRestart} title="Начать сначала">↺</button>
          <button onClick={onClose} title="Закрыть">✕</button>
        </div>
      </div>

      <TaskVisual task={task} />

      <AnswerInput
        mode={getAnswerMode(task.typeId)}
        choices={task.choices}
        value={answer}
        onChange={setAnswer}
        disabled={phase !== 'answering'}
      />

      {phase === 'hint' && <div style={hintStyle}>Попробуй ещё раз. Подсказка: {HINTS[task.typeId]}</div>}
      {phase === 'revealed' && <div style={revealStyle}>Правильный ответ: {String(task.correctAnswer)}</div>}
      {phase === 'success' && <div style={successStyle}>🎉 Верно!</div>}

      <button
        onClick={phase === 'revealed' ? onCorrect : handleSubmit}
        disabled={phase === 'success' || (answer == null && phase !== 'revealed')}
        style={submitButtonStyle}
      >
        {phase === 'revealed' ? 'Дальше' : 'Ответить'}
      </button>
    </div>
  );
};

const containerStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 16, padding: 24, alignItems: 'center', background: '#fdf6e3', minHeight: '100%', boxSizing: 'border-box' };
const headerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: 640, fontSize: 20, fontWeight: 700 };
const hintStyle: React.CSSProperties = { background: '#fff3cd', padding: 12, borderRadius: 8, maxWidth: 500, textAlign: 'center' };
const revealStyle: React.CSSProperties = { background: '#f8d7da', padding: 12, borderRadius: 8 };
const successStyle: React.CSSProperties = { fontSize: 24 };
const submitButtonStyle: React.CSSProperties = { padding: '12px 32px', fontSize: 18, fontWeight: 700, borderRadius: 10, background: '#e67e22', color: '#fff', border: 'none', cursor: 'pointer' };

export default TaskRunner;
```

- [ ] **Step 2: Commit**

```bash
git add packages/player/src/mathmachine/TaskRunner.tsx
git commit -m "feat(mathmachine): add TaskRunner with hint-on-first-error/reveal-on-second-error state machine"
```

---

### Task 12: `CatalogScreen` (rubricator + group sequencing)

**Files:**
- Create: `packages/player/src/mathmachine/CatalogScreen.tsx`

**Interfaces:**
- Consumes: `MathMachineContent`, `GroupProgress`, `listTopics`, `listGroupsForTopic`, `tasksForGroup`, `nextUndoneTaskId`, `summarizeGroupProgress` from `@kiosk/shared` (Tasks 1, 3); `TaskRunner` (Task 11).
- Produces: `CatalogScreen` component with props `{ content: MathMachineContent; progress: Record<string, GroupProgress>; soundOn: boolean; onProgressChange: (groupId: string, progress: GroupProgress) => void }` — consumed by Task 14 (`MathMachineRuntime`).

No unit test — orchestration component, verified live in Task 15.

- [ ] **Step 1: Write the component**

```tsx
// packages/player/src/mathmachine/CatalogScreen.tsx
import React, { useState } from 'react';
import type { MathMachineContent, GroupProgress } from '@kiosk/shared';
import { listTopics, listGroupsForTopic, tasksForGroup, nextUndoneTaskId, summarizeGroupProgress } from '@kiosk/shared';
import TaskRunner from './TaskRunner';

interface Props {
  content: MathMachineContent;
  progress: Record<string, GroupProgress>;
  soundOn: boolean;
  onProgressChange: (groupId: string, progress: GroupProgress) => void;
}

const CatalogScreen: React.FC<Props> = ({ content, progress, soundOn, onProgressChange }) => {
  const [openTopicId, setOpenTopicId] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  if (activeGroupId) {
    const group = content.groups[activeGroupId];
    const tasks = tasksForGroup(content, activeGroupId);
    const groupProgress = progress[activeGroupId];
    const currentTaskId = nextUndoneTaskId(group, groupProgress) ?? tasks[tasks.length - 1]?.id;
    const currentTask = tasks.find((t) => t.id === currentTaskId);
    if (!currentTask) return null;

    return (
      <TaskRunner
        key={currentTask.id}
        task={currentTask}
        soundOn={soundOn}
        onClose={() => setActiveGroupId(null)}
        onCorrect={() => {
          const doneTaskIds = Array.from(new Set([...(groupProgress?.doneTaskIds ?? []), currentTask.id]));
          const next = nextUndoneTaskId(group, { doneTaskIds, currentTaskId: null });
          onProgressChange(activeGroupId, { doneTaskIds, currentTaskId: next });
          if (!next) setActiveGroupId(null);
        }}
      />
    );
  }

  const topics = listTopics(content);

  return (
    <div style={{ padding: 24 }}>
      <h2>Матемашка — выбери тему</h2>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {topics.map((t) => (
          <button key={t.topicId} onClick={() => setOpenTopicId(t.topicId)} style={topicButtonStyle}>
            {t.topicName}
          </button>
        ))}
      </div>

      {openTopicId && (
        <div style={{ marginTop: 24 }}>
          <h3>{content.topics[openTopicId]?.name}</h3>
          {listGroupsForTopic(content, openTopicId).map((group) => {
            const summary = summarizeGroupProgress(group, progress[group.id]);
            return (
              <div key={group.id} style={groupRowStyle}>
                <span>{group.name}</span>
                <span>{summary.doneCount}/{summary.total}</span>
                <button onClick={() => setActiveGroupId(group.id)}>Начать</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const topicButtonStyle: React.CSSProperties = { padding: '12px 20px', borderRadius: 10, border: '2px solid #8e44ad', background: '#f3e5f5', cursor: 'pointer', fontSize: 16 };
const groupRowStyle: React.CSSProperties = { display: 'flex', gap: 16, alignItems: 'center', padding: '8px 0' };

export default CatalogScreen;
```

- [ ] **Step 2: Commit**

```bash
git add packages/player/src/mathmachine/CatalogScreen.tsx
git commit -m "feat(mathmachine): add catalog rubricator and group task sequencing"
```

---

### Task 13: `weightsLogic` (pure balance math) + `WeightsTool`

**Files:**
- Create: `packages/player/src/mathmachine/tools/weightsLogic.ts`
- Create: `packages/player/src/mathmachine/tools/weightsLogic.test.ts`
- Create: `packages/player/src/mathmachine/tools/WeightsTool.tsx`

**Interfaces:**
- Produces: `WeightPlacement { value: number; pan: 'left' | 'right' | null }`, `computeBalance(weights: WeightPlacement[]): { leftMass: number; rightMass: number; tiltDegrees: number }` — consumed by `WeightsTool` and by Task 14's tool-launch wiring.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/player/src/mathmachine/tools/weightsLogic.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeBalance } from './weightsLogic';

test('computeBalance sums placed weights per pan and ignores unplaced ones', () => {
  const result = computeBalance([
    { value: 3, pan: 'left' },
    { value: 5, pan: 'right' },
    { value: 9, pan: null },
  ]);
  assert.equal(result.leftMass, 3);
  assert.equal(result.rightMass, 5);
});

test('computeBalance tilts toward the heavier side and clamps at 20 degrees', () => {
  const balanced = computeBalance([{ value: 4, pan: 'left' }, { value: 4, pan: 'right' }]);
  assert.equal(balanced.tiltDegrees, 0);

  const rightHeavy = computeBalance([{ value: 1, pan: 'left' }, { value: 9, pan: 'right' }]);
  assert.ok(rightHeavy.tiltDegrees > 0);
  assert.equal(rightHeavy.tiltDegrees, 20);

  const leftHeavy = computeBalance([{ value: 9, pan: 'left' }, { value: 1, pan: 'right' }]);
  assert.ok(leftHeavy.tiltDegrees < 0);
});

test('computeBalance with no weights placed reports zero mass and zero tilt', () => {
  const result = computeBalance([{ value: 5, pan: null }]);
  assert.equal(result.leftMass, 0);
  assert.equal(result.rightMass, 0);
  assert.equal(result.tiltDegrees, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/player && node --experimental-strip-types --test src/mathmachine/tools/weightsLogic.test.ts`
Expected: FAIL with "Cannot find module './weightsLogic'"

- [ ] **Step 3: Write the implementation**

```typescript
// packages/player/src/mathmachine/tools/weightsLogic.ts
// Чистая математика инструмента-лаборатории «Весы» (ТЗ FR-024), без DOM —
// покрывается тестами напрямую, рендер (WeightsTool.tsx) — живой проверкой.

export interface WeightPlacement {
  value: number;
  pan: 'left' | 'right' | null;
}

export interface BalanceResult {
  leftMass: number;
  rightMass: number;
  tiltDegrees: number;
}

const MAX_TILT_DEGREES = 20;
const DEGREES_PER_UNIT_DIFFERENCE = 3;

export function computeBalance(weights: WeightPlacement[]): BalanceResult {
  const leftMass = weights.filter((w) => w.pan === 'left').reduce((s, w) => s + w.value, 0);
  const rightMass = weights.filter((w) => w.pan === 'right').reduce((s, w) => s + w.value, 0);
  const raw = (rightMass - leftMass) * DEGREES_PER_UNIT_DIFFERENCE;
  const tiltDegrees = Math.max(-MAX_TILT_DEGREES, Math.min(MAX_TILT_DEGREES, raw));
  return { leftMass, rightMass, tiltDegrees };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/player && node --experimental-strip-types --test src/mathmachine/tools/weightsLogic.test.ts`
Expected: PASS, 3 tests, 0 failures

- [ ] **Step 5: Write the tool component (no test — live-verified in Task 15)**

```tsx
// packages/player/src/mathmachine/tools/WeightsTool.tsx
import React, { useState } from 'react';
import { Stage, Layer, Line, Text } from 'react-konva';
import { computeBalance, type WeightPlacement } from './weightsLogic';

const AVAILABLE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9];

interface Props {
  onClose: () => void;
}

const WeightsTool: React.FC<Props> = ({ onClose }) => {
  const [weights, setWeights] = useState<WeightPlacement[]>(AVAILABLE_VALUES.map((value) => ({ value, pan: null })));

  const balance = computeBalance(weights);

  function toggle(index: number, pan: 'left' | 'right') {
    setWeights((prev) => prev.map((w, i) => (i === index ? { ...w, pan: w.pan === pan ? null : pan } : w)));
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', maxWidth: 640 }}>
        <h3>Весы</h3>
        <button onClick={onClose}>Выйти</button>
      </div>

      <Stage width={640} height={220}>
        <Layer>
          <Line points={[220, 100, 420, 100]} stroke="#555" strokeWidth={6} rotation={balance.tiltDegrees} x={0} y={0} offsetX={320} offsetY={100} />
          <Text x={160} y={140} text={`Слева: ${balance.leftMass}`} fontSize={18} />
          <Text x={420} y={140} text={`Справа: ${balance.rightMass}`} fontSize={18} />
        </Layer>
      </Stage>

      <p>Слева</p>
      <div style={buttonRowStyle}>
        {weights.map((w, i) => (
          <button key={`left-${w.value}`} onClick={() => toggle(i, 'left')} style={weightButtonStyle(w.pan === 'left')}>
            {w.value}
          </button>
        ))}
      </div>

      <p>Справа</p>
      <div style={buttonRowStyle}>
        {weights.map((w, i) => (
          <button key={`right-${w.value}`} onClick={() => toggle(i, 'right')} style={weightButtonStyle(w.pan === 'right')}>
            {w.value}
          </button>
        ))}
      </div>
    </div>
  );
};

function weightButtonStyle(active: boolean): React.CSSProperties {
  return { padding: '6px 10px', borderRadius: 6, border: active ? '2px solid #2ecc71' : '1px solid #ccc', background: active ? '#eafff2' : '#fff', cursor: 'pointer' };
}

const buttonRowStyle: React.CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap' };

export default WeightsTool;
```

- [ ] **Step 6: Commit**

```bash
git add packages/player/src/mathmachine/tools/weightsLogic.ts packages/player/src/mathmachine/tools/weightsLogic.test.ts packages/player/src/mathmachine/tools/WeightsTool.tsx
git commit -m "feat(mathmachine): add Весы lab tool with tested balance math"
```

---

### Task 14: `MathMachineRuntime` + wire into `Player.tsx`

**Files:**
- Create: `packages/player/src/mathmachine/MathMachineRuntime.tsx`
- Modify: `packages/player/src/Player.tsx` (import + new `switch (widget.type)` case, mirroring the existing `'naturalcommunities'` case)

**Interfaces:**
- Consumes: `MathMachineWidgetProperties`, `MathMachineContent` from `@kiosk/shared` (Task 1); `loadUserData`/`saveUserData` (Task 10); `CatalogScreen` (Task 12); `WeightsTool` (Task 13); `pilotContent.json` (Task 6).

- [ ] **Step 1: Write the top-level runtime component**

```tsx
// packages/player/src/mathmachine/MathMachineRuntime.tsx
import React, { useEffect, useState } from 'react';
import type { MathMachineWidgetProperties, MathMachineContent, MathMachineUserData, GroupProgress } from '@kiosk/shared';
import CatalogScreen from './CatalogScreen';
import WeightsTool from './tools/WeightsTool';
import { loadUserData, saveUserData } from './userDataStorage';
import pilotContentJson from './content/pilotContent.json';

interface Props {
  properties: MathMachineWidgetProperties;
}

type Screen = 'catalog' | 'weights';

const MathMachineRuntime: React.FC<Props> = ({ properties }) => {
  const content = pilotContentJson as unknown as MathMachineContent;
  const [userData, setUserData] = useState<MathMachineUserData>(() => loadUserData());
  const [screen, setScreen] = useState<Screen>('catalog');

  useEffect(() => {
    saveUserData(userData);
  }, [userData]);

  function handleProgressChange(groupId: string, groupProgress: GroupProgress) {
    setUserData((prev) => ({ ...prev, progress: { ...prev.progress, [groupId]: groupProgress } }));
  }

  return (
    <div style={{ width: '100%', height: '100%', background: '#fffdf5', overflow: 'auto' }}>
      <div style={topBarStyle}>
        <span>{properties.title}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setScreen('catalog')}>Задания</button>
          <button onClick={() => setScreen('weights')}>Лаборатория: Весы</button>
          <button onClick={() => setUserData((prev) => ({ ...prev, soundOn: !prev.soundOn }))}>
            {userData.soundOn ? '🔊 Звук вкл' : '🔇 Звук выкл'}
          </button>
        </div>
      </div>

      {screen === 'catalog' && (
        <CatalogScreen
          content={content}
          progress={userData.progress}
          soundOn={userData.soundOn}
          onProgressChange={handleProgressChange}
        />
      )}
      {screen === 'weights' && <WeightsTool onClose={() => setScreen('catalog')} />}
    </div>
  );
};

const topBarStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 24px', fontSize: 14, color: '#555', borderBottom: '1px solid #eee' };

export default MathMachineRuntime;
```

- [ ] **Step 2: Wire it into `Player.tsx`**

Add the import next to `NatComRuntime`'s import at the top of `packages/player/src/Player.tsx`:

```typescript
import MathMachineRuntime from './mathmachine/MathMachineRuntime';
```

Add a new case right after the existing `'naturalcommunities'` case (near line 561), following the exact same full-viewport pattern:

```tsx
      case 'mathmachine':
        // Тот же принцип, что "naturalcommunities"/"chronoline" выше —
        // заполняет реальный размер окна/экрана целиком.
        return (
          <div
            key={widget.id}
            style={{ ...commonStyle, left: 0, top: 0, width: viewportSize.width, height: viewportSize.height, overflow: 'hidden' }}
          >
            <MathMachineRuntime properties={widget.properties as any} />
          </div>
        );
```

- [ ] **Step 3: Type-check the player package**

Run: `cd packages/player && npx tsc --noEmit -p .`
Expected: no new errors from `mathmachine/*` files (grep the output for `mathmachine` to isolate from any pre-existing unrelated errors, same technique as earlier in this session)

- [ ] **Step 4: Commit**

```bash
git add packages/player/src/mathmachine/MathMachineRuntime.tsx packages/player/src/Player.tsx
git commit -m "feat(mathmachine): add top-level runtime screen and wire into Player widget dispatch"
```

---

### Task 15: Live verification (Electron/CDP)

No new files — this task proves Tasks 1–14 actually work together, per this project's hard rule that UI features must be checked by a real run, not just tests+build (multiple real bugs in this repo were caught only this way — see `Сценарий_разработки_фичи.md`, §5).

- [ ] **Step 1: Build a temporary local test project containing the mathmachine widget**

Create a minimal `player/electron/project.json` override (in a scratch copy of the repo, never the real one) with one widget of `type: 'mathmachine'`, `properties: { title: 'Матемашка (тест)' }`, full-canvas size, following the exact same temporary-swap-and-`git checkout --`-revert procedure already used for Тип5 (see memory `kiosk-tip5-natural-communities`, T5-110) — do this in a disposable clone, not the working branch.

- [ ] **Step 2: Run the packaged player and connect over CDP**

`npm run electron:build:win` (or `electron-builder --dir` for a faster unpacked run) in the scratch copy, then launch with `--remote-debugging-port=9333` and connect via a small Node/`ws` script (same technique as Тип5's `cdp_client.js`) — Playwright MCP cannot attach to an arbitrary external Electron CDP port (already documented as a hard MCP limitation, see the same memory file).

- [ ] **Step 3: Walk the golden path and confirm each screen with a screenshot**

- Catalog screen loads showing "Сложение" and "Счёт" topics.
- Opening "Сложение" shows both groups with `0/5` and `0/4` progress.
- Starting "Сложение до 10, шаг 1" shows task `add1_intro` with visible dots-free equation text, numeric keypad, "Ответить" disabled until a digit is entered.
- Submitting a wrong answer once shows the hint banner; submitting wrong twice shows the revealed correct answer and a "Дальше" button.
- Submitting the correct answer shows the success banner and auto-advances; group progress bar updates to `1/5` after returning to the topic view.
- Completing all 5 tasks in the group returns to the catalog with `5/5`.
- "Лаборатория: Весы" screen opens, placing weights on both pans visibly tilts the beam text values and does not throw a console error.
- Sound toggle switches label between "🔊 Звук вкл"/"🔇 Звук выкл"; with sound on, `console.error`-free playback attempt occurs (audio files don't exist yet — Task 16 — so play() is expected to reject silently, not throw uncaught).

- [ ] **Step 4: Fix any bug found live, re-verify, then clean up**

Any real bug found here gets its own small commit with a one-line description of what was wrong and how it was caught (matches this project's established practice of recording live-run findings, not just silently patching). Delete the scratch clone and any temporary CDP scripts afterward — nothing temporary gets committed.

---

### Task 16 (content follow-up, not blocking Task 15): Pilot narration audio

**Files:**
- Create: `packages/player/src/mathmachine/content/generate_pilot_audio.ps1`
- Modify: `packages/player/src/mathmachine/content/pilotContent.json` (fill in `audioTaskTextId` for all 18 tasks)
- Create: `packages/player/src/mathmachine/media/*.mp3` (18 files, one per task)

Uses Windows' built-in offline `System.Speech` SAPI voice (zero cost, zero credentials, works in this environment right now) converted to MP3 via the `ffmpeg` binary already present on this machine (`C:\Users\Алексей\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1-full_build\bin\ffmpeg.exe`, per prior-session notes). **Scope note:** this produces functional, intelligible narration to prove the offline-audio mechanism end-to-end; swapping to a nicer-sounding paid TTS voice (the spec mentioned Yandex SpeechKit as an option) is a cheap later substitution, not redone architecture, since the mechanism (pre-generated MP3, referenced by id) doesn't change.

- [ ] **Step 1: Write the generation script**

```powershell
# packages/player/src/mathmachine/content/generate_pilot_audio.ps1
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoiceByHints('Female')

$ffmpeg = 'C:\Users\Алексей\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1-full_build\bin\ffmpeg.exe'
$contentPath = Join-Path $PSScriptRoot 'pilotContent.json'
$mediaDir = Join-Path $PSScriptRoot '..\media'
New-Item -ItemType Directory -Force -Path $mediaDir | Out-Null

$content = Get-Content $contentPath -Raw | ConvertFrom-Json
foreach ($taskId in $content.tasks.PSObject.Properties.Name) {
    $task = $content.tasks.$taskId
    $wavPath = Join-Path $mediaDir "$taskId.wav"
    $mp3Path = Join-Path $mediaDir "$taskId.mp3"

    $synth.SetOutputToWaveFile($wavPath)
    $synth.Speak($task.text)
    $synth.SetOutputToNull()

    & $ffmpeg -y -i $wavPath -codec:a libmp3lame -qscale:a 4 $mp3Path 2>$null
    Remove-Item $wavPath

    $task.audioTaskTextId = $taskId
}

$content | ConvertTo-Json -Depth 10 | Set-Content $contentPath -Encoding utf8
Write-Host "Generated $($content.tasks.PSObject.Properties.Name.Count) narration files."
```

- [ ] **Step 2: Run the script and confirm output**

Run: `powershell -File packages/player/src/mathmachine/content/generate_pilot_audio.ps1`
Expected: 18 `.mp3` files appear in `packages/player/src/mathmachine/media/`, and `pilotContent.json`'s 18 tasks now each have a non-null `audioTaskTextId` equal to their own task id

- [ ] **Step 3: Re-run the pilot content schema test to confirm it still passes**

Run: `cd packages/player && node --experimental-strip-types --test src/mathmachine/content/pilotContent.test.ts`
Expected: PASS (schema allows `audioTaskTextId` as an optional nullable string — filling it in doesn't break validation)

- [ ] **Step 4: Spot-check one file plays back correctly**

Play `packages/player/src/mathmachine/media/add1_intro.mp3` and confirm it audibly says "Давай научимся складывать числа! Сколько будет 1 плюс 1?" clearly.

- [ ] **Step 5: Commit**

```bash
git add packages/player/src/mathmachine/content/generate_pilot_audio.ps1 packages/player/src/mathmachine/content/pilotContent.json packages/player/src/mathmachine/media/
git commit -m "feat(mathmachine): generate offline pilot narration audio via Windows SAPI"
```

---

### Task 17: Documentation and honest status record

**Files:**
- Create: `Тип6_Матемашка_бэклог.md` (in `C:\Users\Алексей\Desktop\kiosk admin\Тип6_Матемашка\`, project folder, not committed to git — living document, same convention as Тип5's `Тип5_бэклог.md`)
- Create: `Тип6_Матемашка_трассировочная_матрица.md` (same location) — every FR-002…FR-026 mapped to: done in this plan / deferred to Этап 2 / not applicable to Этап 1, with a one-line reason each. In particular record explicitly:
  - FR-020/FR-021 (≥2800 tasks / ≥40 topics) — Этап 2, not this plan (18 tasks / 2 topics delivered here).
  - FR-023/FR-024 (3 tools by name) — 1 of 3 delivered (Весы); Цепочка/Два отрезка — Этап 2.
  - FR-009 (fraction answer input) — not implemented in this plan (only numeric + choice modes); Этап 2.
  - FR-004 (планшеты) — Windows tablets covered by the same Electron player; Android — backlog, no date (user's explicit decision, spec §9).
  - Everything else in the pilot's actual scope (FR-005 through FR-019, FR-025, FR-026 mechanism) — done and live-verified in Task 15.

No code changes in this task — pure documentation, matching this project's rule that living status documents are updated as part of finishing a phase of work, not skipped.

- [ ] **Step 1: Write both documents with the content described above, using the actual final state from Tasks 1–16 (task counts, commit list, what passed live verification) rather than restating this plan's intentions**

- [ ] **Step 2: No commit needed for these two files (outside git, project-folder convention) — just confirm both files exist and open correctly**

---

## Self-Review

**Spec coverage:** §1 (phasing) — Task 17's matrix records what's deferred; §2 (architecture/access) — Tasks 1, 4, 5; §3 (data model) — Task 1; §4 (task engine) — Task 2; §5 (catalog) — Task 3, 12; §6 (answer-check/hint/reveal/audio) — Tasks 8, 9, 10 (audio mechanism), 11, 16 (actual audio files); §7 (lab tool) — Task 13; §8 (content style) — Task 9's scope note + Task 16's scope note make the simplification explicit rather than silent; §9 (reliability/tablets) — Task 10 (atomic writes), decision recorded in Task 17; §10 (build/test/docs) — Task 15 (live run), Task 17 (docs). §11's open questions are explicitly not this plan's job — correctly left alone.

**Placeholder scan:** no TBD/TODO; the two deliberate content-scope simplifications (geometric visuals instead of illustrated art in Task 9; static per-type hint text instead of a replayed tutorial in Task 11) are each called out by name as a decision, with a reason, not left vague — this is the correct way to handle a real scope trade-off, not a placeholder.

**Type consistency check:** `Task`/`Group`/`Topic`/`Section`/`MathMachineContent`/`GroupProgress`/`MathMachineUserData` (Task 1) are used with the same field names throughout Tasks 3, 4, 6, 10, 11, 12, 14 — confirmed no drift (e.g. `taskIds`/`groupIds`/`topicIds` spelled identically everywhere; `doneTaskIds`/`currentTaskId` identical everywhere). `checkTaskAnswer`/`getAnswerMode` (Task 2) signatures match their call sites in Task 11 exactly. `AnswerMode` used identically in Tasks 2, 8, 11. `computeBalance`/`WeightPlacement` (Task 13) used identically in `WeightsTool.tsx`. `loadUserData`/`saveUserData` (Task 10) signatures (`baseDir?: string`) match their call in Task 14 (called with no argument, which is valid since the parameter is optional).
