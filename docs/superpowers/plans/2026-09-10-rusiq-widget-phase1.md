# Тип 7 «РусIQ» Фаза 1 (Плеер + встроенный контент) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить в KIOSK новый standalone-app виджет `rusiq` — многопользовательскую (1-3 игрока, поочерёдно, одно устройство) викторину по русскому языку, с встроенным контентом ≥600 вопросов/≥15 тем, локальным хранением истории результатов, экспортом/импортом файла викторины между проектами KIOSK и allow-list доступом на этапе обкатки.

**Architecture:** Standalone-app Electron-виджет внутри существующего KIOSK Player, по образцу `mathmachine` (не встроенный в канвас, полноэкранный, свой IPC-мост для локальных данных). Контент — один версионированный JSON-файл (не ZIP, как у оригинала), 458 вопросов переносятся прямым разбором `default.oc3rusiq` оригинала и расширяются собственным контентом. Игровая логика — чистые функции без DOM, экраны — тонкие React-компоненты поверх react (без react-konva — здесь не нужен канвас с трансформациями, точки рендерятся обычными позиционированными HTML-элементами поверх `<img>`).

**Tech Stack:** TypeScript, React, Electron IPC (contextBridge), zod (валидация схем), node:test (юнит-тесты), тот же монорепо-стек, что у `packages/player` (Vite, без новых зависимостей).

**Spec:** `docs/superpowers/specs/2026-09-10-rusiq-widget-design.md` (и связанные `docs/superpowers/specs/2026-09-10-rusiq-widget-design.md` правки от 2026-09-10 — читать целиком, план ссылается на её разделы по номерам).

## Global Constraints

- Ветка `feat/rusiq-widget` (уже создана и запушена, HEAD `db02817`) — работать в `C:\recovery_work\kiosk-repo`, коммитить и пушить после КАЖДОЙ задачи (playbook §7 — не дожидаться инцидента потери ветки).
- Схема данных версионируется с первого дня (`schemaVersion: 1` как `z.literal`) — спека, разд. 4.
- Единственная точка входа недоверенных данных (контент, пользовательский прогресс) — через zod `safeParse`, никогда голый `JSON.parse` без валидации.
- **Отклонение от буквального текста спеки, зафиксировать явно**: спека (разд. 3) предполагала `packages/shared/src/rusiq/...` для типа виджета и схемы. Вместо этого — весь код Фазы 1 живёт в `packages/player/src/rusiq/` (модель данных ВКЛЮЧЕНО), а тип виджета `'rusiq'` — обычный строковый литерал, локально продублированный в каждом потребителе (`Player.tsx`, `windowMode.js`, `rusiqAccess.ts`), НЕ импортируемый из `@kiosk/shared`. Причина: (1) у `packages/shared` нет подключённого `npm test` — юнит-тесты там реально никогда не выполняются (задокументированный пробел, см. `kiosk-tip6-mathmachine-recovery` память и `Тип6_бэклог.md` Эпик 24) — размещение в `packages/player` даёт реальное покрытие; (2) уже существующий паттерн `windowMode.js` (`MATHMACHINE_WIDGET_TYPE` объявлен локально, НЕ импортирован из shared) показывает, что дублирование строкового литерала типа виджета — принятая практика в этом репозитории, не костыль. Если Фаза 2 (Редактор) потребует использовать модель данных из `editor-web` — тогда мигрировать в `packages/shared` отдельной задачей, не сейчас.
- `packages/player/package.json` → `"test"` script — glob-паттерн, который явно перечисляет директории с тестами (не рекурсивный). Каждая задача, добавляющая тесты в НОВУЮ директорию/расширение, обязана добавить соответствующий шаблон в этот script — иначе тесты будут существовать, но `npm test` их не увидит (задокументированный класс дефекта, см. `Тип6_ретроспектива_и_рекомендации.md`, §5).
- Живая CDP-проверка обязательна перед сдачей Задачи 6 (полный игровой цикл) — не только юнит-тесты (playbook §5).
- Реальный `packages/player/electron/project.json` в этом репозитории — данные живого клиента «Музей СВО», не шаблон. Перед любой локальной Electron-сборкой для живой проверки — механический протокол backup → тестовый маркер → grep-подтверждение → сборка → немедленное восстановление → grep-подтверждение (playbook §13). Закрывать debug-процессы Electron ТОЛЬКО по PID, никогда по имени образа.

---

### Task 1: Тип виджета `rusiq` — вертикальный срез (открывается, показывает заглушку)

**Files:**
- Create: `packages/player/src/rusiq/RusiqRuntime.tsx`
- Modify: `packages/player/src/Player.tsx:11` (импорт), `:563` (switch-кейс), `:1113` (`isStandaloneAppProject`)
- Modify: `packages/player/electron/chrono/windowMode.js:24-25` (константа + список), добавить `hasRusiqWidget`
- Modify: `packages/player/electron/chrono/windowMode.js` (экспорт функции в конце файла — найти существующий `module.exports`/`export` блок и добавить `hasRusiqWidget` рядом с `hasMathMachineWidget`)
- Test: `packages/player/electron/chrono/windowMode.test.js` (добавить секцию для rusiq)

**Interfaces:**
- Produces: `RusiqRuntime` — React-компонент `React.FC<{ properties: unknown }>` (реальный тип properties появится в Задаче 2, здесь — заглушка `unknown`), рендерит `<div>РусIQ — скоро</div>`.
- Produces: `hasRusiqWidget(projectData: unknown): boolean` в `windowMode.js`, той же сигнатуры, что `hasMathMachineWidget`.

- [ ] **Step 1: Написать падающий тест для `windowMode.js`**

Открыть `packages/player/electron/chrono/windowMode.test.js`, найти секцию `// ─── mathmachine - third standalone-app widget type ───` (около строки 100) и добавить после неё:

```js
// ─── rusiq - fourth standalone-app widget type ─────────────────────────────

test('a rusiq widget switches on window chrome, same as the other standalone-app types', () => {
  const result = buildBrowserWindowOptions({ widgets: [{ id: '1', type: 'rusiq', properties: {} }] });
  assert.deepEqual(result, {
    ...BASE_WINDOW_OPTIONS,
    fullscreen: true,
    kiosk: true,
    frame: false,
  });
});

test('hasRusiqWidget does not fire for the other standalone-app types and vice versa', () => {
  assert.equal(hasRusiqWidget({ widgets: [{ type: 'chronoline' }] }), false);
  assert.equal(hasRusiqWidget({ widgets: [{ type: 'naturalcommunities' }] }), false);
  assert.equal(hasRusiqWidget({ widgets: [{ type: 'mathmachine' }] }), false);
  assert.equal(hasMathMachineWidget({ widgets: [{ type: 'rusiq' }] }), false);
});

test('hasStandaloneAppWidget fires for rusiq too', () => {
  assert.equal(hasStandaloneAppWidget({ widgets: [{ type: 'rusiq' }] }), true);
});
```

И добавить `hasRusiqWidget` в импорт вверху файла (строка 3):
```js
import { buildBrowserWindowOptions, hasChronolineWidget, hasNaturalCommunitiesWidget, hasMathMachineWidget, hasRusiqWidget, hasStandaloneAppWidget, BASE_WINDOW_OPTIONS } from './windowMode.js';
```

Проверь фактический результат `buildBrowserWindowOptions` для существующего `mathmachine`-теста (строка ~103) перед копированием — если там сравнение через `assert.deepEqual(result, {...BASE_WINDOW_OPTIONS, ...})` с другим набором переопределённых полей, скопировать точно тот же набор полей, не «стандартный» из примера выше.

- [ ] **Step 2: Запустить тест, убедиться что падает**

Run: `cd packages/player && node --experimental-strip-types --test electron/chrono/windowMode.test.js`
Expected: FAIL — `hasRusiqWidget is not defined` (импорт не резолвится).

- [ ] **Step 3: Реализовать `hasRusiqWidget` и добавить `rusiq` в список standalone-типов**

В `packages/player/electron/chrono/windowMode.js`, после строки 24 (`const MATHMACHINE_WIDGET_TYPE = 'mathmachine';`):
```js
const RUSIQ_WIDGET_TYPE = 'rusiq';
```
Строку 25 заменить на:
```js
const STANDALONE_APP_WIDGET_TYPES = [CHRONOLINE_WIDGET_TYPE, NATCOM_WIDGET_TYPE, MATHMACHINE_WIDGET_TYPE, RUSIQ_WIDGET_TYPE];
```
После функции `hasMathMachineWidget` (см. существующий блок с JSDoc) добавить:
```js
/**
 * @param {unknown} projectData
 * @returns {boolean}
 */
function hasRusiqWidget(projectData) {
  return hasWidgetOfType(projectData, RUSIQ_WIDGET_TYPE);
}
```
Найти итоговый `module.exports`/`export { ... }` в конце файла и добавить `hasRusiqWidget` в список экспортов рядом с `hasMathMachineWidget`.

- [ ] **Step 4: Запустить тесты, убедиться что проходят**

Run: `cd packages/player && node --experimental-strip-types --test electron/chrono/windowMode.test.js`
Expected: PASS, все тесты включая новые три.

- [ ] **Step 5: Создать заглушку `RusiqRuntime.tsx`**

```tsx
// packages/player/src/rusiq/RusiqRuntime.tsx
import React from 'react';

interface Props {
  properties: unknown;
}

const RusiqRuntime: React.FC<Props> = () => {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', fontSize: 24 }}>
      РусIQ — скоро
    </div>
  );
};

export default RusiqRuntime;
```

- [ ] **Step 6: Подключить виджет в `Player.tsx`**

Добавить импорт после строки 11 (`import MathMachineRuntime from './mathmachine/MathMachineRuntime';`):
```tsx
import RusiqRuntime from './rusiq/RusiqRuntime';
```

После блока `case 'mathmachine':` (строки 563-573) добавить:
```tsx
      case 'rusiq':
        // Тот же принцип, что "mathmachine"/"naturalcommunities"/"chronoline" выше —
        // заполняет реальный размер окна/экрана целиком.
        return (
          <div
            key={widget.id}
            style={{ ...commonStyle, left: 0, top: 0, width: viewportSize.width, height: viewportSize.height, overflow: 'hidden' }}
          >
            <RusiqRuntime properties={widget.properties as any} />
          </div>
        );
```

Строку 1112-1114 (`isStandaloneAppProject`) заменить на:
```tsx
  const isStandaloneAppProject = project.widgets.some(
    (w) => w.type === 'chronoline' || w.type === 'naturalcommunities' || w.type === 'mathmachine' || w.type === 'rusiq'
  );
```

- [ ] **Step 7: Проверить типы**

Run: `cd packages/player && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 8: Коммит**

```bash
git add packages/player/src/rusiq/RusiqRuntime.tsx packages/player/src/Player.tsx packages/player/electron/chrono/windowMode.js packages/player/electron/chrono/windowMode.test.js
git commit -m "feat(rusiq): регистрация типа виджета rusiq, вертикальный срез (заглушка)"
git push
```

---

### Task 2: Схема данных викторины и пользовательских данных (zod)

**Files:**
- Create: `packages/player/src/rusiq/model/schema.ts`
- Test: `packages/player/src/rusiq/model/schema.test.ts`
- Modify: `packages/player/package.json:20` (добавить `src/rusiq/model/*.test.ts` в `"test"` script)

**Interfaces:**
- Produces: `RusiqQuizSchema`, `RusiqQuestionSchema`, `RusiqUserDataSchema` (zod), типы `RusiqQuiz`, `RusiqQuestion`, `RusiqUserData`, константы `RUSIQ_QUIZ_SCHEMA_VERSION = 1`, `RUSIQ_USERDATA_SCHEMA_VERSION = 1`.
- Consumes: ничего (первая задача, создающая содержательный код в `src/rusiq/model/`).

- [ ] **Step 1: Написать падающий тест схемы**

```ts
// packages/player/src/rusiq/model/schema.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RusiqQuizSchema, RusiqUserDataSchema, RUSIQ_QUIZ_SCHEMA_VERSION, RUSIQ_USERDATA_SCHEMA_VERSION } from './schema.ts';

function validQuestion(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'q1',
    text: 'Какая буква пропущена в слове: р…бота?',
    answer: 'а',
    helpText: '',
    x: 209,
    y: 86,
    decoyPoints: [{ x: 458, y: 526 }],
    price: 100,
    timeSeconds: 30,
    level: 1,
    theme: 'Непроверяемые безударные гласные в корне слов',
    ...overrides,
  };
}

function validQuiz(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    schemaVersion: RUSIQ_QUIZ_SCHEMA_VERSION,
    id: 'quiz1',
    title: 'Обучение грамоте',
    intro: 'Викторина по орфографии.',
    themes: ['Непроверяемые безударные гласные в корне слов'],
    passwordHash: null,
    image: { fileName: 'alphabet.png', width: 1280, height: 1024 },
    levels: [{ id: 1, label: 'Начинающий' }, { id: 2, label: 'Опытный' }, { id: 3, label: 'Профессионал' }],
    questions: [validQuestion()],
    genericDecoyPoints: [{ x: 10, y: 20 }],
    ...overrides,
  };
}

test('RusiqQuizSchema accepts a minimal valid quiz', () => {
  const result = RusiqQuizSchema.safeParse(validQuiz());
  assert.equal(result.success, true);
});

test('RusiqQuizSchema rejects a wrong schemaVersion', () => {
  const result = RusiqQuizSchema.safeParse(validQuiz({ schemaVersion: 2 }));
  assert.equal(result.success, false);
});

test('RusiqQuizSchema rejects a question with an out-of-range level', () => {
  const result = RusiqQuizSchema.safeParse(validQuiz({ questions: [validQuestion({ level: 4 })] }));
  assert.equal(result.success, false);
});

test('RusiqQuizSchema rejects a question with empty text', () => {
  const result = RusiqQuizSchema.safeParse(validQuiz({ questions: [validQuestion({ text: '' })] }));
  assert.equal(result.success, false);
});

test('RusiqQuizSchema defaults genericDecoyPoints to an empty array when absent', () => {
  const quiz = validQuiz();
  delete (quiz as Record<string, unknown>).genericDecoyPoints;
  const result = RusiqQuizSchema.safeParse(quiz);
  assert.equal(result.success, true);
  if (result.success) assert.deepEqual(result.data.genericDecoyPoints, []);
});

test('RusiqUserDataSchema accepts empty history and defaults soundOn to true', () => {
  const result = RusiqUserDataSchema.safeParse({ schemaVersion: RUSIQ_USERDATA_SCHEMA_VERSION, sessions: [] });
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.soundOn, true);
});

test('RusiqUserDataSchema accepts a completed session record', () => {
  const result = RusiqUserDataSchema.safeParse({
    schemaVersion: RUSIQ_USERDATA_SCHEMA_VERSION,
    soundOn: true,
    sessions: [{
      id: 's1',
      quizId: 'quiz1',
      playedAtIso: '2026-09-10T12:00:00.000Z',
      players: [{ name: 'Аня', score: 335, correctCount: 49, totalCount: 49 }],
    }],
  });
  assert.equal(result.success, true);
});
```

- [ ] **Step 2: Запустить тест, убедиться что падает**

Run: `cd packages/player && node --experimental-strip-types --test src/rusiq/model/schema.test.ts`
Expected: FAIL — файл `./schema.ts` не существует.

- [ ] **Step 3: Реализовать схему**

```ts
// packages/player/src/rusiq/model/schema.ts
// zod-схемы данных виджета «РусIQ» (Тип 7) — единственная точка, через
// которую проходят данные с границы системы (контент викторины,
// пользовательская история результатов на диске). Тот же принцип, что у
// mathmachine/model/schema.ts.
//
// Размещено в packages/player (не packages/shared) сознательно — см.
// Global Constraints плана: у packages/shared нет подключённого npm test.

import { z } from 'zod';

export const RusiqPointSchema = z.object({
  x: z.number(),
  y: z.number(),
});
export type RusiqPoint = z.infer<typeof RusiqPointSchema>;

export const RusiqLevelIdSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type RusiqLevelId = z.infer<typeof RusiqLevelIdSchema>;

export const RusiqQuestionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  answer: z.string().min(1),
  helpText: z.string().default(''),
  x: z.number(),
  y: z.number(),
  decoyPoints: z.array(RusiqPointSchema).default([]),
  price: z.number().int().positive(),
  timeSeconds: z.number().int().positive(),
  level: RusiqLevelIdSchema,
  theme: z.string().min(1),
});
export type RusiqQuestion = z.infer<typeof RusiqQuestionSchema>;

export const RusiqLevelSchema = z.object({
  id: RusiqLevelIdSchema,
  label: z.string().min(1),
});
export type RusiqLevel = z.infer<typeof RusiqLevelSchema>;

export const RUSIQ_QUIZ_SCHEMA_VERSION = 1 as const;

export const RusiqQuizSchema = z.object({
  schemaVersion: z.literal(RUSIQ_QUIZ_SCHEMA_VERSION),
  id: z.string().min(1),
  title: z.string().min(1),
  intro: z.string().default(''),
  themes: z.array(z.string().min(1)).default([]),
  passwordHash: z.string().nullable().default(null),
  image: z.object({
    fileName: z.string().min(1),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  levels: z.array(RusiqLevelSchema).min(1),
  questions: z.array(RusiqQuestionSchema).min(1),
  genericDecoyPoints: z.array(RusiqPointSchema).default([]),
});
export type RusiqQuiz = z.infer<typeof RusiqQuizSchema>;

// ─── Пользовательские данные — отдельно от контента ────────────────────────

export const RusiqPlayerResultSchema = z.object({
  name: z.string().min(1),
  score: z.number().int().nonnegative(),
  correctCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
});
export type RusiqPlayerResult = z.infer<typeof RusiqPlayerResultSchema>;

export const RusiqSessionSchema = z.object({
  id: z.string().min(1),
  quizId: z.string().min(1),
  playedAtIso: z.string().min(1),
  players: z.array(RusiqPlayerResultSchema).min(1),
});
export type RusiqSession = z.infer<typeof RusiqSessionSchema>;

export const RUSIQ_USERDATA_SCHEMA_VERSION = 1 as const;

export const RusiqUserDataSchema = z.object({
  schemaVersion: z.literal(RUSIQ_USERDATA_SCHEMA_VERSION),
  sessions: z.array(RusiqSessionSchema).default([]),
  soundOn: z.boolean().default(true),
});
export type RusiqUserData = z.infer<typeof RusiqUserDataSchema>;
```

- [ ] **Step 4: Запустить тест, убедиться что проходит**

Run: `cd packages/player && node --experimental-strip-types --test src/rusiq/model/schema.test.ts`
Expected: PASS, 8/8.

- [ ] **Step 5: Подключить новую директорию тестов к `npm test`**

В `packages/player/package.json:20`, в конец списка перед `electron/mathmachine/*.test.js` добавить `src/rusiq/model/*.test.ts`:
```json
"test": "node --experimental-strip-types --test src/chrono/*.test.ts src/natcom/*.test.ts src/mathmachine/*.test.ts src/mathmachine/tools/*.test.ts src/mathmachine/content/*.test.ts src/rusiq/model/*.test.ts electron/chrono/*.test.js electron/natcom/*.test.js electron/mathmachine/*.test.js"
```
(Задачи 3-5 добавят сюда ещё `src/rusiq/*.test.ts`, `src/rusiq/content/*.test.ts`, `electron/rusiq/*.test.js` — обновлять этот же script, не создавать новый.)

- [ ] **Step 6: Проверить, что `npm test` реально подхватывает новый файл**

Run: `cd packages/player && npm test 2>&1 | tail -20`
Expected: в выводе присутствуют тесты из `schema.test.ts`, общий счётчик тестов вырос ровно на 8, 0 fail.

- [ ] **Step 7: Проверить типы и закоммитить**

Run: `cd packages/player && npx tsc --noEmit` — Expected: без ошибок.

```bash
git add packages/player/src/rusiq/model/schema.ts packages/player/src/rusiq/model/schema.test.ts packages/player/package.json
git commit -m "feat(rusiq): zod-схема RusiqQuiz/RusiqQuestion/RusiqUserData"
git push
```

---

### Task 3: IPC-хранилище (`window.rusiqAPI`) и обёртка `userDataStorage`

**Files:**
- Create: `packages/player/electron/rusiq/ipc.js`
- Test: `packages/player/electron/rusiq/ipc.test.js`
- Modify: `packages/player/electron/preload.js` (после блока `mathmachineAPI`, строки 95-98)
- Modify: `packages/player/electron/main.js` (после регистрации `registerMathmachineIpc`, строки 6 и 1186-1189)
- Create: `packages/player/src/rusiq/userDataStorage.ts`
- Test: `packages/player/src/rusiq/userDataStorage.test.ts`
- Modify: `packages/player/package.json:20` (добавить `src/rusiq/*.test.ts`, `electron/rusiq/*.test.js`)

**Interfaces:**
- Consumes: ничего из предыдущих задач напрямую (Task 2's `RusiqUserDataSchema`/`RUSIQ_USERDATA_SCHEMA_VERSION` — импортируются в `userDataStorage.ts`).
- Produces: `window.rusiqAPI.loadUserData(): Promise<unknown>`, `window.rusiqAPI.saveUserData(data): Promise<{ok: boolean}>`; `loadUserData(): Promise<RusiqUserData>`, `saveUserData(data: RusiqUserData): void` (обёртка на стороне рендерера).

- [ ] **Step 1: Написать падающий тест `ipc.js` (main-процесс, без Electron-рантайма)**

```js
// packages/player/electron/rusiq/ipc.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { registerRusiqIpc, readUserData, writeUserDataAtomic, resolveBaseDir } from './ipc.js';

function fakeIpcMain() {
  const handlers = new Map();
  return {
    handle: (channel, fn) => handlers.set(channel, fn),
    invoke: (channel, ...args) => handlers.get(channel)({}, ...args),
  };
}

test('resolveBaseDir creates and returns a directory under app.getPath("appData")', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rusiq-ipc-appdata-'));
  const app = { getPath: () => tmp };
  const { baseDir, isFallback } = resolveBaseDir(app);
  assert.equal(isFallback, false);
  assert.equal(fs.existsSync(baseDir), true);
  assert.equal(baseDir, path.join(tmp, 'kiosk-rusiq'));
});

test('readUserData returns the fallback when the file does not exist', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rusiq-ipc-read-'));
  const result = readUserData(path.join(tmp, 'userdata.json'));
  assert.deepEqual(result, { schemaVersion: 1, sessions: [], soundOn: true });
});

test('writeUserDataAtomic then readUserData round-trips the same data', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rusiq-ipc-roundtrip-'));
  const filePath = path.join(tmp, 'userdata.json');
  const data = { schemaVersion: 1, sessions: [{ id: 's1', quizId: 'q1', playedAtIso: '2026-01-01T00:00:00.000Z', players: [] }], soundOn: false };
  writeUserDataAtomic(filePath, data);
  assert.deepEqual(readUserData(filePath), data);
});

test('registerRusiqIpc wires load/save handlers end-to-end', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rusiq-ipc-register-'));
  const app = { getPath: () => tmp };
  const ipcMain = fakeIpcMain();
  registerRusiqIpc({ ipcMain, app });

  const initial = await ipcMain.invoke('rusiq:load-user-data');
  assert.deepEqual(initial, { schemaVersion: 1, sessions: [], soundOn: true });

  const saveResult = await ipcMain.invoke('rusiq:save-user-data', { schemaVersion: 1, sessions: [], soundOn: false });
  assert.deepEqual(saveResult, { ok: true });

  const reloaded = await ipcMain.invoke('rusiq:load-user-data');
  assert.equal(reloaded.soundOn, false);
});

test('registerRusiqIpc save handler rejects non-object payloads', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rusiq-ipc-reject-'));
  const app = { getPath: () => tmp };
  const ipcMain = fakeIpcMain();
  registerRusiqIpc({ ipcMain, app });
  const result = await ipcMain.invoke('rusiq:save-user-data', 'not-an-object');
  assert.deepEqual(result, { ok: false });
});
```

- [ ] **Step 2: Запустить тест, убедиться что падает**

Run: `cd packages/player && node --experimental-strip-types --test electron/rusiq/ipc.test.js`
Expected: FAIL — модуль `./ipc.js` не существует.

- [ ] **Step 3: Реализовать `ipc.js`** (точная копия структуры `electron/mathmachine/ipc.js`, переименованная под rusiq и с фолбэком `{schemaVersion:1, sessions:[], soundOn:true}`)

```js
// packages/player/electron/rusiq/ipc.js
// Единственная точка, через которую рендерер (виджет «РусIQ») получает
// доступ к пользовательским данным (история результатов/настройки).
// Тот же принцип, что уже устоялся у chronoAPI/natcomAPI/mathmachineAPI
// (packages/player/electron/mathmachine/ipc.js) — вся файловая работа в
// main-процессе, мост через contextBridge (window.rusiqAPI), т.к. рендерер
// Electron в песочнице не имеет доступа к node:fs напрямую.

const fs = require('fs');
const path = require('path');

const RUSIQ_APP_DIR_NAME = 'kiosk-rusiq';
const USERDATA_FILE_NAME = 'userdata.json';

const FALLBACK_USER_DATA = { schemaVersion: 1, sessions: [], soundOn: true };

function resolveBaseDir(app) {
  try {
    const dir = path.join(app.getPath('appData'), RUSIQ_APP_DIR_NAME);
    fs.mkdirSync(dir, { recursive: true });
    return { baseDir: dir, isFallback: false };
  } catch (err) {
    const dir = path.join(require('os').tmpdir(), RUSIQ_APP_DIR_NAME);
    fs.mkdirSync(dir, { recursive: true });
    return { baseDir: dir, isFallback: true };
  }
}

function isPlainRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readUserData(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!isPlainRecord(parsed)) return FALLBACK_USER_DATA;
    return parsed;
  } catch {
    return FALLBACK_USER_DATA;
  }
}

function writeUserDataAtomic(filePath, data) {
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

/**
 * @param {{ ipcMain: import('electron').IpcMain, app: import('electron').App }} deps
 */
function registerRusiqIpc({ ipcMain, app }) {
  const { baseDir, isFallback } = resolveBaseDir(app);
  const filePath = path.join(baseDir, USERDATA_FILE_NAME);

  ipcMain.handle('rusiq:load-user-data', () => readUserData(filePath));
  ipcMain.handle('rusiq:save-user-data', (_event, data) => {
    if (!isPlainRecord(data)) return { ok: false };
    writeUserDataAtomic(filePath, data);
    return { ok: true };
  });

  return { baseDir, isFallback };
}

module.exports = { registerRusiqIpc, readUserData, writeUserDataAtomic, resolveBaseDir };
```

- [ ] **Step 4: Запустить тест, убедиться что проходит**

Run: `cd packages/player && node --experimental-strip-types --test electron/rusiq/ipc.test.js`
Expected: PASS, 5/5.

- [ ] **Step 5: Подключить `preload.js` и `main.js`**

В `packages/player/electron/preload.js`, после блока `mathmachineAPI` (строки 95-98):
```js
contextBridge.exposeInMainWorld('rusiqAPI', {
  loadUserData: () => ipcRenderer.invoke('rusiq:load-user-data'),
  saveUserData: (data) => ipcRenderer.invoke('rusiq:save-user-data', data)
});
```

В `packages/player/electron/main.js:6`, после `const { registerMathmachineIpc } = require('./mathmachine/ipc');`:
```js
const { registerRusiqIpc } = require('./rusiq/ipc');
```
После блока регистрации mathmachine (строки 1186-1189), скопировать структуру с заменой имён:
```js
    const { baseDir: rusiqBaseDir, isFallback: rusiqIsFallback } = registerRusiqIpc({ ipcMain, app });
    fileLog('[rusiq] storage dir:', rusiqBaseDir, rusiqIsFallback ? '(fallback: no write access to shared dir)' : '');
```
(Прочитать реальный контекст строк 1180-1190 в `main.js` перед правкой — там `mathmachine`-блок обёрнут в `try/catch` с `fileLog` при ошибке; скопировать ту же обёртку `try/catch`, а не просто добавить строки внутри существующего блока.)

- [ ] **Step 6: Написать падающий тест `userDataStorage.ts`**

```ts
// packages/player/src/rusiq/userDataStorage.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadUserData, saveUserData } from './userDataStorage.ts';

test('loadUserData returns a valid default when window.rusiqAPI is absent (non-Electron context)', async () => {
  // @ts-expect-error — тестовое окружение без window
  delete globalThis.window;
  const data = await loadUserData();
  assert.deepEqual(data, { schemaVersion: 1, sessions: [], soundOn: true });
});

test('saveUserData does nothing (does not throw) when window.rusiqAPI is absent', () => {
  // @ts-expect-error
  delete globalThis.window;
  assert.doesNotThrow(() => saveUserData({ schemaVersion: 1, sessions: [], soundOn: true }));
});

test('loadUserData falls back to defaults when the API returns malformed data', async () => {
  (globalThis as any).window = { rusiqAPI: { loadUserData: async () => ({ garbage: true }) } };
  const data = await loadUserData();
  assert.deepEqual(data, { schemaVersion: 1, sessions: [], soundOn: true });
});

test('saveUserData then loadUserData round-trips the same data', async () => {
  let stored: unknown = null;
  (globalThis as any).window = {
    rusiqAPI: {
      loadUserData: async () => stored,
      saveUserData: async (data: unknown) => { stored = data; return { ok: true }; },
    },
  };
  const data = { schemaVersion: 1 as const, sessions: [{ id: 's1', quizId: 'q1', playedAtIso: '2026-01-01T00:00:00.000Z', players: [{ name: 'Аня', score: 10, correctCount: 1, totalCount: 1 }] }], soundOn: false };
  saveUserData(data);
  await new Promise((r) => setTimeout(r, 0));
  const reloaded = await loadUserData();
  assert.deepEqual(reloaded, data);
});
```

- [ ] **Step 7: Запустить тест, убедиться что падает**

Run: `cd packages/player && node --experimental-strip-types --test src/rusiq/userDataStorage.test.ts`
Expected: FAIL — файл `./userDataStorage.ts` не существует.

- [ ] **Step 8: Реализовать `userDataStorage.ts`**

```ts
// packages/player/src/rusiq/userDataStorage.ts
// Хранение пользовательских данных (история результатов/настройки),
// отдельно от контента викторины. Тонкая обёртка над window.rusiqAPI
// (packages/player/electron/preload.js), тот же способ, что у
// chronoAPI/natcomAPI/mathmachineAPI.

import { RusiqUserDataSchema, RUSIQ_USERDATA_SCHEMA_VERSION, type RusiqUserData } from './model/schema.ts';

const FALLBACK: RusiqUserData = {
  schemaVersion: RUSIQ_USERDATA_SCHEMA_VERSION,
  sessions: [],
  soundOn: true,
};

declare global {
  interface Window {
    rusiqAPI?: {
      loadUserData: () => Promise<unknown>;
      saveUserData: (data: RusiqUserData) => Promise<{ ok: boolean }>;
    };
  }
}

export async function loadUserData(): Promise<RusiqUserData> {
  if (typeof window === 'undefined' || !window.rusiqAPI) return FALLBACK;
  try {
    const raw = await window.rusiqAPI.loadUserData();
    const parsed = RusiqUserDataSchema.safeParse(raw);
    return parsed.success ? parsed.data : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

export function saveUserData(data: RusiqUserData): void {
  if (typeof window === 'undefined' || !window.rusiqAPI) return;
  window.rusiqAPI.saveUserData(data).catch(() => {
    // Ошибка записи не должна ронять UI — история просто не сохранится
    // на этот раз, следующий saveUserData попробует снова.
  });
}
```

- [ ] **Step 9: Запустить тест, убедиться что проходит**

Run: `cd packages/player && node --experimental-strip-types --test src/rusiq/userDataStorage.test.ts`
Expected: PASS, 4/4.

- [ ] **Step 10: Подключить новые директории к `npm test`**

`packages/player/package.json:20` — добавить `src/rusiq/*.test.ts` и `electron/rusiq/*.test.js`:
```json
"test": "node --experimental-strip-types --test src/chrono/*.test.ts src/natcom/*.test.ts src/mathmachine/*.test.ts src/mathmachine/tools/*.test.ts src/mathmachine/content/*.test.ts src/rusiq/*.test.ts src/rusiq/model/*.test.ts electron/chrono/*.test.js electron/natcom/*.test.js electron/mathmachine/*.test.js electron/rusiq/*.test.js"
```

- [ ] **Step 11: Полный прогон тестов и типов**

Run: `cd packages/player && npm test 2>&1 | tail -20 && npx tsc --noEmit`
Expected: все тесты зелёные, `tsc` без ошибок.

- [ ] **Step 12: Коммит**

```bash
git add packages/player/electron/rusiq/ipc.js packages/player/electron/rusiq/ipc.test.js packages/player/electron/preload.js packages/player/electron/main.js packages/player/src/rusiq/userDataStorage.ts packages/player/src/rusiq/userDataStorage.test.ts packages/player/package.json
git commit -m "feat(rusiq): IPC-хранилище истории результатов (window.rusiqAPI)"
git push
```

---

### Task 4: Конвертация встроенного контента (458 вопросов / 12 тем) из `default.oc3rusiq`

**Files:**
- Create (не коммитить, scratch): `C:\recovery_work\convert_rusiq_content.py`
- Create (коммитить, результат): `packages/player/src/rusiq/content/rusiqContent.json`
- Test: `packages/player/src/rusiq/content/rusiqContent.test.ts`
- Modify: `packages/player/package.json:20` (добавить `src/rusiq/content/*.test.ts`)

**Interfaces:**
- Consumes: `RusiqQuizSchema` (Задача 2) — для валидации результата конверсии.
- Produces: `packages/player/src/rusiq/content/rusiqContent.json` — объект, парсящийся `RusiqQuizSchema` без ошибок, ровно 458 вопросов, ровно 12 уникальных тем, распределение по уровням 165/153/140.

- [ ] **Step 1: Написать конверсионный скрипт (scratch, НЕ коммитить)**

```python
# C:\recovery_work\convert_rusiq_content.py
# Разовый скрипт: парсит questions.xml из распакованного default.oc3rusiq
# (см. Тип7_РусIQ/app_dump/extra/default.oc3rusiq) в формат RusiqQuiz
# (packages/player/src/rusiq/model/schema.ts). НЕ коммитить в репозиторий —
# только его результат (rusiqContent.json).
import re, json, sys, zipfile, io

sys.stdout.reconfigure(encoding='utf-8')

SRC_OC3RUSIQ = r"C:\Users\Алексей\Desktop\kiosk admin\Тип7_РусIQ\app_dump\extra\default.oc3rusiq"
OUT_PATH = r"C:\recovery_work\kiosk-repo\packages\player\src\rusiq\content\rusiqContent.json"

with zipfile.ZipFile(SRC_OC3RUSIQ) as z:
    xml = z.read('questions.xml').decode('utf-8-sig')

# Тема с опечаткой "обозначение" сливается в тему с "обозначения" (один и
# тот же орфографический признак — подтверждено прямым разбором, см. спеку
# разд. 8).
THEME_FIX = {
    'Буква Ь для обозначение мягкости согласных': 'Буква Ь для обозначения мягкости согласных',
}

def parse_attrs(tag_text):
    return dict(re.findall(r'(\w+)="([^"]*)"', tag_text))

question_blocks = re.findall(r'<question\b(.*?)</question>', xml, re.DOTALL)
questions = []
for i, block in enumerate(question_blocks):
    open_tag_attrs_text = block.split('>')[0]
    attrs = parse_attrs(open_tag_attrs_text)
    theme_m = re.search(r'<theme><!\[CDATA\[(.*?)\]\]></theme>', block, re.DOTALL)
    theme = theme_m.group(1).strip() if theme_m else ''
    theme = THEME_FIX.get(theme, theme)
    decoy_points = [
        {'x': int(x), 'y': int(y)}
        for x, y in re.findall(r'<fallsePoint x="(-?\d+)" y="(-?\d+)"', block)
    ]
    questions.append({
        'id': f'rusiq-base-{i+1}',
        'text': attrs['text'],
        'answer': attrs['answer'],
        'helpText': attrs.get('helptext', ''),
        'x': int(attrs['x']),
        'y': int(attrs['y']),
        'decoyPoints': decoy_points,
        'price': int(attrs['price']),
        'timeSeconds': int(attrs['time']),
        'level': int(attrs['level']),
        'theme': theme,
    })

generic_decoy_points = [
    {'x': int(x), 'y': int(y)}
    for x, y in re.findall(r'<fake_question\b[^>]*\bx="(-?\d+)"\s+y="(-?\d+)"', xml)
]

themes = sorted(set(q['theme'] for q in questions))
by_level = {1: 0, 2: 0, 3: 0}
for q in questions:
    by_level[q['level']] += 1

quiz = {
    'schemaVersion': 1,
    'id': 'rusiq-default',
    'title': 'Обучение грамоте',
    'intro': 'Викторина по орфографии русского языка для начальной школы.',
    'themes': themes,
    'passwordHash': None,
    'image': {'fileName': 'alphabet.png', 'width': 1280, 'height': 1024},
    'levels': [
        {'id': 1, 'label': 'Начинающий'},
        {'id': 2, 'label': 'Опытный'},
        {'id': 3, 'label': 'Профессионал'},
    ],
    'questions': questions,
    'genericDecoyPoints': generic_decoy_points,
}

print('questions:', len(questions))
print('themes:', len(themes))
print('by_level:', by_level)
assert len(questions) == 458, f'expected 458, got {len(questions)}'
assert len(themes) == 12, f'expected 12 unique themes, got {len(themes)}: {themes}'
assert by_level == {1: 165, 2: 153, 3: 140}, by_level

with open(OUT_PATH, 'w', encoding='utf-8') as f:
    json.dump(quiz, f, ensure_ascii=False, indent=2)
print('written to', OUT_PATH)
```

Также скопировать реальное изображение фона в `packages/player/src/rusiq/content/alphabet.png` из `Тип7_РусIQ/app_dump/extra` (внутри распакованного `default.oc3rusiq`, файл `images/Alfavit_new.png` — распаковать тем же скриптом или вручную: `unzip -p default.oc3rusiq images/Alfavit_new.png > .../content/alphabet.png`).

- [ ] **Step 2: Запустить конверсионный скрипт и проверить ассерты**

Run: `python3 C:\recovery_work\convert_rusiq_content.py`
Expected: печатает `questions: 458`, `themes: 12`, `by_level: {1: 165, 2: 153, 3: 140}`, ассерты не падают, файл записан.

- [ ] **Step 3: Написать тест-инварианты для контента (вместе с результатом конверсии, не постфактум)**

```ts
// packages/player/src/rusiq/content/rusiqContent.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RusiqQuizSchema } from '../model/schema.ts';
import rusiqContentJson from './rusiqContent.json' with { type: 'json' };

const quiz = RusiqQuizSchema.parse(rusiqContentJson);

test('rusiqContent.json parses against RusiqQuizSchema without errors', () => {
  assert.equal(RusiqQuizSchema.safeParse(rusiqContentJson).success, true);
});

test('base content has at least 450 questions (FR-021)', () => {
  assert.ok(quiz.questions.length >= 450, `expected >=450, got ${quiz.questions.length}`);
});

test('base content has at least 12 unique themes (FR-022)', () => {
  const themes = new Set(quiz.questions.map((q) => q.theme));
  assert.ok(themes.size >= 12, `expected >=12, got ${themes.size}`);
});

test('every question belongs to a valid level with a non-empty pool', () => {
  const byLevel = new Map<number, number>();
  for (const q of quiz.questions) byLevel.set(q.level, (byLevel.get(q.level) ?? 0) + 1);
  for (const level of [1, 2, 3]) {
    assert.ok((byLevel.get(level) ?? 0) > 0, `level ${level} has no questions`);
  }
});

test('no question text is empty and every question has a non-empty answer', () => {
  for (const q of quiz.questions) {
    assert.ok(q.text.trim().length > 0, `question ${q.id} has empty text`);
    assert.ok(q.answer.trim().length > 0, `question ${q.id} has empty answer`);
  }
});

// Геометрический тест-инвариант (спека, разд. 5): правильная точка не должна
// систематически лежать дальше от центра изображения, чем ложные точки того
// же вопроса — иначе "выбери точку ближе к центру" была бы работающей
// эвристикой без чтения вопроса.
test('the correct point is not systematically closer to the image center than its own decoy points', () => {
  const cx = quiz.image.width / 2;
  const cy = quiz.image.height / 2;
  let correctCloserCount = 0;
  let comparableCount = 0;
  for (const q of quiz.questions) {
    if (q.decoyPoints.length === 0) continue;
    comparableCount++;
    const distCorrect = Math.hypot(q.x - cx, q.y - cy);
    const avgDistDecoy = q.decoyPoints.reduce((sum, p) => sum + Math.hypot(p.x - cx, p.y - cy), 0) / q.decoyPoints.length;
    if (distCorrect < avgDistDecoy) correctCloserCount++;
  }
  const fraction = correctCloserCount / comparableCount;
  // Порог 0.65 (не 0.5) — допускает некоторый естественный перекос, но
  // ловит грубую систематическую эвристику "ответ всегда ближе к центру".
  assert.ok(fraction < 0.65, `correct point is closer to center than decoys in ${(fraction * 100).toFixed(1)}% of questions — exploitable heuristic`);
});
```

- [ ] **Step 4: Запустить тест**

Run: `cd packages/player && node --experimental-strip-types --test src/rusiq/content/rusiqContent.test.ts`
Expected: PASS, 6/6. Если геометрический тест падает — не подгонять порог, а разобраться, действительно ли есть систематический перекос в данных, и решить (обычно нет — оригинал раскладывал точки по реальным позициям букв на плакате, не намеренно вокруг центра, так что тест должен пройти естественно).

- [ ] **Step 5: Подключить директорию к `npm test`**

`packages/player/package.json:20` — добавить `src/rusiq/content/*.test.ts`.

- [ ] **Step 6: Полный прогон и типы**

Run: `cd packages/player && npm test 2>&1 | tail -20 && npx tsc --noEmit`

- [ ] **Step 7: Коммит (контент + тест, БЕЗ конверсионного скрипта)**

```bash
git add packages/player/src/rusiq/content/rusiqContent.json packages/player/src/rusiq/content/alphabet.png packages/player/src/rusiq/content/rusiqContent.test.ts packages/player/package.json
git commit -m "feat(rusiq): встроенный контент — перенос 458 вопросов/12 тем из оригинала"
git push
```

---

### Task 5: Игровая логика (подсчёт баллов, очерёдность ходов, назначение вопросов)

**Files:**
- Create: `packages/player/src/rusiq/gameLogic.ts`
- Test: `packages/player/src/rusiq/gameLogic.test.ts`

**Interfaces:**
- Consumes: `RusiqQuestion`, `RusiqLevelId` (Задача 2).
- Produces:
  - `scoreForAnswer(price: number, timeSeconds: number, elapsedSeconds: number, isCorrect: boolean): number`
  - `assignQuestions(pool: RusiqQuestion[], playerCount: number, questionsPerPlayer: number, rng?: () => number): RusiqQuestion[][]`
  - `nextTurn(currentPlayerIndex: number, playerCount: number): number`
  - `summarizeResults(playerNames: string[], answers: { playerIndex: number; score: number; correct: boolean }[]): { name: string; score: number; correctCount: number; totalCount: number }[]`

- [ ] **Step 1: Написать падающие тесты**

```ts
// packages/player/src/rusiq/gameLogic.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreForAnswer, assignQuestions, nextTurn, summarizeResults } from './gameLogic.ts';
import type { RusiqQuestion } from './model/schema.ts';

function q(overrides: Partial<RusiqQuestion> = {}): RusiqQuestion {
  return {
    id: 'q1', text: 't', answer: 'a', helpText: '', x: 0, y: 0, decoyPoints: [],
    price: 100, timeSeconds: 30, level: 1, theme: 'A',
    ...overrides,
  };
}

test('scoreForAnswer gives full price for an instant correct answer', () => {
  assert.equal(scoreForAnswer(100, 30, 0, true), 100);
});

test('scoreForAnswer gives roughly half price for a correct answer at the halfway mark', () => {
  assert.equal(scoreForAnswer(100, 30, 15, true), 50);
});

test('scoreForAnswer gives 0 for a wrong answer regardless of speed', () => {
  assert.equal(scoreForAnswer(100, 30, 0, false), 0);
});

test('scoreForAnswer gives 0 when time is fully elapsed even if marked correct', () => {
  assert.equal(scoreForAnswer(100, 30, 30, true), 0);
});

test('scoreForAnswer never returns a negative score for elapsed > timeSeconds', () => {
  assert.equal(scoreForAnswer(100, 30, 45, true), 0);
});

test('nextTurn cycles through players in order and wraps around', () => {
  assert.equal(nextTurn(0, 3), 1);
  assert.equal(nextTurn(1, 3), 2);
  assert.equal(nextTurn(2, 3), 0);
});

test('nextTurn is a no-op cycle for a single player', () => {
  assert.equal(nextTurn(0, 1), 0);
});

test('assignQuestions gives each player a disjoint set of questions, no repeats across players', () => {
  const pool = Array.from({ length: 10 }, (_, i) => q({ id: `q${i}` }));
  const result = assignQuestions(pool, 2, 3);
  assert.equal(result.length, 2);
  assert.equal(result[0].length, 3);
  assert.equal(result[1].length, 3);
  const allIds = [...result[0], ...result[1]].map((x) => x.id);
  assert.equal(new Set(allIds).size, allIds.length);
});

test('assignQuestions throws when the pool is too small for the requested count', () => {
  const pool = [q({ id: 'q0' }), q({ id: 'q1' })];
  assert.throws(() => assignQuestions(pool, 2, 3));
});

test('assignQuestions is deterministic given a fixed rng', () => {
  const pool = Array.from({ length: 5 }, (_, i) => q({ id: `q${i}` }));
  const fixedRng = () => 0.5;
  const a = assignQuestions(pool, 1, 3, fixedRng);
  const b = assignQuestions(pool, 1, 3, fixedRng);
  assert.deepEqual(a, b);
});

test('summarizeResults aggregates score and correctness per player', () => {
  const result = summarizeResults(['Аня', 'Боря'], [
    { playerIndex: 0, score: 90, correct: true },
    { playerIndex: 1, score: 0, correct: false },
    { playerIndex: 0, score: 60, correct: true },
  ]);
  assert.deepEqual(result, [
    { name: 'Аня', score: 150, correctCount: 2, totalCount: 2 },
    { name: 'Боря', score: 0, correctCount: 0, totalCount: 1 },
  ]);
});
```

- [ ] **Step 2: Запустить тесты, убедиться что падают**

Run: `cd packages/player && node --experimental-strip-types --test src/rusiq/gameLogic.test.ts`
Expected: FAIL — файл `./gameLogic.ts` не существует.

- [ ] **Step 3: Реализовать `gameLogic.ts`**

```ts
// packages/player/src/rusiq/gameLogic.ts
// Чистая игровая логика викторины «РусIQ» — без DOM, без React. Балл
// убывает пропорционально остатку времени (спека, разд. 5): чем быстрее
// верный ответ, тем ближе к полной цене вопроса.

import type { RusiqQuestion } from './model/schema.ts';

export function scoreForAnswer(price: number, timeSeconds: number, elapsedSeconds: number, isCorrect: boolean): number {
  if (!isCorrect) return 0;
  const remainingFraction = Math.max(0, (timeSeconds - elapsedSeconds) / timeSeconds);
  return Math.round(price * remainingFraction);
}

export function nextTurn(currentPlayerIndex: number, playerCount: number): number {
  return (currentPlayerIndex + 1) % playerCount;
}

/**
 * Разбивает пул вопросов на непересекающиеся наборы по playerCount игроков,
 * по questionsPerPlayer вопросов каждому — ни один вопрос не повторяется
 * между игроками в рамках одной игры. Порядок в пуле перемешивается через
 * rng (по умолчанию Math.random) для случайного, но при фиксированном rng —
 * детерминированного результата (нужно для тестов и для брутфорс-подбора
 * контента, если понадобится).
 */
export function assignQuestions(
  pool: RusiqQuestion[],
  playerCount: number,
  questionsPerPlayer: number,
  rng: () => number = Math.random,
): RusiqQuestion[][] {
  const totalNeeded = playerCount * questionsPerPlayer;
  if (pool.length < totalNeeded) {
    throw new Error(`Not enough questions in pool: need ${totalNeeded}, have ${pool.length}`);
  }
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const result: RusiqQuestion[][] = [];
  for (let p = 0; p < playerCount; p++) {
    result.push(shuffled.slice(p * questionsPerPlayer, (p + 1) * questionsPerPlayer));
  }
  return result;
}

export interface RusiqAnswerEvent {
  playerIndex: number;
  score: number;
  correct: boolean;
}

export interface RusiqPlayerSummary {
  name: string;
  score: number;
  correctCount: number;
  totalCount: number;
}

export function summarizeResults(playerNames: string[], answers: RusiqAnswerEvent[]): RusiqPlayerSummary[] {
  return playerNames.map((name, index) => {
    const own = answers.filter((a) => a.playerIndex === index);
    return {
      name,
      score: own.reduce((sum, a) => sum + a.score, 0),
      correctCount: own.filter((a) => a.correct).length,
      totalCount: own.length,
    };
  });
}
```

**Note:** `assignQuestions`' тест на детерминированность (`fixedRng = () => 0.5`) полагается на конкретную реализацию Fisher-Yates выше — если implementer меняет алгоритм перемешивания, тест нужно пересчитать вручную (выполнить функцию и проверить, что результат стабилен при одном и том же `rng`), а не подгонять `fixedRng` под желаемый результат.

- [ ] **Step 4: Запустить тесты, убедиться что проходят**

Run: `cd packages/player && node --experimental-strip-types --test src/rusiq/gameLogic.test.ts`
Expected: PASS, 11/11.

- [ ] **Step 5: Полный прогон и типы**

Run: `cd packages/player && npm test 2>&1 | tail -20 && npx tsc --noEmit`

- [ ] **Step 6: Коммит**

```bash
git add packages/player/src/rusiq/gameLogic.ts packages/player/src/rusiq/gameLogic.test.ts
git commit -m "feat(rusiq): игровая логика — подсчёт баллов, очерёдность, назначение вопросов"
git push
```

---

### Task 6: Экраны и полный игровой поток в `RusiqRuntime`

**Files:**
- Create: `packages/player/src/rusiq/screens/IntroScreen.tsx`
- Create: `packages/player/src/rusiq/screens/GameSetupScreen.tsx`
- Create: `packages/player/src/rusiq/screens/GameBoardScreen.tsx`
- Create: `packages/player/src/rusiq/screens/ResultsScreen.tsx`
- Modify: `packages/player/src/rusiq/RusiqRuntime.tsx` (заменить заглушку Задачи 1 на полный state machine)

**Interfaces:**
- Consumes: `RusiqQuiz`, `RusiqQuestion` (Задача 2); `rusiqContent.json` (Задача 4); `scoreForAnswer`, `assignQuestions`, `nextTurn`, `summarizeResults`, `RusiqPlayerSummary` (Задача 5); `loadUserData`, `saveUserData` (Задача 3).
- Produces: `RusiqRuntime` — финальный компонент, принимает `{ properties: { title?: string } }`.

Это UI-задача — юнит-тестов на сами компоненты нет (React-компоненты без сложной логики внутри, вся логика уже покрыта Задачей 5); обязательна живая CDP-проверка (Step 7 ниже) вместо unit-тестов на сами экраны, тот же принцип, что у Матемашки (playbook §5).

- [ ] **Step 1: Экран интро**

```tsx
// packages/player/src/rusiq/screens/IntroScreen.tsx
import React from 'react';
import type { RusiqQuiz } from '../model/schema.ts';

interface Props {
  quiz: RusiqQuiz;
  onPlay: () => void;
}

const IntroScreen: React.FC<Props> = ({ quiz, onPlay }) => (
  <div style={{ maxWidth: 640, margin: '60px auto', textAlign: 'center', fontFamily: 'sans-serif' }}>
    <h1>{quiz.title}</h1>
    <p>{quiz.intro}</p>
    <ul style={{ textAlign: 'left', display: 'inline-block' }}>
      {quiz.themes.map((theme) => (
        <li key={theme}>{theme}</li>
      ))}
    </ul>
    <div>
      <button onClick={onPlay} style={{ fontSize: 20, padding: '12px 32px', marginTop: 24 }}>
        Играть!
      </button>
    </div>
  </div>
);

export default IntroScreen;
```

- [ ] **Step 2: Экран настройки игры (число игроков → имена → уровень → число вопросов)**

```tsx
// packages/player/src/rusiq/screens/GameSetupScreen.tsx
import React, { useState } from 'react';
import type { RusiqQuiz, RusiqLevelId } from '../model/schema.ts';

export interface GameSetupResult {
  playerNames: string[];
  level: RusiqLevelId;
  questionsPerPlayer: number;
}

interface Props {
  quiz: RusiqQuiz;
  onComplete: (result: GameSetupResult) => void;
}

type Step = 'count' | 'names' | 'level' | 'questionCount';

const QUESTION_COUNT_OPTIONS = [5, 10, 15];

const GameSetupScreen: React.FC<Props> = ({ quiz, onComplete }) => {
  const [step, setStep] = useState<Step>('count');
  const [playerCount, setPlayerCount] = useState(1);
  const [names, setNames] = useState<string[]>(['']);
  const [level, setLevel] = useState<RusiqLevelId>(1);

  function handlePlayerCount(count: number) {
    setPlayerCount(count);
    setNames(Array.from({ length: count }, (_, i) => `Игрок ${i + 1}`));
    setStep('names');
  }

  function handleNamesConfirmed() {
    setStep('level');
  }

  function handleLevelChosen(chosenLevel: RusiqLevelId) {
    setLevel(chosenLevel);
    setStep('questionCount');
  }

  function handleQuestionCountChosen(count: number) {
    onComplete({ playerNames: names, level, questionsPerPlayer: count });
  }

  if (step === 'count') {
    return (
      <div style={{ textAlign: 'center', marginTop: 60, fontFamily: 'sans-serif' }}>
        <h2>Сколько игроков?</h2>
        {[1, 2, 3].map((count) => (
          <button key={count} onClick={() => handlePlayerCount(count)} style={{ margin: 8, fontSize: 18, padding: '10px 24px' }}>
            {count}
          </button>
        ))}
      </div>
    );
  }

  if (step === 'names') {
    return (
      <div style={{ maxWidth: 400, margin: '60px auto', fontFamily: 'sans-serif' }}>
        <h2>Имена игроков</h2>
        {names.map((name, i) => (
          <input
            key={i}
            value={name}
            onChange={(e) => setNames((prev) => prev.map((n, j) => (j === i ? e.target.value : n)))}
            style={{ display: 'block', width: '100%', fontSize: 16, padding: 8, marginBottom: 8 }}
          />
        ))}
        <button onClick={handleNamesConfirmed} style={{ fontSize: 16, padding: '8px 20px' }}>Далее</button>
      </div>
    );
  }

  if (step === 'level') {
    return (
      <div style={{ textAlign: 'center', marginTop: 60, fontFamily: 'sans-serif' }}>
        <h2>Уровень сложности</h2>
        {quiz.levels.map((lvl) => (
          <button key={lvl.id} onClick={() => handleLevelChosen(lvl.id)} style={{ margin: 8, fontSize: 18, padding: '10px 24px' }}>
            {lvl.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center', marginTop: 60, fontFamily: 'sans-serif' }}>
      <h2>Сколько вопросов на игрока?</h2>
      {QUESTION_COUNT_OPTIONS.map((count) => (
        <button key={count} onClick={() => handleQuestionCountChosen(count)} style={{ margin: 8, fontSize: 18, padding: '10px 24px' }}>
          {count}
        </button>
      ))}
    </div>
  );
};

export default GameSetupScreen;
```

- [ ] **Step 3: Игровое поле**

```tsx
// packages/player/src/rusiq/screens/GameBoardScreen.tsx
import React, { useEffect, useState } from 'react';
import type { RusiqPoint, RusiqQuestion } from '../model/schema.ts';
import { scoreForAnswer, nextTurn, type RusiqAnswerEvent } from '../gameLogic.ts';

interface Props {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  playerNames: string[];
  questionsByPlayer: RusiqQuestion[][];
  genericDecoyPoints: RusiqPoint[];
  onFinished: (answers: RusiqAnswerEvent[]) => void;
}

const GameBoardScreen: React.FC<Props> = ({ imageUrl, imageWidth, imageHeight, playerNames, questionsByPlayer, genericDecoyPoints, onFinished }) => {
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [questionIndexByPlayer, setQuestionIndexByPlayer] = useState<number[]>(() => playerNames.map(() => 0));
  const [elapsed, setElapsed] = useState(0);
  const [answers, setAnswers] = useState<RusiqAnswerEvent[]>([]);

  const currentQuestion = questionsByPlayer[currentPlayer][questionIndexByPlayer[currentPlayer]];

  useEffect(() => {
    setElapsed(0);
    const interval = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [currentPlayer, questionIndexByPlayer[currentPlayer]]);

  function advance(event: RusiqAnswerEvent) {
    const updatedAnswers = [...answers, event];
    setAnswers(updatedAnswers);

    const nextIndexForCurrent = questionIndexByPlayer[currentPlayer] + 1;
    const allDone = playerNames.every((_, p) => (p === currentPlayer ? nextIndexForCurrent : questionIndexByPlayer[p]) >= questionsByPlayer[p].length);

    if (allDone) {
      onFinished(updatedAnswers);
      return;
    }

    setQuestionIndexByPlayer((prev) => prev.map((idx, p) => (p === currentPlayer ? nextIndexForCurrent : idx)));
    setCurrentPlayer((prev) => nextTurn(prev, playerNames.length));
  }

  function handleCorrectPointClick() {
    const score = scoreForAnswer(currentQuestion.price, currentQuestion.timeSeconds, elapsed, true);
    advance({ playerIndex: currentPlayer, score, correct: true });
  }

  function handleDecoyPointClick() {
    advance({ playerIndex: currentPlayer, score: 0, correct: false });
  }

  function handleGiveUp() {
    advance({ playerIndex: currentPlayer, score: 0, correct: false });
  }

  const remainingSeconds = Math.max(0, currentQuestion.timeSeconds - elapsed);
  const liveScore = scoreForAnswer(currentQuestion.price, currentQuestion.timeSeconds, elapsed, true);

  return (
    <div style={{ fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: 12, background: '#eee' }}>
        <span>Вопрос {questionIndexByPlayer[currentPlayer] + 1}/{questionsByPlayer[currentPlayer].length}</span>
        <span>Ходит: {playerNames[currentPlayer]}</span>
        <span>Таймер: {remainingSeconds}с</span>
        <span>Очки за верный ответ сейчас: {liveScore}</span>
        <button onClick={handleGiveUp}>Сдаюсь</button>
      </div>
      <p style={{ textAlign: 'center', fontSize: 20 }}>{currentQuestion.text}</p>
      <div style={{ position: 'relative', width: imageWidth, height: imageHeight, margin: '0 auto' }}>
        <img src={imageUrl} width={imageWidth} height={imageHeight} alt="" />
        {/* Общие ложные точки поля (спека, разд. 5) — видны постоянно, не зависят от текущего вопроса. */}
        {genericDecoyPoints.map((point, i) => (
          <button
            key={`generic-${i}`}
            onClick={handleDecoyPointClick}
            style={{ position: 'absolute', left: point.x - 10, top: point.y - 10, width: 20, height: 20, borderRadius: '50%', background: '#999', border: 'none' }}
            aria-label={`generic-decoy-${i}`}
          />
        ))}
        {/* Ложные точки ИМЕННО текущего вопроса. */}
        {currentQuestion.decoyPoints.map((point, i) => (
          <button
            key={`decoy-${i}`}
            onClick={handleDecoyPointClick}
            style={{ position: 'absolute', left: point.x - 10, top: point.y - 10, width: 20, height: 20, borderRadius: '50%', background: 'red', border: 'none' }}
            aria-label={`decoy-${i}`}
          />
        ))}
        {/* Точка правильного ответа — идентифицируется по ссылке на currentQuestion (не по координатам), поэтому клик по ней однозначен даже если совпадает по (x,y) с чужой decoy-точкой. */}
        <button
          onClick={handleCorrectPointClick}
          style={{ position: 'absolute', left: currentQuestion.x - 10, top: currentQuestion.y - 10, width: 20, height: 20, borderRadius: '50%', background: 'red', border: 'none' }}
          aria-label="correct-point"
        />
      </div>
    </div>
  );
};

export default GameBoardScreen;
```

Точка правильного ответа рендерится отдельной кнопкой с собственным обработчиком (`handleCorrectPointClick`), не через сравнение координат клика с `currentQuestion.x/y` — так корректность клика определяется тем, ПО КАКОЙ кнопке кликнули (react-обработчик), а не пересчётом расстояния, что исключает ложные срабатывания при случайном совпадении координат decoy-точки одного вопроса с координатами правильной точки другого.

- [ ] **Step 4: Экран результатов**

```tsx
// packages/player/src/rusiq/screens/ResultsScreen.tsx
import React, { useState } from 'react';
import type { RusiqAnswerEvent } from '../gameLogic.ts';
import { summarizeResults } from '../gameLogic.ts';
import type { RusiqQuestion } from '../model/schema.ts';

interface Props {
  playerNames: string[];
  answers: RusiqAnswerEvent[];
  questionsByPlayer: RusiqQuestion[][];
  onRestart: () => void;
}

const ResultsScreen: React.FC<Props> = ({ playerNames, answers, questionsByPlayer, onRestart }) => {
  const [detailPlayer, setDetailPlayer] = useState<number | null>(null);
  const summaries = summarizeResults(playerNames, answers);

  if (detailPlayer !== null) {
    const playerAnswers = answers.filter((a) => a.playerIndex === detailPlayer);
    const playerQuestions = questionsByPlayer[detailPlayer];
    return (
      <div style={{ maxWidth: 600, margin: '40px auto', fontFamily: 'sans-serif' }}>
        <h2>Детализация: {playerNames[detailPlayer]}</h2>
        <ul>
          {playerAnswers.map((a, i) => (
            <li key={i} style={{ color: a.correct ? 'green' : 'red' }}>
              {playerQuestions[i]?.text} — {a.correct ? `верно, ${a.score} очков` : 'неверно'}
            </li>
          ))}
        </ul>
        <button onClick={() => setDetailPlayer(null)}>Назад к результатам</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <h2>Результаты</h2>
      <table style={{ margin: '0 auto', width: '100%' }}>
        <thead>
          <tr><th>Игрок</th><th>Очки</th><th>Верных</th><th></th></tr>
        </thead>
        <tbody>
          {summaries.map((s, i) => (
            <tr key={s.name}>
              <td>{s.name}</td>
              <td>{s.score}</td>
              <td>{s.correctCount}/{s.totalCount}</td>
              <td><button onClick={() => setDetailPlayer(i)}>Подробнее</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={onRestart} style={{ marginTop: 24, fontSize: 18, padding: '10px 24px' }}>Новая игра</button>
    </div>
  );
};

export default ResultsScreen;
```

- [ ] **Step 5: Собрать `RusiqRuntime.tsx` целиком**

```tsx
// packages/player/src/rusiq/RusiqRuntime.tsx
import React, { useEffect, useState } from 'react';
import IntroScreen from './screens/IntroScreen.tsx';
import GameSetupScreen, { type GameSetupResult } from './screens/GameSetupScreen.tsx';
import GameBoardScreen from './screens/GameBoardScreen.tsx';
import ResultsScreen from './screens/ResultsScreen.tsx';
import { RusiqQuizSchema, type RusiqQuestion, type RusiqUserData, RUSIQ_USERDATA_SCHEMA_VERSION } from './model/schema.ts';
import { assignQuestions, type RusiqAnswerEvent } from './gameLogic.ts';
import { loadUserData, saveUserData } from './userDataStorage.ts';
import rusiqContentJson from './content/rusiqContent.json' with { type: 'json' };
import alphabetImageUrl from './content/alphabet.png';

interface Props {
  properties: { title?: string };
}

type Phase = 'intro' | 'setup' | 'board' | 'results';

const quiz = RusiqQuizSchema.parse(rusiqContentJson);
const INITIAL_USER_DATA: RusiqUserData = { schemaVersion: RUSIQ_USERDATA_SCHEMA_VERSION, sessions: [], soundOn: true };

const RusiqRuntime: React.FC<Props> = () => {
  const [phase, setPhase] = useState<Phase>('intro');
  const [setup, setSetup] = useState<GameSetupResult | null>(null);
  const [questionsByPlayer, setQuestionsByPlayer] = useState<RusiqQuestion[][]>([]);
  const [finalAnswers, setFinalAnswers] = useState<RusiqAnswerEvent[]>([]);
  const [userData, setUserData] = useState<RusiqUserData>(INITIAL_USER_DATA);

  useEffect(() => {
    loadUserData().then(setUserData);
  }, []);

  function handleSetupComplete(result: GameSetupResult) {
    const pool = quiz.questions.filter((q) => q.level === result.level);
    const assigned = assignQuestions(pool, result.playerNames.length, result.questionsPerPlayer);
    setSetup(result);
    setQuestionsByPlayer(assigned);
    setPhase('board');
  }

  function handleGameFinished(answers: RusiqAnswerEvent[]) {
    setFinalAnswers(answers);
    setPhase('results');
    if (setup) {
      const summaries = answers.reduce<Record<number, { correctCount: number; totalCount: number; score: number }>>((acc, a) => {
        const cur = acc[a.playerIndex] ?? { correctCount: 0, totalCount: 0, score: 0 };
        cur.totalCount += 1;
        if (a.correct) cur.correctCount += 1;
        cur.score += a.score;
        acc[a.playerIndex] = cur;
        return acc;
      }, {});
      const updated: RusiqUserData = {
        ...userData,
        sessions: [
          ...userData.sessions,
          {
            id: `session-${Date.now()}`,
            quizId: quiz.id,
            playedAtIso: new Date().toISOString(),
            players: setup.playerNames.map((name, i) => ({
              name,
              score: summaries[i]?.score ?? 0,
              correctCount: summaries[i]?.correctCount ?? 0,
              totalCount: summaries[i]?.totalCount ?? 0,
            })),
          },
        ],
      };
      setUserData(updated);
      saveUserData(updated);
    }
  }

  function handleRestart() {
    setPhase('intro');
    setSetup(null);
    setQuestionsByPlayer([]);
    setFinalAnswers([]);
  }

  if (phase === 'intro') return <IntroScreen quiz={quiz} onPlay={() => setPhase('setup')} />;
  if (phase === 'setup') return <GameSetupScreen quiz={quiz} onComplete={handleSetupComplete} />;
  if (phase === 'board' && setup) {
    return (
      <GameBoardScreen
        imageUrl={alphabetImageUrl}
        imageWidth={quiz.image.width}
        imageHeight={quiz.image.height}
        playerNames={setup.playerNames}
        questionsByPlayer={questionsByPlayer}
        genericDecoyPoints={quiz.genericDecoyPoints}
        onFinished={handleGameFinished}
      />
    );
  }
  if (phase === 'results' && setup) {
    return (
      <ResultsScreen
        playerNames={setup.playerNames}
        answers={finalAnswers}
        questionsByPlayer={questionsByPlayer}
        onRestart={handleRestart}
      />
    );
  }
  return null;
};

export default RusiqRuntime;
```

Проверить, как именно Vite резолвит импорт PNG как URL в этом проекте (найти пример через `grep -rn "\.png'" packages/player/src/mathmachine/` — если там нет прецедента импорта PNG как модуля, использовать `new URL('./content/alphabet.png', import.meta.url).href` вместо `import alphabetImageUrl from './content/alphabet.png'`, в зависимости от того, что реально работает в этой сборке Vite).

- [ ] **Step 6: Проверить типы**

Run: `cd packages/player && npx tsc --noEmit`
Expected: без ошибок (поправить путь импорта картинки, если Step 5 потребовал `new URL(...)`).

- [ ] **Step 7: Живая CDP-проверка полного цикла (ОБЯЗАТЕЛЬНА, playbook §5)**

Следуя протоколу playbook §13 (backup → тестовый маркер → grep-подтверждение → сборка → восстановление):
1. Собрать debug-версию `.exe` с тестовым `project.json` (виджет `rusiq`, минимальные properties).
2. Подключиться по CDP, пройти: интро → «Играть» → 3 игрока → имена → уровень → число вопросов → игровое поле (несколько верных ответов кликом по правильной точке, один клик по decoy-точке, один «Сдаюсь») → результаты → «Подробнее» для одного игрока.
3. Проверить визуально, что общие ложные точки поля (`genericDecoyPoints`) отображаются на игровом поле одновременно с точкой правильного ответа и decoy-точками текущего вопроса.
4. Если `Page.captureScreenshot` зависнет — переключиться на временный `window.__rusiqDebug` хук (playbook §5), не тратить время на диагностику композитора.
5. Немедленно восстановить реальный `project.json`, проверить `git status --short` пустой для него.
6. Закрыть debug-процесс ТОЛЬКО по PID.

- [ ] **Step 8: Коммит**

```bash
git add packages/player/src/rusiq/screens packages/player/src/rusiq/RusiqRuntime.tsx
git commit -m "feat(rusiq): полный игровой поток — интро/настройка/поле/результаты"
git push
```

---

### Task 7: Allow-list доступа к виджету `rusiq`

**Files:**
- Create: `packages/server/src/config/rusiqAccess.ts`
- Test: `packages/server/src/config/rusiqAccess.test.ts`
- Modify: `packages/server/src/controllers/ProjectController.ts:9` (импорт), `:211` (создание проекта), `:373-382` (обновление проекта)

**Interfaces:**
- Produces: `isEmailAllowedForRusiq(email: string | undefined | null): boolean`, `projectDataHasRusiqWidget(projectData: unknown): boolean`.

- [ ] **Step 1: Написать падающий тест**

```ts
// packages/server/src/config/rusiqAccess.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEmailAllowedForRusiq, projectDataHasRusiqWidget } from './rusiqAccess.ts';

test('isEmailAllowedForRusiq allows the known allow-listed email', () => {
  assert.equal(isEmailAllowedForRusiq('mokretcov.m@poznaikino.ru'), true);
});

test('isEmailAllowedForRusiq is case-insensitive', () => {
  assert.equal(isEmailAllowedForRusiq('MOKRETCOV.M@POZNAIKINO.RU'), true);
});

test('isEmailAllowedForRusiq rejects any other email', () => {
  assert.equal(isEmailAllowedForRusiq('someone.else@example.com'), false);
});

test('isEmailAllowedForRusiq rejects undefined/null/empty', () => {
  assert.equal(isEmailAllowedForRusiq(undefined), false);
  assert.equal(isEmailAllowedForRusiq(null), false);
  assert.equal(isEmailAllowedForRusiq(''), false);
});

test('projectDataHasRusiqWidget detects a rusiq widget among others', () => {
  assert.equal(
    projectDataHasRusiqWidget({ widgets: [{ type: 'text' }, { type: 'rusiq' }] }),
    true,
  );
});

test('projectDataHasRusiqWidget returns false when there is no rusiq widget', () => {
  assert.equal(projectDataHasRusiqWidget({ widgets: [{ type: 'text' }] }), false);
  assert.equal(projectDataHasRusiqWidget({}), false);
  assert.equal(projectDataHasRusiqWidget(null), false);
});
```

- [ ] **Step 2: Запустить тест, убедиться что падает**

Run: `cd packages/server && node --experimental-strip-types --test src/config/rusiqAccess.test.ts`
Expected: FAIL — файл `./rusiqAccess.ts` не существует.

- [ ] **Step 3: Реализовать `rusiqAccess.ts`**

```ts
// packages/server/src/config/rusiqAccess.ts
// Тот же принцип, что chronolineAccess.ts/natcomAccess.ts/mathmachineAccess.ts
// — allow-list доступа к РЕДАКТИРОВАНИЮ (создание/сохранение) проекта с
// виджетом «РусIQ» по email аккаунта редактора. По решению пользователя
// (2026-09-10, брейнсторминг Тип7), см.
// docs/superpowers/specs/2026-09-10-rusiq-widget-design.md.
//
// RUSIQ_WIDGET_TYPE объявлена локально, не импортирована из @kiosk/shared —
// тот же паттерн, что MATHMACHINE_WIDGET_TYPE в electron/chrono/windowMode.js.
const RUSIQ_WIDGET_TYPE = 'rusiq';

const RUSIQ_ALLOWED_EMAILS = ['mokretcov.m@poznaikino.ru'];

export function isEmailAllowedForRusiq(email: string | undefined | null): boolean {
  if (!email) return false;
  return RUSIQ_ALLOWED_EMAILS.includes(email.toLowerCase());
}

export function projectDataHasRusiqWidget(projectData: unknown): boolean {
  return (
    !!projectData &&
    typeof projectData === 'object' &&
    Array.isArray((projectData as any).widgets) &&
    (projectData as any).widgets.some(
      (widget: any) => widget && typeof widget === 'object' && widget.type === RUSIQ_WIDGET_TYPE
    )
  );
}
```

- [ ] **Step 4: Запустить тест, убедиться что проходит**

Run: `cd packages/server && node --experimental-strip-types --test src/config/rusiqAccess.test.ts`
Expected: PASS, 6/6.

- [ ] **Step 5: Подключить в `ProjectController.ts`**

Прочитать реальные строки 1-15 и 195-220, 355-385 файла перед правкой (номера строк в этом плане — из состояния файла на момент написания спеки, могли сместиться). Добавить импорт рядом с `mathmachineAccess` (строка ~9):
```ts
import { isEmailAllowedForRusiq, projectDataHasRusiqWidget } from '../config/rusiqAccess';
```
После блока проверки mathmachine при создании проекта (после строки ~216, `}`):
```ts
      if (projectDataHasRusiqWidget(projectData) && !isEmailAllowedForRusiq(req.client.email)) {
        return res.status(403).json({
          error: 'RusIQ widget not allowed',
          message: 'Виджет «РусIQ» пока недоступен для этого аккаунта'
        });
      }
```
После блока проверки mathmachine при обновлении проекта (после строки ~382, `}`):
```ts
      if (
        Object.prototype.hasOwnProperty.call(updates, 'projectData') &&
        projectDataHasRusiqWidget(updates.projectData) &&
        !isEmailAllowedForRusiq(req.client.email)
      ) {
        return res.status(403).json({
          error: 'RusIQ widget not allowed',
          message: 'Виджет «РусIQ» пока недоступен для этого аккаунта'
        });
      }
```

- [ ] **Step 6: Проверить типы и собрать сервер**

Run: `cd packages/server && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 7: Коммит**

```bash
git add packages/server/src/config/rusiqAccess.ts packages/server/src/config/rusiqAccess.test.ts packages/server/src/controllers/ProjectController.ts
git commit -m "feat(rusiq): allow-list доступа к редактированию проекта с виджетом РусIQ"
git push
```

---

### Task 8: Расширение контента до ≥600 вопросов / ≥15 тем

**Files:**
- Modify: `packages/player/src/rusiq/content/rusiqContent.json` (добавить вопросы/темы)
- Modify: `packages/player/src/rusiq/content/rusiqContent.test.ts` (обновить пороги с 450/12 на 600/15 — теперь это не просто минимум ТЗ, а фактическая цель проекта)

**Interfaces:**
- Consumes: `RusiqQuizSchema` (Задача 2) — новые вопросы обязаны проходить ту же валидацию.

- [ ] **Step 1: Спроектировать состав нового контента**

Минимум 3 новые темы (чтобы дойти до ≥15 при 12 перенесённых — спека, разд. 8) и ~150 новых вопросов. Кандидаты тем (не пересекаются по орфографическому признаку с уже перенесёнными 12): «Знаки препинания в конце предложения», «Большая буква в именах собственных», «Перенос слова по слогам». Распределить новые вопросы между тремя уровнями сложности пропорционально уже существующему распределению (165/153/140 ≈ 36%/33%/31%) — не концентрировать весь новый объём в одном уровне.

- [ ] **Step 2: Обновить тест-пороги ДО добавления контента (тест должен упасть первым)**

В `rusiqContent.test.ts` заменить:
```ts
test('base content has at least 450 questions (FR-021)', () => {
  assert.ok(quiz.questions.length >= 450, `expected >=450, got ${quiz.questions.length}`);
});

test('base content has at least 12 unique themes (FR-022)', () => {
  const themes = new Set(quiz.questions.map((q) => q.theme));
  assert.ok(themes.size >= 12, `expected >=12, got ${themes.size}`);
});
```
на:
```ts
test('content has at least 600 questions (project target, above FR-021 minimum of 450)', () => {
  assert.ok(quiz.questions.length >= 600, `expected >=600, got ${quiz.questions.length}`);
});

test('content has at least 15 unique themes (project target, above FR-022 minimum of 12)', () => {
  const themes = new Set(quiz.questions.map((q) => q.theme));
  assert.ok(themes.size >= 15, `expected >=15, got ${themes.size}`);
});

test('no single theme accounts for more than 40% of all questions (balance check)', () => {
  const counts = new Map<string, number>();
  for (const q of quiz.questions) counts.set(q.theme, (counts.get(q.theme) ?? 0) + 1);
  const max = Math.max(...counts.values());
  assert.ok(max / quiz.questions.length <= 0.4, `largest theme is ${((max / quiz.questions.length) * 100).toFixed(1)}% of all questions`);
});
```

Run: `cd packages/player && node --experimental-strip-types --test src/rusiq/content/rusiqContent.test.ts`
Expected: FAIL — 458 < 600, 12 < 15 (баланс-тест пока пройдёт, т.к. в базовом контенте максимум — 134/458 ≈ 29%).

- [ ] **Step 3: Написать новые вопросы и добавить их в `rusiqContent.json`**

Формат каждого нового вопроса — тот же `RusiqQuestion` (Задача 2), `id` с префиксом `rusiq-ext-` (чтобы не конфликтовать с `rusiq-base-*` из Задачи 4), координаты `x`/`y` — новые точки на том же изображении 1280×1024 (не должны совпадать с уже занятыми координатами существующих вопросов/decoy-точек — implementer размещает их на пустых участках плаката/новой темы отдельно, если новая тема требует другого визуального якоря — тогда обсудить с пользователем, нужен ли отдельный `image` на тему, или все темы делят один и тот же плакат алфавита; для орфографических тем типа «Знаки препинания» якорем разумно оставить те же буквы алфавита, что и в базовом контенте, — ответ на большинство таких вопросов всё равно буква).

Это content-authoring работа, не поддающаяся заранее прописанному коду построчно — сам текст 150 вопросов должен быть написан по факту (реальные орфографические/пунктуационные задания для начальной школы), с ссылкой на реальные позиции букв на изображении `alphabet.png` (проверить визуально, какие буквы уже заняты вопросами Задачи 4, какие свободны, через скрипт-инспектор — например, вывести все `(x,y)` существующих вопросов и сравнить с визуальным осмотром картинки).

- [ ] **Step 4: Прогнать тест, убедиться что проходит**

Run: `cd packages/player && node --experimental-strip-types --test src/rusiq/content/rusiqContent.test.ts`
Expected: PASS, все тесты включая новый баланс-тест и обновлённые геометрический/count-тесты.

- [ ] **Step 5: Полный прогон и типы**

Run: `cd packages/player && npm test 2>&1 | tail -20 && npx tsc --noEmit`

- [ ] **Step 6: Коммит**

```bash
git add packages/player/src/rusiq/content/rusiqContent.json packages/player/src/rusiq/content/rusiqContent.test.ts
git commit -m "feat(rusiq): расширение контента до 600+ вопросов / 15+ тем"
git push
```

---

### Task 9: Приёмочная сверка, документация, финальная живая проверка

**Files:**
- Create: `Тип7_РусIQ/Тип7_трассировочная_матрица.md` (вне git, в `C:\Users\Алексей\Desktop\kiosk admin\`)
- Modify: `C:\Users\Алексей\Desktop\kiosk admin\STATUS.md`
- Modify: `CHANGELOG-DEV.md` (в репозитории)

- [ ] **Step 1: Построчная приёмочная сверка**

Пройти таблицу FR-002…FR-026 (спека, разд. 0) — для каждого FR, помеченного «1» или «1 —», подтвердить конкретным механизмом реализации (файл/тест/скриншот живой проверки), по формату, аналогичному `Тип6_трассировочная_матрица.md`. Три сознательных отклонения (разд. 1 спеки) — отдельным подразделом «реализовано через согласованное переосмысление».

- [ ] **Step 2: Финальная живая проверка всего Фазы 1 на собранном `.exe`**

Тот же протокол playbook §13, полный цикл от каталога/интро до результатов с детализацией, для ВСЕХ трёх уровней сложности хотя бы по одному разу (не только уровень «Начинающий», использованный в Задаче 6).

- [ ] **Step 3: Обновить документацию**

`CHANGELOG-DEV.md` — новая датированная секция (2026-09-10 или позже) с кратким описанием фичи, коммитами, найденными живой проверкой багами (если были). `STATUS.md` — новый абзац о статусе Тип7 РусIQ Фаза 1 (задеплоено/готово к деплою/что осталось для Фазы 2).

- [ ] **Step 4: Финальный коммит документации**

```bash
git add CHANGELOG-DEV.md
git commit -m "docs(rusiq): приёмочная сверка Фазы 1, живая проверка полного цикла"
git push
```

(`STATUS.md` и `Тип7_трассировочная_матрица.md` — вне git, сохраняются отдельно, не коммитятся.)

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-10-rusiq-widget-phase1.md`. Two execution options:

**1. Subagent-Driven (recommended)** — я дispatch свежий субагент на каждую задачу, ревью между задачами, быстрая итерация.

**2. Inline Execution** — выполняю задачи в этой сессии через executing-plans, батчами с чекпоинтами.

Какой подход выбираем?
