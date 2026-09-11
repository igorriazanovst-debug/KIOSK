# РусIQ Фаза 2a — редактор викторин (ядро) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать учителю каталог викторин РусIQ, PIN-защищённый режим редактирования, Konva-редактор точек с полной формой вопроса, пароль на конкретную викторину, и механизм выбора активной викторины для реальной игры.

**Architecture:** Новая ветка состояния в `RusiqRuntime.tsx` (loading → teacherGate → catalog → editor) параллельно существующему игровому потоку. Новые IPC-каналы расширяют `window.rusiqAPI` (пользовательские викторины — файлы на диске, не код). Redактор точек — прямой порт Konva-паттерна `packages/player/src/natcom/editor/Workspace.tsx`, упрощённый под немасштабируемые/невращаемые точки. Undo/redo переиспользует существующий генерик `packages/player/src/chrono/history.ts` напрямую (без обёрточного хука — pure functions).

**Tech Stack:** React, react-konva/konva (уже зависимость `packages/player`), zod, Electron IPC (contextBridge), Web Crypto API (SHA-256).

**Spec:** `docs/superpowers/specs/2026-09-11-rusiq-editor-phase2a-design.md`

## Global Constraints

- `RusiqQuizSchema` не меняет ни одного поля — переиспользуется как есть из Фазы 1 (`packages/player/src/rusiq/model/schema.ts`).
- Все новые файлы данных на диске — атомарная запись (tmp+rename), тот же паттерн, что `writeUserDataAtomic` в `packages/player/electron/rusiq/ipc.js`.
- Главный процесс (`ipc.js`, `main.js`) НЕ импортирует zod — валидация схемой только на стороне рендерера (`RusiqQuizSchema.safeParse` перед записью, после чтения).
- Битые/невалидные файлы на диске — пропускаются, никогда не роняют экран (ТЗ §9, «некорректные пользовательские данные не должны приводить к аварийному завершению приложения»).
- PIN/пароль — SHA-256 через `crypto.subtle.digest` (Web Crypto), открытый текст никогда не пишется на диск.
- Экраны виджета РусIQ стилизуются инлайн-стилями (`style={{...}}`), без отдельных `.css`-файлов — существующая конвенция `IntroScreen.tsx`/`GameSetupScreen.tsx`/`GameBoardScreen.tsx`.
- React-компоненты/экраны в этом кодбейзе НЕ юнит-тестируются (нет `@testing-library/react` в зависимостях) — проверяются только живой CDP-проверкой. Юнит-тестами покрывается только чистая логика (схемы, IPC-хендлеры с fs, чистые функции).
- Живая CDP-проверка — обязательный этап, не опциональный (playbook §5), выполняется поверх реального собранного плеера с защитой реальных данных клиента «Музей СВО» (playbook §13: backup → тестовый маркер → grep-подтверждение → сборка → немедленное восстановление → grep-подтверждение).

---

### Task 1: Схема данных — `activeQuizId` и `teacherPinHash`

**Files:**
- Modify: `packages/player/src/rusiq/model/schema.ts`
- Modify: `packages/player/src/rusiq/userDataStorage.ts`
- Test: `packages/player/src/rusiq/model/schema.test.ts`

**Interfaces:**
- Produces: `RusiqUserData.activeQuizId: string | null`, `RusiqUserData.teacherPinHash: string | null` — используются Задачами 6, 7, 8.

- [ ] **Step 1: Написать падающие тесты**

Добавить в конец `packages/player/src/rusiq/model/schema.test.ts`:

```typescript
test('RusiqUserDataSchema defaults activeQuizId and teacherPinHash to null', () => {
  const result = RusiqUserDataSchema.safeParse({ schemaVersion: RUSIQ_USERDATA_SCHEMA_VERSION, sessions: [] });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.activeQuizId, null);
    assert.equal(result.data.teacherPinHash, null);
  }
});

test('RusiqUserDataSchema accepts an explicit activeQuizId and teacherPinHash', () => {
  const result = RusiqUserDataSchema.safeParse({
    schemaVersion: RUSIQ_USERDATA_SCHEMA_VERSION,
    sessions: [],
    activeQuizId: 'quiz-custom-1',
    teacherPinHash: 'abc123',
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.activeQuizId, 'quiz-custom-1');
    assert.equal(result.data.teacherPinHash, 'abc123');
  }
});
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `cd packages/player && node --experimental-strip-types --test src/rusiq/model/schema.test.ts`
Expected: FAIL — `activeQuizId`/`teacherPinHash` не существуют в схеме (получат `undefined`, тест на `assert.equal(..., null)` упадёт, либо zod отбросит лишние поля без ошибки — в любом случае вторая проверка на `result.data.activeQuizId === 'quiz-custom-1'` провалится).

- [ ] **Step 3: Расширить схему**

В `packages/player/src/rusiq/model/schema.ts` заменить:

```typescript
export const RusiqUserDataSchema = z.object({
  schemaVersion: z.literal(RUSIQ_USERDATA_SCHEMA_VERSION),
  sessions: z.array(RusiqSessionSchema).default([]),
  soundOn: z.boolean().default(true),
});
```

на:

```typescript
export const RusiqUserDataSchema = z.object({
  schemaVersion: z.literal(RUSIQ_USERDATA_SCHEMA_VERSION),
  sessions: z.array(RusiqSessionSchema).default([]),
  soundOn: z.boolean().default(true),
  // null = играется встроенная "Обучение грамоте", не magic-id — переживает
  // будущие правки id встроенного контента (Фаза 2a, спека разд. 2.4/1.1).
  activeQuizId: z.string().nullable().default(null),
  // null = PIN режима учителя ещё не задан (Фаза 2a, спека разд. 2.4/3).
  teacherPinHash: z.string().nullable().default(null),
});
```

- [ ] **Step 4: Обновить FALLBACK в userDataStorage.ts**

В `packages/player/src/rusiq/userDataStorage.ts` заменить:

```typescript
const FALLBACK: RusiqUserData = {
  schemaVersion: RUSIQ_USERDATA_SCHEMA_VERSION,
  sessions: [],
  soundOn: true,
};
```

на:

```typescript
const FALLBACK: RusiqUserData = {
  schemaVersion: RUSIQ_USERDATA_SCHEMA_VERSION,
  sessions: [],
  soundOn: true,
  activeQuizId: null,
  teacherPinHash: null,
};
```

- [ ] **Step 5: Убедиться, что тесты проходят**

Run: `cd packages/player && node --experimental-strip-types --test src/rusiq/model/schema.test.ts`
Expected: PASS, все тесты файла (было 7, стало 9).

- [ ] **Step 6: Прогнать весь набор тестов player, чтобы ничего не сломалось**

Run: `cd packages/player && npm test`
Expected: PASS, `fail 0` (было 489 тестов на конец Фазы 1, теперь 491 — +2 из Step 1 этой задачи).

- [ ] **Step 7: Commit**

```bash
git add packages/player/src/rusiq/model/schema.ts packages/player/src/rusiq/model/schema.test.ts packages/player/src/rusiq/userDataStorage.ts
git commit -m "feat(rusiq): добавить activeQuizId и teacherPinHash в RusiqUserDataSchema"
```

---

### Task 2: IPC — CRUD каталога пользовательских викторин

**Files:**
- Modify: `packages/player/electron/rusiq/ipc.js`
- Test: `packages/player/electron/rusiq/ipc.test.js`

**Interfaces:**
- Consumes: `resolveWithinRoot` из `packages/player/electron/chrono/pathGuard.js` (уже существует, сигнатура `(root: string, relativePath: string) => string`, бросает `PathGuardError` при выходе за пределы root).
- Produces: `listQuizMetadata(quizzesDir)`, `loadQuizFile(quizzesDir, quizId)`, `saveQuizFile(quizzesDir, quiz)`, `deleteQuizFile(quizzesDir, quizId)`, `resolveQuizzesDir(baseDir)` — экспортируются из `ipc.js`, используются Задачей 3 (main.js protocol) и тестируются напрямую здесь. IPC-каналы `rusiq:list-quizzes`, `rusiq:load-quiz`, `rusiq:save-quiz`, `rusiq:delete-quiz` — используются Задачей 5 (`quizStore.ts`).

- [ ] **Step 1: Написать падающие тесты**

Добавить в `packages/player/electron/rusiq/ipc.test.js` (после существующего импорта, обновить строку импорта):

```javascript
import { registerRusiqIpc, readUserData, writeUserDataAtomic, resolveBaseDir, listQuizMetadata, loadQuizFile, saveQuizFile, deleteQuizFile, resolveQuizzesDir } from './ipc.js';
```

Добавить в конец файла:

```javascript
test('resolveQuizzesDir creates and returns a "quizzes" subdirectory', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rusiq-quizzes-dir-'));
  const dir = resolveQuizzesDir(tmp);
  assert.equal(dir, path.join(tmp, 'quizzes'));
  assert.equal(fs.existsSync(dir), true);
});

test('listQuizMetadata returns an empty array when the directory has no quiz files', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rusiq-quizzes-empty-'));
  const dir = resolveQuizzesDir(tmp);
  assert.deepEqual(listQuizMetadata(dir), []);
});

test('saveQuizFile then loadQuizFile round-trips the same quiz object', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rusiq-quizzes-roundtrip-'));
  const dir = resolveQuizzesDir(tmp);
  const quiz = { id: 'quiz-abc', title: 'Моя викторина', passwordHash: null, questions: [] };
  saveQuizFile(dir, quiz);
  assert.deepEqual(loadQuizFile(dir, 'quiz-abc'), quiz);
});

test('loadQuizFile returns null for a missing quiz id', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rusiq-quizzes-missing-'));
  const dir = resolveQuizzesDir(tmp);
  assert.equal(loadQuizFile(dir, 'does-not-exist'), null);
});

test('listQuizMetadata reflects saved quizzes with title, hasPassword and updatedAt', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rusiq-quizzes-list-'));
  const dir = resolveQuizzesDir(tmp);
  saveQuizFile(dir, { id: 'quiz-1', title: 'Без пароля', passwordHash: null, questions: [] });
  saveQuizFile(dir, { id: 'quiz-2', title: 'С паролем', passwordHash: 'deadbeef', questions: [] });
  const list = listQuizMetadata(dir).sort((a, b) => a.id.localeCompare(b.id));
  assert.equal(list.length, 2);
  assert.equal(list[0].id, 'quiz-1');
  assert.equal(list[0].title, 'Без пароля');
  assert.equal(list[0].hasPassword, false);
  assert.equal(typeof list[0].updatedAt, 'string');
  assert.equal(list[1].id, 'quiz-2');
  assert.equal(list[1].hasPassword, true);
});

test('listQuizMetadata skips a corrupted quiz file instead of throwing', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rusiq-quizzes-corrupt-'));
  const dir = resolveQuizzesDir(tmp);
  saveQuizFile(dir, { id: 'quiz-good', title: 'Хорошая', passwordHash: null, questions: [] });
  fs.writeFileSync(path.join(dir, 'quiz-bad.json'), '{not valid json');
  const list = listQuizMetadata(dir);
  assert.deepEqual(list.map((q) => q.id), ['quiz-good']);
});

test('deleteQuizFile removes an existing file and returns true', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rusiq-quizzes-delete-'));
  const dir = resolveQuizzesDir(tmp);
  saveQuizFile(dir, { id: 'quiz-x', title: 'X', passwordHash: null, questions: [] });
  assert.equal(deleteQuizFile(dir, 'quiz-x'), true);
  assert.equal(loadQuizFile(dir, 'quiz-x'), null);
});

test('deleteQuizFile returns false for a missing quiz id', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rusiq-quizzes-delete-missing-'));
  const dir = resolveQuizzesDir(tmp);
  assert.equal(deleteQuizFile(dir, 'does-not-exist'), false);
});

test('registerRusiqIpc wires quiz catalog handlers end-to-end', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rusiq-quizzes-e2e-'));
  const app = { getPath: () => tmp };
  const ipcMain = fakeIpcMain();
  registerRusiqIpc({ ipcMain, app });

  assert.deepEqual(await ipcMain.invoke('rusiq:list-quizzes'), []);

  const saveResult = await ipcMain.invoke('rusiq:save-quiz', { id: 'quiz-e2e', title: 'E2E', passwordHash: null, questions: [] });
  assert.deepEqual(saveResult, { ok: true });

  const loaded = await ipcMain.invoke('rusiq:load-quiz', 'quiz-e2e');
  assert.equal(loaded.title, 'E2E');

  const list = await ipcMain.invoke('rusiq:list-quizzes');
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 'quiz-e2e');

  const deleteResult = await ipcMain.invoke('rusiq:delete-quiz', 'quiz-e2e');
  assert.deepEqual(deleteResult, { ok: true });
  assert.equal(await ipcMain.invoke('rusiq:load-quiz', 'quiz-e2e'), null);
});

test('registerRusiqIpc save-quiz handler rejects a payload without a string id', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rusiq-quizzes-reject-'));
  const app = { getPath: () => tmp };
  const ipcMain = fakeIpcMain();
  registerRusiqIpc({ ipcMain, app });
  const result = await ipcMain.invoke('rusiq:save-quiz', { title: 'Без id' });
  assert.deepEqual(result, { ok: false });
});
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `cd packages/player && node --experimental-strip-types --test electron/rusiq/ipc.test.js`
Expected: FAIL — `listQuizMetadata is not a function` (и остальные новые импорты).

- [ ] **Step 3: Реализовать в ipc.js**

В `packages/player/electron/rusiq/ipc.js` добавить импорт после существующих `require`:

```javascript
const { resolveWithinRoot } = require('../chrono/pathGuard');
```

Добавить константу рядом с `USERDATA_FILE_NAME`:

```javascript
const QUIZZES_DIR_NAME = 'quizzes';
```

Добавить функции после `writeUserDataAtomic`:

```javascript
function resolveQuizzesDir(baseDir) {
  const dir = path.join(baseDir, QUIZZES_DIR_NAME);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function quizFilePath(quizzesDir, quizId) {
  return resolveWithinRoot(quizzesDir, `${quizId}.json`);
}

// Главный процесс НЕ валидирует структуру викторины схемой (zod живёт
// только в рендерере, см. Global Constraints плана) - здесь только
// duck-typing минимума, нужного для отображения списка, и защита от
// одного битого файла, роняющего весь каталог (ТЗ §9).
function listQuizMetadata(quizzesDir) {
  let fileNames;
  try {
    fileNames = fs.readdirSync(quizzesDir).filter((name) => name.endsWith('.json'));
  } catch {
    return [];
  }
  const result = [];
  for (const fileName of fileNames) {
    try {
      const filePath = path.join(quizzesDir, fileName);
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (!isPlainRecord(raw) || typeof raw.title !== 'string') continue;
      const id = fileName.slice(0, -'.json'.length);
      const stat = fs.statSync(filePath);
      result.push({
        id,
        title: raw.title,
        hasPassword: typeof raw.passwordHash === 'string' && raw.passwordHash.length > 0,
        updatedAt: stat.mtime.toISOString(),
      });
    } catch {
      // Битый файл - пропускаем, не роняем весь список.
    }
  }
  return result;
}

function loadQuizFile(quizzesDir, quizId) {
  try {
    const filePath = quizFilePath(quizzesDir, quizId);
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function saveQuizFile(quizzesDir, quiz) {
  const filePath = quizFilePath(quizzesDir, quiz.id);
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(quiz), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

function deleteQuizFile(quizzesDir, quizId) {
  try {
    fs.unlinkSync(quizFilePath(quizzesDir, quizId));
    return true;
  } catch {
    return false;
  }
}
```

Заменить `registerRusiqIpc` целиком:

```javascript
function registerRusiqIpc({ ipcMain, app }) {
  const { baseDir, isFallback } = resolveBaseDir(app);
  const filePath = path.join(baseDir, USERDATA_FILE_NAME);
  const quizzesDir = resolveQuizzesDir(baseDir);

  ipcMain.handle('rusiq:load-user-data', () => readUserData(filePath));
  ipcMain.handle('rusiq:save-user-data', (_event, data) => {
    if (!isPlainRecord(data)) return { ok: false };
    writeUserDataAtomic(filePath, data);
    return { ok: true };
  });

  ipcMain.handle('rusiq:list-quizzes', () => listQuizMetadata(quizzesDir));
  ipcMain.handle('rusiq:load-quiz', (_event, quizId) => {
    if (typeof quizId !== 'string' || quizId.length === 0) return null;
    return loadQuizFile(quizzesDir, quizId);
  });
  ipcMain.handle('rusiq:save-quiz', (_event, quiz) => {
    if (!isPlainRecord(quiz) || typeof quiz.id !== 'string' || quiz.id.length === 0) return { ok: false };
    try {
      saveQuizFile(quizzesDir, quiz);
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });
  ipcMain.handle('rusiq:delete-quiz', (_event, quizId) => {
    if (typeof quizId !== 'string' || quizId.length === 0) return { ok: false };
    return { ok: deleteQuizFile(quizzesDir, quizId) };
  });

  return { baseDir, isFallback, quizzesDir };
}

module.exports = {
  registerRusiqIpc,
  readUserData,
  writeUserDataAtomic,
  resolveBaseDir,
  listQuizMetadata,
  loadQuizFile,
  saveQuizFile,
  deleteQuizFile,
  resolveQuizzesDir,
};
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `cd packages/player && node --experimental-strip-types --test electron/rusiq/ipc.test.js`
Expected: PASS, все тесты файла (было 5, стало 14).

- [ ] **Step 5: Commit**

```bash
git add packages/player/electron/rusiq/ipc.js packages/player/electron/rusiq/ipc.test.js
git commit -m "feat(rusiq): IPC для CRUD каталога пользовательских викторин"
```

---

### Task 3: IPC + протокол `rusiqmedia://` — хранение фонового изображения викторины

**Files:**
- Modify: `packages/player/electron/rusiq/ipc.js`
- Modify: `packages/player/electron/main.js`
- Test: `packages/player/electron/rusiq/ipc.test.js`

**Interfaces:**
- Consumes: `resolveQuizzesDir`, `quizFilePath`-стиль резолвинг из Задачи 2.
- Produces: `saveQuizBackground(quizzesDir, quizId, buffer, mimeType)` (экспорт из `ipc.js`), IPC-канал `rusiq:save-quiz-background`, протокол `rusiqmedia://` в `main.js` — используются Задачей 5 (`quizStore.ts`) и Задачей 11 (`EditorScreen.tsx`, построение URL картинки).

- [ ] **Step 1: Написать падающие тесты**

Обновить импорт в `packages/player/electron/rusiq/ipc.test.js`:

```javascript
import { registerRusiqIpc, readUserData, writeUserDataAtomic, resolveBaseDir, listQuizMetadata, loadQuizFile, saveQuizFile, deleteQuizFile, resolveQuizzesDir, saveQuizBackground } from './ipc.js';
```

Добавить в конец файла:

```javascript
test('saveQuizBackground writes a file named "<quizId>-background.<ext>" and returns its fileName', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rusiq-bg-'));
  const dir = resolveQuizzesDir(tmp);
  const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG-сигнатура, содержимое не проверяется
  const result = saveQuizBackground(dir, 'quiz-bg-1', buffer, 'image/png');
  assert.deepEqual(result, { ok: true, fileName: 'quiz-bg-1-background.png' });
  assert.equal(fs.existsSync(path.join(dir, 'quiz-bg-1-background.png')), true);
});

test('saveQuizBackground rejects an unsupported mime type', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rusiq-bg-reject-'));
  const dir = resolveQuizzesDir(tmp);
  const result = saveQuizBackground(dir, 'quiz-bg-2', Buffer.from([1, 2, 3]), 'application/pdf');
  assert.deepEqual(result, { ok: false });
});

test('registerRusiqIpc save-quiz-background handler round-trips through IPC', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rusiq-bg-ipc-'));
  const app = { getPath: () => tmp };
  const ipcMain = fakeIpcMain();
  const { quizzesDir } = registerRusiqIpc({ ipcMain, app });
  const buffer = new Uint8Array([0xff, 0xd8, 0xff]).buffer; // JPEG-сигнатура
  const result = await ipcMain.invoke('rusiq:save-quiz-background', 'quiz-bg-3', buffer, 'image/jpeg');
  assert.deepEqual(result, { ok: true, fileName: 'quiz-bg-3-background.jpg' });
  assert.equal(fs.existsSync(path.join(quizzesDir, 'quiz-bg-3-background.jpg')), true);
});
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `cd packages/player && node --experimental-strip-types --test electron/rusiq/ipc.test.js`
Expected: FAIL — `saveQuizBackground is not a function`.

- [ ] **Step 3: Реализовать в ipc.js**

Добавить константу и функцию перед `registerRusiqIpc`:

```javascript
const BACKGROUND_EXT_BY_MIME = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

function saveQuizBackground(quizzesDir, quizId, bufferLike, mimeType) {
  const ext = BACKGROUND_EXT_BY_MIME[mimeType];
  if (!ext) return { ok: false };
  const fileName = `${quizId}-background${ext}`;
  const filePath = resolveWithinRoot(quizzesDir, fileName);
  const buffer = Buffer.isBuffer(bufferLike) ? bufferLike : Buffer.from(bufferLike);
  fs.writeFileSync(filePath, buffer);
  return { ok: true, fileName };
}
```

Внутри `registerRusiqIpc`, после хендлера `rusiq:delete-quiz`, добавить:

```javascript
  ipcMain.handle('rusiq:save-quiz-background', (_event, quizId, arrayBuffer, mimeType) => {
    if (typeof quizId !== 'string' || quizId.length === 0) return { ok: false };
    try {
      return saveQuizBackground(quizzesDir, quizId, arrayBuffer, mimeType);
    } catch {
      return { ok: false };
    }
  });
```

Добавить `saveQuizBackground` в `module.exports`.

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `cd packages/player && node --experimental-strip-types --test electron/rusiq/ipc.test.js`
Expected: PASS, все тесты файла (было 14, стало 17).

- [ ] **Step 5: Зарегистрировать протокол `rusiqmedia://` в main.js**

В `packages/player/electron/main.js` найти строку `let natcomAssetsDir = null;` (около строки 66) и добавить сразу после:

```javascript
let rusiqQuizzesDir = null;
```

Найти блок `registerSchemesAsPrivileged` (около строки 42-53) и добавить новый элемент в массив, после схемы `natcomlib`:

```javascript
    // rusiqmedia - пользовательские фоновые изображения викторин виджета
    // «РусIQ» (Фаза 2a), тот же принцип, что chronomedia/natcomlib - без
    // bypassCSP, схема явно добавлена в CSP-заголовок ниже.
    { scheme: 'rusiqmedia', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
```

Найти строку с CSP-заголовком (около строки 1210):

```javascript
        'Content-Security-Policy': ["default-src 'self' 'unsafe-inline' 'unsafe-eval' data: file: blob: chronomedia: natcomlib: http: https: ws: wss:"]
```

заменить на:

```javascript
        'Content-Security-Policy': ["default-src 'self' 'unsafe-inline' 'unsafe-eval' data: file: blob: chronomedia: natcomlib: rusiqmedia: http: https: ws: wss:"]
```

Найти вызов `registerRusiqIpc` (около строки 1197):

```javascript
    const { baseDir: rusiqBaseDir, isFallback: rusiqIsFallback } = registerRusiqIpc({ ipcMain, app });
    fileLog('[rusiq] storage dir:', rusiqBaseDir, rusiqIsFallback ? '(fallback: no write access to shared dir)' : '');
```

заменить на:

```javascript
    const { baseDir: rusiqBaseDir, isFallback: rusiqIsFallback, quizzesDir: rusiqQuizzesDirResult } = registerRusiqIpc({ ipcMain, app });
    rusiqQuizzesDir = rusiqQuizzesDirResult;
    fileLog('[rusiq] storage dir:', rusiqBaseDir, rusiqIsFallback ? '(fallback: no write access to shared dir)' : '');
```

Найти блок `protocol.handle('natcomlib', ...)` (около строки 1344-1362) и добавить сразу ПОСЛЕ его закрывающей `});`:

```javascript
  // Обработчик протокола rusiqmedia:///<fileName> → фоновое изображение
  // пользовательской викторины «РусIQ» (Фаза 2a), packages/player/electron/
  // rusiq/ipc.js resolveQuizzesDir. Пустой host, как у natcomlib - имя
  // файла целиком в pathname.
  protocol.handle('rusiqmedia', async (request) => {
    try {
      if (!rusiqQuizzesDir) return new Response('Not initialized', { status: 503 });

      const u = new URL(request.url);
      const fileName = decodeURIComponent(u.pathname.replace(/^\/+/, ''));
      const filePath = chronoResolveWithinRoot(rusiqQuizzesDir, fileName);

      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        return new Response('Not found', { status: 404 });
      }

      const stat = fs.statSync(filePath);
      const mime = guessMime(fileName, filePath);
      const stream = fs.createReadStream(filePath);
      return new Response(nodeStreamToWeb(stream), {
        status: 200,
        headers: { 'Content-Type': mime, 'Content-Length': String(stat.size) }
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
```

- [ ] **Step 6: Прогнать весь набор тестов player**

Run: `cd packages/player && npm test`
Expected: PASS, `fail 0` (491 после Задачи 1 + 9 новых `ipc.test.js` из Задачи 2 + 3 новых из этой задачи = 503).

- [ ] **Step 7: `tsc --noEmit` (main.js — не TypeScript, но проверяем, что правки не сломали типизированный код рядом)**

Run: `cd packages/player && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 8: Commit**

```bash
git add packages/player/electron/rusiq/ipc.js packages/player/electron/rusiq/ipc.test.js packages/player/electron/main.js
git commit -m "feat(rusiq): хранение фонового изображения викторины + протокол rusiqmedia://"
```

---

### Task 4: `pinAuth.ts` — хэширование PIN/пароля

**Files:**
- Create: `packages/player/src/rusiq/editor/pinAuth.ts`
- Test: `packages/player/src/rusiq/editor/pinAuth.test.ts`

**Interfaces:**
- Produces: `hashSecret(text: string): Promise<string>`, `verifySecret(text: string, hash: string | null): Promise<boolean>` — используются Задачами 7 (TeacherGateScreen), 8 (QuizCatalogScreen — пароль на редактирование), 11 (EditorScreen — установка/снятие пароля викторины).

- [ ] **Step 1: Написать падающий тест**

```typescript
// packages/player/src/rusiq/editor/pinAuth.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashSecret, verifySecret } from './pinAuth.ts';

test('hashSecret produces a 64-character hex SHA-256 digest', async () => {
  const hash = await hashSecret('1234');
  assert.equal(hash.length, 64);
  assert.match(hash, /^[0-9a-f]{64}$/);
});

test('hashSecret is deterministic for the same input', async () => {
  const a = await hashSecret('teacher-pin');
  const b = await hashSecret('teacher-pin');
  assert.equal(a, b);
});

test('hashSecret produces different hashes for different inputs', async () => {
  const a = await hashSecret('1234');
  const b = await hashSecret('4321');
  assert.notEqual(a, b);
});

test('verifySecret returns true for the matching plaintext', async () => {
  const hash = await hashSecret('correct-horse');
  assert.equal(await verifySecret('correct-horse', hash), true);
});

test('verifySecret returns false for a non-matching plaintext', async () => {
  const hash = await hashSecret('correct-horse');
  assert.equal(await verifySecret('wrong-guess', hash), false);
});

test('verifySecret returns false when hash is null (not yet set)', async () => {
  assert.equal(await verifySecret('anything', null), false);
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `cd packages/player && node --experimental-strip-types --test src/rusiq/editor/pinAuth.test.ts`
Expected: FAIL — файл `pinAuth.ts` не существует.

- [ ] **Step 3: Реализовать**

```typescript
// packages/player/src/rusiq/editor/pinAuth.ts
// SHA-256 хэширование PIN режима учителя и пароля конкретной викторины
// через Web Crypto API (доступен в renderer без IPC-круговорота) - тот же
// алгоритм, что уже используется в проекте для licenseKeyHash (project.json).
// Открытый текст никогда не сохраняется - только хэш (спека Фазы 2a, разд. 3).

export async function hashSecret(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifySecret(text: string, hash: string | null): Promise<boolean> {
  if (hash === null) return false;
  return (await hashSecret(text)) === hash;
}
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `cd packages/player && node --experimental-strip-types --test src/rusiq/editor/pinAuth.test.ts`
Expected: PASS, 6/6.

- [ ] **Step 5: Commit**

```bash
git add packages/player/src/rusiq/editor/pinAuth.ts packages/player/src/rusiq/editor/pinAuth.test.ts
git commit -m "feat(rusiq): хэширование PIN/пароля через Web Crypto SHA-256"
```

---

### Task 5: `quizStore.ts` (рендерер) + `preload.js`

**Files:**
- Modify: `packages/player/electron/preload.js`
- Create: `packages/player/src/rusiq/editor/quizStore.ts`
- Test: `packages/player/src/rusiq/editor/quizStore.test.ts`

**Interfaces:**
- Consumes: IPC-каналы `rusiq:list-quizzes`/`load-quiz`/`save-quiz`/`delete-quiz`/`save-quiz-background` из Задач 2-3, `RusiqQuizSchema` из `../model/schema.ts`.
- Produces: `listQuizzes(): Promise<QuizListEntry[]>`, `loadQuiz(id: string): Promise<RusiqQuiz | null>`, `saveQuiz(quiz: RusiqQuiz): Promise<boolean>`, `deleteQuiz(id: string): Promise<boolean>`, `saveQuizBackground(quizId: string, buffer: ArrayBuffer, mimeType: string): Promise<{ok: boolean; fileName?: string}>`, тип `QuizListEntry` — используются Задачами 6, 7, 8, 11.

- [ ] **Step 1: Обновить `preload.js`**

Заменить блок `contextBridge.exposeInMainWorld('rusiqAPI', ...)`:

```javascript
contextBridge.exposeInMainWorld('rusiqAPI', {
  loadUserData: () => ipcRenderer.invoke('rusiq:load-user-data'),
  saveUserData: (data) => ipcRenderer.invoke('rusiq:save-user-data', data)
});
```

на:

```javascript
contextBridge.exposeInMainWorld('rusiqAPI', {
  loadUserData: () => ipcRenderer.invoke('rusiq:load-user-data'),
  saveUserData: (data) => ipcRenderer.invoke('rusiq:save-user-data', data),
  listQuizzes: () => ipcRenderer.invoke('rusiq:list-quizzes'),
  loadQuiz: (quizId) => ipcRenderer.invoke('rusiq:load-quiz', quizId),
  saveQuiz: (quiz) => ipcRenderer.invoke('rusiq:save-quiz', quiz),
  deleteQuiz: (quizId) => ipcRenderer.invoke('rusiq:delete-quiz', quizId),
  saveQuizBackground: (quizId, arrayBuffer, mimeType) => ipcRenderer.invoke('rusiq:save-quiz-background', quizId, arrayBuffer, mimeType)
});
```

- [ ] **Step 2: Написать падающие тесты**

```typescript
// packages/player/src/rusiq/editor/quizStore.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listQuizzes, loadQuiz, saveQuiz, deleteQuiz, saveQuizBackground } from './quizStore.ts';
import { RUSIQ_QUIZ_SCHEMA_VERSION, type RusiqQuiz } from '../model/schema.ts';

function validQuiz(overrides: Partial<RusiqQuiz> = {}): RusiqQuiz {
  return {
    schemaVersion: RUSIQ_QUIZ_SCHEMA_VERSION,
    id: 'quiz-1',
    title: 'Тест',
    intro: '',
    themes: [],
    passwordHash: null,
    image: { fileName: 'bg.png', width: 100, height: 100 },
    levels: [{ id: 1, label: 'Начинающий' }, { id: 2, label: 'Опытный' }, { id: 3, label: 'Профессионал' }],
    questions: [{ id: 'q1', text: 'Вопрос?', answer: 'а', helpText: '', x: 10, y: 10, decoyPoints: [], price: 100, timeSeconds: 20, level: 1, theme: 'Тема' }],
    genericDecoyPoints: [],
    ...overrides,
  };
}

test('listQuizzes returns [] when window.rusiqAPI is absent', async () => {
  assert.deepEqual(await listQuizzes(), []);
});

test('loadQuiz returns null when window.rusiqAPI is absent', async () => {
  assert.equal(await loadQuiz('any'), null);
});

test('saveQuiz returns false when window.rusiqAPI is absent', async () => {
  assert.equal(await saveQuiz(validQuiz()), false);
});

test('listQuizzes returns the raw list from the API without schema validation (metadata only)', async () => {
  (globalThis as any).window = {
    rusiqAPI: {
      listQuizzes: async () => [{ id: 'a', title: 'A', hasPassword: false, updatedAt: '2026-01-01T00:00:00.000Z' }],
    },
  };
  const result = await listQuizzes();
  assert.deepEqual(result, [{ id: 'a', title: 'A', hasPassword: false, updatedAt: '2026-01-01T00:00:00.000Z' }]);
  delete (globalThis as any).window;
});

test('loadQuiz validates the loaded object against RusiqQuizSchema and returns null on failure', async () => {
  (globalThis as any).window = {
    rusiqAPI: { loadQuiz: async () => ({ id: 'broken' }) },
  };
  assert.equal(await loadQuiz('broken'), null);
  delete (globalThis as any).window;
});

test('loadQuiz returns the parsed quiz on success', async () => {
  const quiz = validQuiz();
  (globalThis as any).window = {
    rusiqAPI: { loadQuiz: async () => quiz },
  };
  const result = await loadQuiz('quiz-1');
  assert.deepEqual(result, quiz);
  delete (globalThis as any).window;
});

test('saveQuiz calls the API and returns true on {ok: true}', async () => {
  let received: unknown = null;
  (globalThis as any).window = {
    rusiqAPI: {
      saveQuiz: async (quiz: unknown) => {
        received = quiz;
        return { ok: true };
      },
    },
  };
  const quiz = validQuiz();
  assert.equal(await saveQuiz(quiz), true);
  assert.deepEqual(received, quiz);
  delete (globalThis as any).window;
});

test('deleteQuiz returns the ok flag from the API', async () => {
  (globalThis as any).window = {
    rusiqAPI: { deleteQuiz: async () => ({ ok: true }) },
  };
  assert.equal(await deleteQuiz('quiz-1'), true);
  delete (globalThis as any).window;
});

test('saveQuizBackground returns {ok: false} when window.rusiqAPI is absent', async () => {
  const result = await saveQuizBackground('quiz-1', new ArrayBuffer(0), 'image/png');
  assert.deepEqual(result, { ok: false });
});

test('saveQuizBackground forwards to the API and returns its result', async () => {
  (globalThis as any).window = {
    rusiqAPI: {
      saveQuizBackground: async () => ({ ok: true, fileName: 'quiz-1-background.png' }),
    },
  };
  const result = await saveQuizBackground('quiz-1', new ArrayBuffer(0), 'image/png');
  assert.deepEqual(result, { ok: true, fileName: 'quiz-1-background.png' });
  delete (globalThis as any).window;
});
```

- [ ] **Step 3: Убедиться, что тесты падают**

Run: `cd packages/player && node --experimental-strip-types --test src/rusiq/editor/quizStore.test.ts`
Expected: FAIL — файл `quizStore.ts` не существует.

- [ ] **Step 4: Реализовать**

```typescript
// packages/player/src/rusiq/editor/quizStore.ts
// Тонкая обёртка над window.rusiqAPI для каталога пользовательских
// викторин (Фаза 2a) - тот же принцип, что userDataStorage.ts у истории
// результатов (Фаза 1). Список (listQuizzes) НЕ валидируется схемой -
// это только метаданные для каталога (id/title/hasPassword/updatedAt),
// полная RusiqQuizSchema применяется только к результату loadQuiz/перед
// saveQuiz, где нужна ПОЛНАЯ структура викторины.

import { RusiqQuizSchema, type RusiqQuiz } from '../model/schema.ts';

export interface QuizListEntry {
  id: string;
  title: string;
  hasPassword: boolean;
  updatedAt: string;
}

declare global {
  interface Window {
    rusiqAPI?: {
      loadUserData: () => Promise<unknown>;
      saveUserData: (data: unknown) => Promise<{ ok: boolean }>;
      listQuizzes: () => Promise<QuizListEntry[]>;
      loadQuiz: (quizId: string) => Promise<unknown>;
      saveQuiz: (quiz: RusiqQuiz) => Promise<{ ok: boolean }>;
      deleteQuiz: (quizId: string) => Promise<{ ok: boolean }>;
      saveQuizBackground: (quizId: string, buffer: ArrayBuffer, mimeType: string) => Promise<{ ok: boolean; fileName?: string }>;
    };
  }
}

export async function listQuizzes(): Promise<QuizListEntry[]> {
  if (typeof window === 'undefined' || !window.rusiqAPI) return [];
  try {
    return await window.rusiqAPI.listQuizzes();
  } catch {
    return [];
  }
}

export async function loadQuiz(quizId: string): Promise<RusiqQuiz | null> {
  if (typeof window === 'undefined' || !window.rusiqAPI) return null;
  try {
    const raw = await window.rusiqAPI.loadQuiz(quizId);
    const parsed = RusiqQuizSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function saveQuiz(quiz: RusiqQuiz): Promise<boolean> {
  if (typeof window === 'undefined' || !window.rusiqAPI) return false;
  try {
    const result = await window.rusiqAPI.saveQuiz(quiz);
    return result.ok;
  } catch {
    return false;
  }
}

export async function deleteQuiz(quizId: string): Promise<boolean> {
  if (typeof window === 'undefined' || !window.rusiqAPI) return false;
  try {
    const result = await window.rusiqAPI.deleteQuiz(quizId);
    return result.ok;
  } catch {
    return false;
  }
}

export async function saveQuizBackground(
  quizId: string,
  buffer: ArrayBuffer,
  mimeType: string,
): Promise<{ ok: boolean; fileName?: string }> {
  if (typeof window === 'undefined' || !window.rusiqAPI) return { ok: false };
  try {
    return await window.rusiqAPI.saveQuizBackground(quizId, buffer, mimeType);
  } catch {
    return { ok: false };
  }
}
```

- [ ] **Step 5: Убедиться, что тесты проходят**

Run: `cd packages/player && node --experimental-strip-types --test src/rusiq/editor/quizStore.test.ts`
Expected: PASS, 10/10.

- [ ] **Step 6: Прогнать весь набор тестов player**

Run: `cd packages/player && npm test && npx tsc --noEmit`
Expected: PASS, без новых ошибок типов.

- [ ] **Step 7: Commit**

```bash
git add packages/player/electron/preload.js packages/player/src/rusiq/editor/quizStore.ts packages/player/src/rusiq/editor/quizStore.test.ts
git commit -m "feat(rusiq): quizStore.ts - рендерер-обёртка над IPC каталога викторин"
```

---

### Task 6: `RusiqRuntime.tsx` — активная викторина вместо константы модуля

**Files:**
- Modify: `packages/player/src/rusiq/RusiqRuntime.tsx`

**Interfaces:**
- Consumes: `loadQuiz` из `./editor/quizStore.ts` (Задача 5), `RusiqUserData.activeQuizId` (Задача 1).
- Produces: `RusiqRuntime` больше не экспортирует модульную константу `quiz` — активная викторина теперь в состоянии `activeQuiz: RusiqQuiz`. Используется Задачей 8 (кнопка «Играть эту» обновляет `activeQuizId` в тех же `userData`, которые уже грузит этот компонент).

- [ ] **Step 1: Реализовать (без отдельного теста — экраны не юнит-тестируются, проверка в Задаче 12 живой CDP-проверкой)**

Заменить в `packages/player/src/rusiq/RusiqRuntime.tsx`:

```typescript
import { RusiqQuizSchema, type RusiqQuestion, type RusiqUserData, RUSIQ_USERDATA_SCHEMA_VERSION } from './model/schema.ts';
import { assignQuestions, summarizeResults, type RusiqAnswerEvent } from './gameLogic.ts';
import { loadUserData, saveUserData } from './userDataStorage.ts';
import rusiqContentJson from './content/rusiqContent.json' with { type: 'json' };
```

на:

```typescript
import { RusiqQuizSchema, type RusiqQuestion, type RusiqQuiz, type RusiqUserData, RUSIQ_USERDATA_SCHEMA_VERSION } from './model/schema.ts';
import { assignQuestions, summarizeResults, type RusiqAnswerEvent } from './gameLogic.ts';
import { loadUserData, saveUserData } from './userDataStorage.ts';
import { loadQuiz } from './editor/quizStore.ts';
import rusiqContentJson from './content/rusiqContent.json' with { type: 'json' };
```

Заменить:

```typescript
type Phase = 'intro' | 'setup' | 'board' | 'results';

const quiz = RusiqQuizSchema.parse(rusiqContentJson);
const INITIAL_USER_DATA: RusiqUserData = { schemaVersion: RUSIQ_USERDATA_SCHEMA_VERSION, sessions: [], soundOn: true };
```

на:

```typescript
type Phase = 'loading' | 'intro' | 'setup' | 'board' | 'results';

// Встроенная методическая викторина "Обучение грамоте" - фолбэк, когда
// activeQuizId === null или пользовательская викторина не грузится
// (удалена/битый файл). Больше не модульная константа "quiz" - см. спеку
// Фазы 2a, разд. 1.1: реальная активная викторина определяется динамически.
const BUILTIN_QUIZ: RusiqQuiz = RusiqQuizSchema.parse(rusiqContentJson);

const INITIAL_USER_DATA: RusiqUserData = {
  schemaVersion: RUSIQ_USERDATA_SCHEMA_VERSION,
  sessions: [],
  soundOn: true,
  activeQuizId: null,
  teacherPinHash: null,
};
```

Заменить тело компонента (замена состояния и эффекта загрузки, добавление `activeQuiz`):

```typescript
const RusiqRuntime: React.FC<Props> = () => {
  const [phase, setPhase] = useState<Phase>('loading');
  const [activeQuiz, setActiveQuiz] = useState<RusiqQuiz>(BUILTIN_QUIZ);
  const [setup, setSetup] = useState<GameSetupResult | null>(null);
  const [questionsByPlayer, setQuestionsByPlayer] = useState<RusiqQuestion[][]>([]);
  const [finalAnswers, setFinalAnswers] = useState<RusiqAnswerEvent[]>([]);
  const [userData, setUserData] = useState<RusiqUserData>(INITIAL_USER_DATA);

  useEffect(() => {
    loadUserData().then(async (loaded) => {
      setUserData(loaded);
      if (loaded.activeQuizId !== null) {
        const custom = await loadQuiz(loaded.activeQuizId);
        setActiveQuiz(custom ?? BUILTIN_QUIZ);
      } else {
        setActiveQuiz(BUILTIN_QUIZ);
      }
      setPhase('intro');
    });
  }, []);
```

Обновить `handleSetupComplete`, `handleGameFinished` и JSX-рендер, заменяя все использования свободной переменной `quiz` на `activeQuiz`:

```typescript
  function handleSetupComplete(result: GameSetupResult) {
    const pool = activeQuiz.questions.filter((q) => q.level === result.level);
    const assigned = assignQuestions(pool, result.playerNames.length, result.questionsPerPlayer);
    setSetup(result);
    setQuestionsByPlayer(assigned);
    setPhase('board');
  }

  function handleGameFinished(answers: RusiqAnswerEvent[]) {
    setFinalAnswers(answers);
    setPhase('results');
    if (setup) {
      const summaries = summarizeResults(setup.playerNames, answers);
      const updated: RusiqUserData = {
        ...userData,
        sessions: [
          ...userData.sessions,
          {
            id: `session-${Date.now()}`,
            quizId: activeQuiz.id,
            playedAtIso: new Date().toISOString(),
            players: summaries,
          },
        ],
      };
      setUserData(updated);
      saveUserData(updated);
    }
  }
```

Заменить финальный блок рендера:

```typescript
  if (phase === 'intro') return <IntroScreen quiz={quiz} onPlay={() => setPhase('setup')} />;
  if (phase === 'setup') return <GameSetupScreen quiz={quiz} onComplete={handleSetupComplete} />;
  if (phase === 'board' && setup) {
    return (
      <GameBoardScreen
        imageUrl={ALPHABET_IMAGE_URL}
        imageWidth={quiz.image.width}
        imageHeight={quiz.image.height}
        playerNames={setup.playerNames}
        questionsByPlayer={questionsByPlayer}
        genericDecoyPoints={quiz.genericDecoyPoints}
        onFinished={handleGameFinished}
      />
    );
  }
```

на:

```typescript
  if (phase === 'loading') return null;
  if (phase === 'intro') return <IntroScreen quiz={activeQuiz} onPlay={() => setPhase('setup')} />;
  if (phase === 'setup') return <GameSetupScreen quiz={activeQuiz} onComplete={handleSetupComplete} />;
  if (phase === 'board' && setup) {
    return (
      <GameBoardScreen
        imageUrl={activeQuiz.id === BUILTIN_QUIZ.id ? ALPHABET_IMAGE_URL : `rusiqmedia:///${activeQuiz.image.fileName}`}
        imageWidth={activeQuiz.image.width}
        imageHeight={activeQuiz.image.height}
        playerNames={setup.playerNames}
        questionsByPlayer={questionsByPlayer}
        genericDecoyPoints={activeQuiz.genericDecoyPoints}
        onFinished={handleGameFinished}
      />
    );
  }
```

Экран `'loading'` — намеренно `null` (не отдельный компонент/текст): в штатном случае длится миллисекунды (локальный диск), а вводить ещё один визуальный экран ради этого — не то усложнение, которое здесь оправдано.

- [ ] **Step 2: `tsc --noEmit`**

Run: `cd packages/player && npx tsc --noEmit`
Expected: без ошибок. Обратить внимание: `RusiqQuizSchema` больше не используется напрямую в JSX (только внутри `BUILTIN_QUIZ = RusiqQuizSchema.parse(...)`) - импорт остаётся нужным, ESLint/tsc не должен жаловаться на неиспользуемый импорт.

- [ ] **Step 3: Прогнать весь набор тестов player**

Run: `cd packages/player && npm test`
Expected: PASS (эта задача не добавляет новых тестов - `RusiqRuntime.tsx` не тестируется юнит-тестами, проверка в Задаче 12).

- [ ] **Step 4: Commit**

```bash
git add packages/player/src/rusiq/RusiqRuntime.tsx
git commit -m "feat(rusiq): активная викторина по activeQuizId вместо константы модуля"
```

---

### Task 7: `TeacherGateScreen.tsx` — вход в режим учителя по PIN

**Files:**
- Create: `packages/player/src/rusiq/editor/TeacherGateScreen.tsx`
- Modify: `packages/player/src/rusiq/screens/IntroScreen.tsx`
- Modify: `packages/player/src/rusiq/RusiqRuntime.tsx`

**Interfaces:**
- Consumes: `hashSecret`/`verifySecret` из `./pinAuth.ts` (Задача 4), `RusiqUserData.teacherPinHash` (Задача 1), `saveUserData` (существует).
- Produces: `TeacherGateScreen` вызывает `onUnlocked()` при верном/только что заданном PIN — используется Задачей 8 (`RusiqRuntime` переходит в фазу `'catalog'`).

- [ ] **Step 1: Реализовать `TeacherGateScreen.tsx`**

```typescript
// packages/player/src/rusiq/editor/TeacherGateScreen.tsx
import React, { useState } from 'react';
import { hashSecret, verifySecret } from './pinAuth.ts';

interface Props {
  teacherPinHash: string | null;
  onUnlocked: (newPinHash?: string) => void;
  onCancel: () => void;
}

// Экран одновременно обслуживает два сценария: "PIN уже задан - введите
// его" и "PIN ещё не задан - задайте его сейчас" (спека Фазы 2a, разд. 1).
// Различаются только заголовком/поведением onSubmit, форма та же.
const TeacherGateScreen: React.FC<Props> = ({ teacherPinHash, onUnlocked, onCancel }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isFirstSetup = teacherPinHash === null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pin.trim().length === 0) return;
    setBusy(true);
    setError(null);
    if (isFirstSetup) {
      const newHash = await hashSecret(pin.trim());
      onUnlocked(newHash);
      return;
    }
    const ok = await verifySecret(pin.trim(), teacherPinHash);
    setBusy(false);
    if (ok) {
      onUnlocked();
    } else {
      setError('Неверный код');
      setPin('');
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: '80px auto', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h2>{isFirstSetup ? 'Задайте PIN режима учителя' : 'Режим учителя'}</h2>
      <form onSubmit={handleSubmit}>
        <input
          autoFocus
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          style={{ fontSize: 24, textAlign: 'center', width: '100%', padding: 8, letterSpacing: 4 }}
        />
        {error && <p style={{ color: '#c0392b' }}>{error}</p>}
        <div style={{ marginTop: 16 }}>
          <button type="button" onClick={onCancel} style={{ marginRight: 8 }}>
            Отмена
          </button>
          <button type="submit" disabled={busy || pin.trim().length === 0}>
            {isFirstSetup ? 'Задать' : 'Войти'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TeacherGateScreen;
```

- [ ] **Step 2: Добавить кнопку «Режим учителя» в `IntroScreen.tsx`**

Заменить пропсы и рендер в `packages/player/src/rusiq/screens/IntroScreen.tsx`:

```typescript
interface Props {
  quiz: RusiqQuiz;
  onPlay: () => void;
}
```

на:

```typescript
interface Props {
  quiz: RusiqQuiz;
  onPlay: () => void;
  onTeacherMode: () => void;
}
```

Заменить:

```tsx
const IntroScreen: React.FC<Props> = ({ quiz, onPlay }) => (
  <div style={{ maxWidth: 640, margin: '60px auto', textAlign: 'center', fontFamily: 'sans-serif' }}>
    <h1>{quiz.title}</h1>
```

на:

```tsx
const IntroScreen: React.FC<Props> = ({ quiz, onPlay, onTeacherMode }) => (
  <div style={{ maxWidth: 640, margin: '60px auto', textAlign: 'center', fontFamily: 'sans-serif', position: 'relative' }}>
    <button
      onClick={onTeacherMode}
      style={{ position: 'absolute', top: 0, right: 0, fontSize: 12, padding: '4px 10px', opacity: 0.6 }}
    >
      Режим учителя
    </button>
    <h1>{quiz.title}</h1>
```

- [ ] **Step 3: Подключить в `RusiqRuntime.tsx`**

Добавить импорт:

```typescript
import TeacherGateScreen from './editor/TeacherGateScreen.tsx';
```

Расширить тип фазы:

```typescript
type Phase = 'loading' | 'intro' | 'setup' | 'board' | 'results' | 'teacherGate' | 'catalog';
```

(`'catalog'` добавляется здесь же, реализуется Задачей 8 — тип фазы удобнее расширить один раз).

Добавить обработчик после `handleRestart`:

```typescript
  async function handleTeacherUnlocked(newPinHash?: string) {
    if (newPinHash) {
      const updated: RusiqUserData = { ...userData, teacherPinHash: newPinHash };
      setUserData(updated);
      saveUserData(updated);
    }
    setPhase('catalog');
  }
```

Обновить рендер интро-экрана:

```typescript
  if (phase === 'intro') {
    return <IntroScreen quiz={activeQuiz} onPlay={() => setPhase('setup')} onTeacherMode={() => setPhase('teacherGate')} />;
  }
```

Добавить рендер фазы `teacherGate` (после блока `'intro'`):

```typescript
  if (phase === 'teacherGate') {
    return (
      <TeacherGateScreen
        teacherPinHash={userData.teacherPinHash}
        onUnlocked={handleTeacherUnlocked}
        onCancel={() => setPhase('intro')}
      />
    );
  }
```

Фаза `'catalog'` пока не имеет собственного рендера — временно вернуть `null` в конце цепочки `if`, чтобы `tsc`/сборка проходили; реальный экран добавит Задача 8:

```typescript
  if (phase === 'catalog') return null; // экран добавит Задача 8
```

- [ ] **Step 4: `tsc --noEmit`**

Run: `cd packages/player && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 5: Прогнать весь набор тестов player**

Run: `cd packages/player && npm test`
Expected: PASS (без новых юнит-тестов для этой задачи — экраны не тестируются, живая проверка PIN-потока входит в общую живую проверку Задачи 12).

- [ ] **Step 6: Commit**

```bash
git add packages/player/src/rusiq/editor/TeacherGateScreen.tsx packages/player/src/rusiq/screens/IntroScreen.tsx packages/player/src/rusiq/RusiqRuntime.tsx
git commit -m "feat(rusiq): TeacherGateScreen - вход в режим учителя по PIN"
```

---

### Task 8: `QuizCatalogScreen.tsx` + `NewQuizModal.tsx`

**Files:**
- Create: `packages/player/src/rusiq/editor/NewQuizModal.tsx`
- Create: `packages/player/src/rusiq/editor/QuizCatalogScreen.tsx`
- Modify: `packages/player/src/rusiq/RusiqRuntime.tsx`

**Interfaces:**
- Consumes: `listQuizzes`/`loadQuiz`/`saveQuiz`/`deleteQuiz`/`saveQuizBackground`/`QuizListEntry` из `./quizStore.ts` (Задача 5), `verifySecret`/`hashSecret` из `./pinAuth.ts` (Задача 4).
- Produces: `NewQuizResult` (тип), `QuizCatalogScreen` вызывает `onEditQuiz(quiz, pendingBackground)` — используется Задачей 11 (`EditorScreen`, ещё не существует на этом шаге — `RusiqRuntime` временно откроет `null` в фазе `'editor'`, реальный рендер добавит Задача 11).

- [ ] **Step 1: Реализовать `NewQuizModal.tsx`**

```typescript
// packages/player/src/rusiq/editor/NewQuizModal.tsx
// Модальный шаг "название+фон" ПЕРЕД открытием EditorScreen - спека Фазы
// 2a, разд. 2.1.1: RusiqQuizSchema.image обязателен (не nullable), поэтому
// не может существовать промежуточного состояния "викторина без фона" как
// валидного RusiqQuiz. Реальные width/height берутся из самого файла (не
// вписываются вручную) - та же дисциплина, что закрыла критичную находку
// финального ревью Фазы 1 (несоответствие заявленных и реальных размеров).

import React, { useState } from 'react';

export interface NewQuizResult {
  title: string;
  imageBuffer: ArrayBuffer;
  imageMimeType: string;
  imageWidth: number;
  imageHeight: number;
}

interface Props {
  onCreate: (result: NewQuizResult) => void;
  onCancel: () => void;
}

const ACCEPTED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

function readImageDimensions(objectUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Не удалось прочитать изображение'));
    img.src = objectUrl;
  });
}

const NewQuizModal: React.FC<Props> = ({ onCreate, onCancel }) => {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = title.trim().length > 0 && file !== null && !busy;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !ACCEPTED_MIME_TYPES.includes(file.type)) {
      setError('Выберите файл изображения (PNG, JPEG, GIF или WEBP)');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const objectUrl = URL.createObjectURL(file);
      const { width, height } = await readImageDimensions(objectUrl);
      URL.revokeObjectURL(objectUrl);
      const imageBuffer = await file.arrayBuffer();
      onCreate({ title: title.trim(), imageBuffer, imageMimeType: file.type, imageWidth: width, imageHeight: height });
    } catch {
      setError('Не удалось прочитать изображение');
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onCancel}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        style={{ background: '#fff', padding: 24, borderRadius: 8, width: 360, fontFamily: 'sans-serif' }}
      >
        <h3>Новая викторина</h3>
        <label style={{ display: 'block', marginBottom: 12 }}>
          Название
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ display: 'block', width: '100%', padding: 8, marginTop: 4 }}
          />
        </label>
        <label style={{ display: 'block', marginBottom: 12 }}>
          Фоновое изображение
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        {error && <p style={{ color: '#c0392b' }}>{error}</p>}
        <div style={{ textAlign: 'right', marginTop: 16 }}>
          <button type="button" onClick={onCancel} style={{ marginRight: 8 }}>
            Отмена
          </button>
          <button type="submit" disabled={!canSubmit}>
            Создать
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewQuizModal;
```

- [ ] **Step 2: Реализовать `QuizCatalogScreen.tsx`**

```typescript
// packages/player/src/rusiq/editor/QuizCatalogScreen.tsx
import React, { useEffect, useState } from 'react';
import { listQuizzes, loadQuiz, saveQuiz, deleteQuiz, saveQuizBackground, type QuizListEntry } from './quizStore.ts';
import { verifySecret } from './pinAuth.ts';
import NewQuizModal, { type NewQuizResult } from './NewQuizModal.tsx';
import { RUSIQ_QUIZ_SCHEMA_VERSION, type RusiqQuiz } from '../model/schema.ts';

interface Props {
  builtinQuizTitle: string;
  activeQuizId: string | null;
  onSetActiveQuiz: (quizId: string | null) => void;
  onEditQuiz: (quiz: RusiqQuiz, pendingBackground: { buffer: ArrayBuffer; mimeType: string } | null) => void;
  onExit: () => void;
}

const DEFAULT_LEVELS = [
  { id: 1 as const, label: 'Начинающий' },
  { id: 2 as const, label: 'Опытный' },
  { id: 3 as const, label: 'Профессионал' },
];

async function buildBlankQuiz(result: NewQuizResult): Promise<{ quiz: RusiqQuiz; pendingBackground: { buffer: ArrayBuffer; mimeType: string } } > {
  const extByMime: Record<string, string> = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp' };
  const id = crypto.randomUUID();
  const fileName = `${id}-background${extByMime[result.imageMimeType] ?? '.png'}`;
  const quiz: RusiqQuiz = {
    schemaVersion: RUSIQ_QUIZ_SCHEMA_VERSION,
    id,
    title: result.title,
    intro: '',
    themes: [],
    passwordHash: null,
    image: { fileName, width: result.imageWidth, height: result.imageHeight },
    levels: DEFAULT_LEVELS,
    questions: [],
    genericDecoyPoints: [],
  };
  return { quiz, pendingBackground: { buffer: result.imageBuffer, mimeType: result.imageMimeType } };
}

const QuizCatalogScreen: React.FC<Props> = ({ builtinQuizTitle, activeQuizId, onSetActiveQuiz, onEditQuiz, onExit }) => {
  const [entries, setEntries] = useState<QuizListEntry[]>([]);
  const [showNewQuizModal, setShowNewQuizModal] = useState(false);
  const [passwordPromptFor, setPasswordPromptFor] = useState<{ id: string; passwordHash: string } | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function refresh() {
    setEntries(await listQuizzes());
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleEdit(entry: QuizListEntry) {
    const quiz = await loadQuiz(entry.id);
    if (!quiz) {
      alert('Не удалось открыть викторину — файл повреждён или удалён.');
      await refresh();
      return;
    }
    if (quiz.passwordHash) {
      setPasswordPromptFor({ id: entry.id, passwordHash: quiz.passwordHash });
      setPasswordInput('');
      setPasswordError(null);
      return;
    }
    onEditQuiz(quiz, null);
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordPromptFor) return;
    const ok = await verifySecret(passwordInput, passwordPromptFor.passwordHash);
    if (!ok) {
      setPasswordError('Неверный пароль');
      return;
    }
    const quiz = await loadQuiz(passwordPromptFor.id);
    setPasswordPromptFor(null);
    if (quiz) onEditQuiz(quiz, null);
  }

  async function handleDuplicateBuiltin() {
    // Дублирование встроенной "Обучение грамоте" требует её полного объекта
    // (все 608 вопросов) - но RusiqRuntime хранит его как модульную
    // константу BUILTIN_QUIZ, недоступную отсюда напрямую. Проще и надёжнее
    // передать колбэк, который делает дублирование средствами родителя -
    // см. Задачу 11, где RusiqRuntime прокидывает готовую функцию через
    // проп onDuplicateBuiltin вместо прямого доступа к константе.
  }

  async function handleDuplicate(entry: QuizListEntry) {
    const quiz = await loadQuiz(entry.id);
    if (!quiz) {
      await refresh();
      return;
    }
    const newId = crypto.randomUUID();
    const duplicated: RusiqQuiz = { ...quiz, id: newId, title: `${quiz.title} (копия)`, passwordHash: null };
    await saveQuiz(duplicated);
    await refresh();
  }

  async function handleDelete(entry: QuizListEntry) {
    if (!confirm(`Удалить викторину «${entry.title}»? Это необратимо.`)) return;
    await deleteQuiz(entry.id);
    if (activeQuizId === entry.id) onSetActiveQuiz(null);
    await refresh();
  }

  async function handleCreate(result: NewQuizResult) {
    setShowNewQuizModal(false);
    const { quiz, pendingBackground } = await buildBlankQuiz(result);
    onEditQuiz(quiz, pendingBackground);
  }

  return (
    <div style={{ maxWidth: 640, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h2>Каталог викторин</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        <li style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #ddd' }}>
          <span style={{ flex: 1 }}>
            {activeQuizId === null ? '✓ ' : ''}
            {builtinQuizTitle} <em style={{ opacity: 0.6 }}>(встроенная)</em>
          </span>
          <button onClick={() => onSetActiveQuiz(null)}>Играть эту</button>
          <button onClick={() => alert('Дублирование встроенной викторины доступно из этого экрана в полной сборке — см. Задачу 11.')}>
            Дублировать
          </button>
        </li>
        {entries.map((entry) => (
          <li key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #ddd' }}>
            <span style={{ flex: 1 }}>
              {activeQuizId === entry.id ? '✓ ' : ''}
              {entry.title} {entry.hasPassword ? '🔒' : ''}
            </span>
            <button onClick={() => onSetActiveQuiz(entry.id)}>Играть эту</button>
            <button onClick={() => handleEdit(entry)}>Редактировать</button>
            <button onClick={() => handleDuplicate(entry)}>Дублировать</button>
            <button onClick={() => handleDelete(entry)}>Удалить</button>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 16 }}>
        <button onClick={() => setShowNewQuizModal(true)}>Создать новую</button>
        <button onClick={onExit} style={{ marginLeft: 8 }}>
          Выйти
        </button>
      </div>
      {showNewQuizModal && <NewQuizModal onCreate={handleCreate} onCancel={() => setShowNewQuizModal(false)} />}
      {passwordPromptFor && (
        <div
          onClick={() => setPasswordPromptFor(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handlePasswordSubmit}
            style={{ background: '#fff', padding: 24, borderRadius: 8, fontFamily: 'sans-serif' }}
          >
            <h3>Пароль викторины</h3>
            <input
              autoFocus
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              style={{ display: 'block', width: '100%', padding: 8 }}
            />
            {passwordError && <p style={{ color: '#c0392b' }}>{passwordError}</p>}
            <div style={{ textAlign: 'right', marginTop: 12 }}>
              <button type="button" onClick={() => setPasswordPromptFor(null)} style={{ marginRight: 8 }}>
                Отмена
              </button>
              <button type="submit">Открыть</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default QuizCatalogScreen;
```

**Примечание для исполнителя**: `handleDuplicateBuiltin` и связанная с ней кнопка «Дублировать» у встроенной викторины — заглушка-предупреждение в ЭТОЙ задаче специально (нужен доступ к полному объекту `BUILTIN_QUIZ`, которого у этого компонента нет). Задача 11 заменит проп `builtinQuizTitle: string` на `onDuplicateBuiltin: () => Promise<void>` и уберёт `alert(...)`, подключив реальное дублирование. Это НЕ нарушение правила «No Placeholders» плана — это точка стыковки между задачами, явно описанная и запланированная, а не невыполненный шаг.

- [ ] **Step 3: Подключить в `RusiqRuntime.tsx`**

Добавить импорт:

```typescript
import QuizCatalogScreen from './editor/QuizCatalogScreen.tsx';
```

Добавить состояние (рядом с остальными `useState`):

```typescript
  const [editingQuiz, setEditingQuiz] = useState<{ quiz: RusiqQuiz; pendingBackground: { buffer: ArrayBuffer; mimeType: string } | null } | null>(null);
```

Заменить временную заглушку `if (phase === 'catalog') return null;` на:

```typescript
  if (phase === 'catalog') {
    return (
      <QuizCatalogScreen
        builtinQuizTitle={BUILTIN_QUIZ.title}
        activeQuizId={userData.activeQuizId}
        onSetActiveQuiz={(quizId) => {
          const updated: RusiqUserData = { ...userData, activeQuizId: quizId };
          setUserData(updated);
          saveUserData(updated);
        }}
        onEditQuiz={(quiz, pendingBackground) => {
          setEditingQuiz({ quiz, pendingBackground });
          setPhase('editor');
        }}
        onExit={() => setPhase('intro')}
      />
    );
  }
  if (phase === 'editor') return null; // экран добавит Задача 11
```

Расширить тип фазы:

```typescript
type Phase = 'loading' | 'intro' | 'setup' | 'board' | 'results' | 'teacherGate' | 'catalog' | 'editor';
```

- [ ] **Step 4: `tsc --noEmit`**

Run: `cd packages/player && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 5: Прогнать весь набор тестов player**

Run: `cd packages/player && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/player/src/rusiq/editor/NewQuizModal.tsx packages/player/src/rusiq/editor/QuizCatalogScreen.tsx packages/player/src/rusiq/RusiqRuntime.tsx
git commit -m "feat(rusiq): QuizCatalogScreen + NewQuizModal - каталог викторин"
```

---

### Task 9: `QuizCanvas.tsx` — Konva-редактор точек

**Files:**
- Create: `packages/player/src/rusiq/editor/useHtmlImage.ts`
- Create: `packages/player/src/rusiq/editor/QuizCanvas.tsx`

**Interfaces:**
- Consumes: `RusiqQuestion`, `RusiqPoint` из `../model/schema.ts`.
- Produces: `QuizCanvasAddMode` (тип), `QuizCanvas` React-компонент — используется Задачей 11 (`EditorScreen.tsx`).

- [ ] **Step 1: Создать `useHtmlImage.ts` (дублирует `packages/player/src/natcom/useHtmlImage.ts` — виджеты этого кодбейза не импортируют код друг у друга через границу своей папки, каждый держит свою копию мелких утилит)**

```typescript
// packages/player/src/rusiq/editor/useHtmlImage.ts
// Загрузка HTMLImageElement для Konva <Image> - react-konva не берёт URL
// напрямую, ему нужен уже загруженный элемент. Та же утилита, что
// packages/player/src/natcom/useHtmlImage.ts - виджеты не импортируют код
// друг у друга через границу своей папки, каждый держит свою копию.

import { useEffect, useState } from 'react';

export function useHtmlImage(src: string | null | undefined): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }
    const img = new window.Image();
    img.onload = () => setImage(img);
    img.onerror = () => setImage(null);
    img.src = src;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return image;
}
```

- [ ] **Step 2: Реализовать `QuizCanvas.tsx`**

```typescript
// packages/player/src/rusiq/editor/QuizCanvas.tsx
// Прямой порт Konva-паттерна packages/player/src/natcom/editor/Workspace.tsx
// (Тип5, Фаза 5), упрощённый: объекты РусIQ - точки фиксированного
// размера (как в GameBoardScreen.tsx), только перемещаемые, без
// вращения/масштабирования/отражения - в игре точки всегда одного
// размера и формы, незачем и в редакторе (спека Фазы 2a, разд. 4).
//
// В отличие от GameBoardScreen.tsx точки РАЗЛИЧАЮТСЯ цветом по типу -
// это ИНСТРУМЕНТ АВТОРА, не игровой экран: находка 6 финального ревью
// Фазы 1 (нельзя различать точки в игре) сюда не относится - учителю
// НУЖНО видеть, что он редактирует.

import React, { useRef } from 'react';
import { Stage, Layer, Image as KonvaImage, Circle, Rect } from 'react-konva';
import type Konva from 'konva';
import { useHtmlImage } from './useHtmlImage.ts';
import type { RusiqPoint, RusiqQuestion } from '../model/schema.ts';

export type QuizCanvasAddMode = 'none' | 'question' | 'decoy-of-selected' | 'generic-decoy';

const CANVAS_WIDTH = 900;
const POINT_RADIUS = 10;
const COLOR_CORRECT = '#2e7d32';
const COLOR_CORRECT_SELECTED = '#1b5e20';
const COLOR_DECOY_OF_QUESTION = '#e65100';
const COLOR_GENERIC_DECOY = '#616161';

interface Props {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  questions: RusiqQuestion[];
  genericDecoyPoints: RusiqPoint[];
  selectedQuestionId: string | null;
  addMode: QuizCanvasAddMode;
  onSelectQuestion: (id: string | null) => void;
  onAddQuestionPoint: (point: RusiqPoint) => void;
  onAddDecoyToSelected: (point: RusiqPoint) => void;
  onAddGenericDecoy: (point: RusiqPoint) => void;
  onMoveQuestionPoint: (id: string, point: RusiqPoint) => void;
  onMoveDecoyOfQuestion: (questionId: string, decoyIndex: number, point: RusiqPoint) => void;
  onMoveGenericDecoy: (index: number, point: RusiqPoint) => void;
  onSelectDecoyOfQuestion: (questionId: string, decoyIndex: number) => void;
  onSelectGenericDecoy: (index: number) => void;
}

const QuizCanvas: React.FC<Props> = ({
  imageUrl,
  imageWidth,
  imageHeight,
  questions,
  genericDecoyPoints,
  selectedQuestionId,
  addMode,
  onSelectQuestion,
  onAddQuestionPoint,
  onAddDecoyToSelected,
  onAddGenericDecoy,
  onMoveQuestionPoint,
  onMoveDecoyOfQuestion,
  onMoveGenericDecoy,
  onSelectDecoyOfQuestion,
  onSelectGenericDecoy,
}) => {
  const backgroundImage = useHtmlImage(imageUrl);
  const stageRef = useRef<Konva.Stage | null>(null);

  const scale = CANVAS_WIDTH / imageWidth;
  const canvasHeight = imageHeight * scale;

  function toImageSpace(stageX: number, stageY: number): RusiqPoint {
    return { x: Math.round(stageX / scale), y: Math.round(stageY / scale) };
  }

  function toStageSpace(point: RusiqPoint): { x: number; y: number } {
    return { x: point.x * scale, y: point.y * scale };
  }

  function handleStageClick(e: Konva.KonvaEventObject<MouseEvent>) {
    if (e.target !== e.target.getStage()) return; // клик по точке обрабатывается её собственным onClick
    const stage = stageRef.current;
    const pointerPosition = stage?.getPointerPosition();
    if (!pointerPosition) return;
    const point = toImageSpace(pointerPosition.x, pointerPosition.y);
    if (addMode === 'question') {
      onAddQuestionPoint(point);
    } else if (addMode === 'decoy-of-selected' && selectedQuestionId) {
      onAddDecoyToSelected(point);
    } else if (addMode === 'generic-decoy') {
      onAddGenericDecoy(point);
    } else {
      onSelectQuestion(null);
    }
  }

  return (
    <Stage ref={stageRef} width={CANVAS_WIDTH} height={canvasHeight} onClick={handleStageClick}>
      <Layer>
        {backgroundImage && <KonvaImage image={backgroundImage} x={0} y={0} width={CANVAS_WIDTH} height={canvasHeight} listening={false} />}

        {questions.map((question) => {
          const isSelected = question.id === selectedQuestionId;
          const stagePos = toStageSpace(question);
          return (
            <React.Fragment key={question.id}>
              <Circle
                x={stagePos.x}
                y={stagePos.y}
                radius={POINT_RADIUS}
                fill={isSelected ? COLOR_CORRECT_SELECTED : COLOR_CORRECT}
                stroke={isSelected ? '#fff' : undefined}
                strokeWidth={isSelected ? 2 : 0}
                draggable
                onClick={() => onSelectQuestion(question.id)}
                onTap={() => onSelectQuestion(question.id)}
                onDragEnd={(e) => onMoveQuestionPoint(question.id, toImageSpace(e.target.x(), e.target.y()))}
              />
              {question.decoyPoints.map((decoy, decoyIndex) => {
                const decoyPos = toStageSpace(decoy);
                return (
                  <Circle
                    key={`${question.id}-decoy-${decoyIndex}`}
                    x={decoyPos.x}
                    y={decoyPos.y}
                    radius={POINT_RADIUS}
                    fill={COLOR_DECOY_OF_QUESTION}
                    draggable
                    onClick={() => onSelectDecoyOfQuestion(question.id, decoyIndex)}
                    onTap={() => onSelectDecoyOfQuestion(question.id, decoyIndex)}
                    onDragEnd={(e) => onMoveDecoyOfQuestion(question.id, decoyIndex, toImageSpace(e.target.x(), e.target.y()))}
                  />
                );
              })}
            </React.Fragment>
          );
        })}

        {genericDecoyPoints.map((point, index) => {
          const stagePos = toStageSpace(point);
          return (
            <Circle
              key={`generic-${index}`}
              x={stagePos.x}
              y={stagePos.y}
              radius={POINT_RADIUS}
              fill={COLOR_GENERIC_DECOY}
              draggable
              onClick={() => onSelectGenericDecoy(index)}
              onTap={() => onSelectGenericDecoy(index)}
              onDragEnd={(e) => onMoveGenericDecoy(index, toImageSpace(e.target.x(), e.target.y()))}
            />
          );
        })}

        {/* Невидимый прямоугольник-перехватчик по всей площади канваса -
            без него, пока фон ещё не загружен, клик по пустому месту не
            находит цели под курсором (тот же паттерн, что Workspace.tsx
            Тип5 использует для отдельных объектов). */}
        {!backgroundImage && <Rect x={0} y={0} width={CANVAS_WIDTH} height={canvasHeight} fill="#eee" listening />}
      </Layer>
    </Stage>
  );
};

export default QuizCanvas;
```

- [ ] **Step 3: `tsc --noEmit`**

Run: `cd packages/player && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 4: Commit**

```bash
git add packages/player/src/rusiq/editor/useHtmlImage.ts packages/player/src/rusiq/editor/QuizCanvas.tsx
git commit -m "feat(rusiq): QuizCanvas - Konva-редактор точек викторины"
```

---

### Task 10: `PointEditForm.tsx` — форма вопроса

**Files:**
- Create: `packages/player/src/rusiq/editor/PointEditForm.tsx`

**Interfaces:**
- Consumes: `RusiqQuestion`, `RusiqLevelId` из `../model/schema.ts`.
- Produces: `PointEditForm` React-компонент — используется Задачей 11 (`EditorScreen.tsx`).

- [ ] **Step 1: Реализовать**

```typescript
// packages/player/src/rusiq/editor/PointEditForm.tsx
import React from 'react';
import type { RusiqLevelId, RusiqQuestion } from '../model/schema.ts';

interface Props {
  question: RusiqQuestion;
  existingThemes: string[];
  onChange: (updated: RusiqQuestion) => void;
  onDelete: () => void;
  onClose: () => void;
}

const PointEditForm: React.FC<Props> = ({ question, existingThemes, onChange, onDelete, onClose }) => {
  function set<K extends keyof RusiqQuestion>(key: K, value: RusiqQuestion[K]) {
    onChange({ ...question, [key]: value });
  }

  return (
    <div style={{ border: '1px solid #ccc', padding: 16, borderRadius: 8, background: '#fafafa', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h4 style={{ margin: 0 }}>Вопрос</h4>
        <button onClick={onClose}>×</button>
      </div>
      <label style={{ display: 'block', marginTop: 8 }}>
        Текст вопроса
        <textarea
          value={question.text}
          onChange={(e) => set('text', e.target.value)}
          style={{ display: 'block', width: '100%', padding: 6 }}
          rows={2}
        />
      </label>
      <label style={{ display: 'block', marginTop: 8 }}>
        Ответ
        <input value={question.answer} onChange={(e) => set('answer', e.target.value)} style={{ display: 'block', width: '100%', padding: 6 }} />
      </label>
      <label style={{ display: 'block', marginTop: 8 }}>
        Тема
        <input
          value={question.theme}
          onChange={(e) => set('theme', e.target.value)}
          list="rusiq-editor-themes"
          style={{ display: 'block', width: '100%', padding: 6 }}
        />
        <datalist id="rusiq-editor-themes">
          {existingThemes.map((theme) => (
            <option key={theme} value={theme} />
          ))}
        </datalist>
      </label>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <label style={{ flex: 1 }}>
          Уровень
          <select value={question.level} onChange={(e) => set('level', Number(e.target.value) as RusiqLevelId)} style={{ display: 'block', width: '100%', padding: 6 }}>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </label>
        <label style={{ flex: 1 }}>
          Вес (баллы)
          <input
            type="number"
            min={1}
            value={question.price}
            onChange={(e) => set('price', Math.max(1, Number(e.target.value)))}
            style={{ display: 'block', width: '100%', padding: 6 }}
          />
        </label>
        <label style={{ flex: 1 }}>
          Время (сек)
          <input
            type="number"
            min={1}
            value={question.timeSeconds}
            onChange={(e) => set('timeSeconds', Math.max(1, Number(e.target.value)))}
            style={{ display: 'block', width: '100%', padding: 6 }}
          />
        </label>
      </div>
      <label style={{ display: 'block', marginTop: 8 }}>
        Подсказка (необязательно)
        <textarea
          value={question.helpText}
          onChange={(e) => set('helpText', e.target.value)}
          style={{ display: 'block', width: '100%', padding: 6 }}
          rows={2}
        />
      </label>
      <button onClick={onDelete} style={{ marginTop: 12, color: '#c0392b' }}>
        Удалить этот вопрос
      </button>
    </div>
  );
};

export default PointEditForm;
```

- [ ] **Step 2: `tsc --noEmit`**

Run: `cd packages/player && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add packages/player/src/rusiq/editor/PointEditForm.tsx
git commit -m "feat(rusiq): PointEditForm - форма редактирования вопроса"
```

---

### Task 11: `EditorScreen.tsx` — сборка редактора воедино

**Files:**
- Create: `packages/player/src/rusiq/editor/EditorScreen.tsx`
- Modify: `packages/player/src/rusiq/editor/QuizCatalogScreen.tsx`
- Modify: `packages/player/src/rusiq/RusiqRuntime.tsx`

**Interfaces:**
- Consumes: `QuizCanvas`+`QuizCanvasAddMode` (Задача 9), `PointEditForm` (Задача 10), `initHistory`/`pushHistory`/`undo`/`redo`/`canUndo`/`canRedo` из `../../chrono/history.ts` (существует), `saveQuiz`/`saveQuizBackground` из `./quizStore.ts` (Задача 5), `hashSecret`/`verifySecret` из `./pinAuth.ts` (Задача 4).
- Produces: `EditorScreen` React-компонент, финальная замена заглушки `if (phase === 'editor') return null;` в `RusiqRuntime.tsx`.

- [ ] **Step 1: Реализовать `EditorScreen.tsx`**

```typescript
// packages/player/src/rusiq/editor/EditorScreen.tsx
// Собирает воедино канвас точек, форму вопроса, undo/redo (переиспользует
// packages/player/src/chrono/history.ts напрямую - генерик, не привязан
// к конкретному типу), сохранение (с отложенной записью фонового
// изображения для только что созданных викторин) и пароль викторины.

import React, { useState } from 'react';
import { initHistory, pushHistory, undo, redo, canUndo, canRedo, type History } from '../../chrono/history.ts';
import QuizCanvas, { type QuizCanvasAddMode } from './QuizCanvas.tsx';
import PointEditForm from './PointEditForm.tsx';
import { hashSecret } from './pinAuth.ts';
import { saveQuiz, saveQuizBackground } from './quizStore.ts';
import type { RusiqPoint, RusiqQuestion, RusiqQuiz } from '../model/schema.ts';

interface Props {
  initialQuiz: RusiqQuiz;
  pendingBackground: { buffer: ArrayBuffer; mimeType: string } | null;
  onExit: () => void;
}

type Selection = { kind: 'question'; questionId: string } | { kind: 'decoy-of-question'; questionId: string; decoyIndex: number } | { kind: 'generic-decoy'; index: number } | null;

function makeBlankQuestion(point: RusiqPoint): RusiqQuestion {
  return {
    id: crypto.randomUUID(),
    text: '',
    answer: '',
    helpText: '',
    x: point.x,
    y: point.y,
    decoyPoints: [],
    price: 100,
    timeSeconds: 30,
    level: 1,
    theme: '',
  };
}

const EditorScreen: React.FC<Props> = ({ initialQuiz, pendingBackground, onExit }) => {
  const [history, setHistory] = useState<History<RusiqQuiz>>(() => initHistory(initialQuiz));
  const [lastSavedQuiz, setLastSavedQuiz] = useState<RusiqQuiz | null>(pendingBackground ? null : initialQuiz);
  const [pendingBg, setPendingBg] = useState(pendingBackground);
  const [selection, setSelection] = useState<Selection>(null);
  const [addMode, setAddMode] = useState<QuizCanvasAddMode>('none');
  const [passwordDraft, setPasswordDraft] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const quiz = history.present;
  const hasUnsavedChanges = lastSavedQuiz === null || JSON.stringify(lastSavedQuiz) !== JSON.stringify(quiz);
  const backgroundUrl = pendingBg ? URL.createObjectURL(new Blob([pendingBg.buffer], { type: pendingBg.mimeType })) : `rusiqmedia:///${quiz.image.fileName}`;

  function update(next: RusiqQuiz) {
    setHistory((h) => pushHistory(h, next));
  }

  function handleAddQuestionPoint(point: RusiqPoint) {
    const question = makeBlankQuestion(point);
    update({ ...quiz, questions: [...quiz.questions, question] });
    setSelection({ kind: 'question', questionId: question.id });
    setAddMode('none');
  }

  function handleAddDecoyToSelected(point: RusiqPoint) {
    if (selection?.kind !== 'question') return;
    update({
      ...quiz,
      questions: quiz.questions.map((q) => (q.id === selection.questionId ? { ...q, decoyPoints: [...q.decoyPoints, point] } : q)),
    });
  }

  function handleAddGenericDecoy(point: RusiqPoint) {
    update({ ...quiz, genericDecoyPoints: [...quiz.genericDecoyPoints, point] });
  }

  function handleMoveQuestionPoint(id: string, point: RusiqPoint) {
    update({ ...quiz, questions: quiz.questions.map((q) => (q.id === id ? { ...q, x: point.x, y: point.y } : q)) });
  }

  function handleMoveDecoyOfQuestion(questionId: string, decoyIndex: number, point: RusiqPoint) {
    update({
      ...quiz,
      questions: quiz.questions.map((q) =>
        q.id === questionId ? { ...q, decoyPoints: q.decoyPoints.map((d, i) => (i === decoyIndex ? point : d)) } : q,
      ),
    });
  }

  function handleMoveGenericDecoy(index: number, point: RusiqPoint) {
    update({ ...quiz, genericDecoyPoints: quiz.genericDecoyPoints.map((d, i) => (i === index ? point : d)) });
  }

  function handleQuestionChange(updated: RusiqQuestion) {
    update({ ...quiz, questions: quiz.questions.map((q) => (q.id === updated.id ? updated : q)) });
  }

  function handleDeleteSelectedQuestion() {
    if (selection?.kind !== 'question') return;
    update({ ...quiz, questions: quiz.questions.filter((q) => q.id !== selection.questionId) });
    setSelection(null);
  }

  function handleDeleteDecoyOfQuestion(questionId: string, decoyIndex: number) {
    update({
      ...quiz,
      questions: quiz.questions.map((q) => (q.id === questionId ? { ...q, decoyPoints: q.decoyPoints.filter((_, i) => i !== decoyIndex) } : q)),
    });
    setSelection(null);
  }

  function handleDeleteGenericDecoy(index: number) {
    update({ ...quiz, genericDecoyPoints: quiz.genericDecoyPoints.filter((_, i) => i !== index) });
    setSelection(null);
  }

  async function handleSetPassword() {
    if (passwordDraft.trim().length === 0) return;
    const hash = await hashSecret(passwordDraft.trim());
    update({ ...quiz, passwordHash: hash });
    setPasswordDraft('');
  }

  function handleClearPassword() {
    update({ ...quiz, passwordHash: null });
  }

  async function handleSave() {
    if (quiz.title.trim().length === 0) {
      setSaveError('Укажите название викторины');
      return;
    }
    // RusiqQuizSchema.questions требует .min(1) (packages/player/src/rusiq/
    // model/schema.ts) - без этой проверки только что созданная викторина
    // (0 вопросов) успешно пишется на диск (главный процесс не валидирует
    // схемой), но становится НЕОТКРЫВАЕМОЙ насовсем: quizStore.loadQuiz()
    // проверяет RusiqQuizSchema.safeParse и вернёт null, каталог покажет
    // «файл повреждён» для викторины, которая на самом деле просто пуста.
    // Найдено ревью Задачи 8 (Important, помечено как унаследованное из
    // текста плана) - проверка здесь, а не в buildBlankQuiz (Задача 8),
    // т.к. 0 вопросов - валидное ПРОМЕЖУТОЧНОЕ состояние во время
    // редактирования, невалидно только для СОХРАНЕНИЯ.
    if (quiz.questions.length === 0) {
      setSaveError('Добавьте хотя бы один вопрос перед сохранением');
      return;
    }
    setSaving(true);
    setSaveError(null);
    if (pendingBg) {
      const bgResult = await saveQuizBackground(quiz.id, pendingBg.buffer, pendingBg.mimeType);
      if (!bgResult.ok) {
        setSaveError('Не удалось сохранить фоновое изображение');
        setSaving(false);
        return;
      }
      setPendingBg(null);
    }
    const ok = await saveQuiz(quiz);
    setSaving(false);
    if (!ok) {
      setSaveError('Не удалось сохранить викторину — попробуйте ещё раз');
      return;
    }
    setLastSavedQuiz(quiz);
  }

  function handleExit() {
    if (hasUnsavedChanges && !confirm('Выйти без сохранения?')) return;
    onExit();
  }

  const selectedQuestion = selection?.kind === 'question' ? quiz.questions.find((q) => q.id === selection.questionId) ?? null : null;
  const existingThemes = Array.from(new Set(quiz.questions.map((q) => q.theme).filter((t) => t.length > 0)));

  return (
    <div style={{ display: 'flex', gap: 16, padding: 16, fontFamily: 'sans-serif' }}>
      <div>
        <div style={{ marginBottom: 8, display: 'flex', gap: 8 }}>
          <button onClick={() => setAddMode(addMode === 'question' ? 'none' : 'question')} style={{ fontWeight: addMode === 'question' ? 'bold' : 'normal' }}>
            Добавить вопрос
          </button>
          <button
            onClick={() => setAddMode(addMode === 'decoy-of-selected' ? 'none' : 'decoy-of-selected')}
            disabled={selection?.kind !== 'question'}
            style={{ fontWeight: addMode === 'decoy-of-selected' ? 'bold' : 'normal' }}
          >
            Добавить ложную точку к вопросу
          </button>
          <button onClick={() => setAddMode(addMode === 'generic-decoy' ? 'none' : 'generic-decoy')} style={{ fontWeight: addMode === 'generic-decoy' ? 'bold' : 'normal' }}>
            Добавить общую ложную точку
          </button>
        </div>
        <p style={{ fontSize: 12, opacity: 0.7 }}>Общих ложных точек: {quiz.genericDecoyPoints.length} из рекомендуемых 10</p>
        <QuizCanvas
          imageUrl={backgroundUrl}
          imageWidth={quiz.image.width}
          imageHeight={quiz.image.height}
          questions={quiz.questions}
          genericDecoyPoints={quiz.genericDecoyPoints}
          selectedQuestionId={selection?.kind === 'question' ? selection.questionId : null}
          addMode={addMode}
          onSelectQuestion={(id) => setSelection(id ? { kind: 'question', questionId: id } : null)}
          onAddQuestionPoint={handleAddQuestionPoint}
          onAddDecoyToSelected={handleAddDecoyToSelected}
          onAddGenericDecoy={handleAddGenericDecoy}
          onMoveQuestionPoint={handleMoveQuestionPoint}
          onMoveDecoyOfQuestion={handleMoveDecoyOfQuestion}
          onMoveGenericDecoy={handleMoveGenericDecoy}
          onSelectDecoyOfQuestion={(questionId, decoyIndex) => setSelection({ kind: 'decoy-of-question', questionId, decoyIndex })}
          onSelectGenericDecoy={(index) => setSelection({ kind: 'generic-decoy', index })}
        />
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <button onClick={() => setHistory(undo)} disabled={!canUndo(history)}>
            Отменить
          </button>
          <button onClick={() => setHistory(redo)} disabled={!canRedo(history)}>
            Повторить
          </button>
        </div>
      </div>
      <div style={{ width: 320 }}>
        <label style={{ display: 'block', marginBottom: 8 }}>
          Название викторины
          <input value={quiz.title} onChange={(e) => update({ ...quiz, title: e.target.value })} style={{ display: 'block', width: '100%', padding: 6 }} />
        </label>
        {selectedQuestion && (
          <PointEditForm
            question={selectedQuestion}
            existingThemes={existingThemes}
            onChange={handleQuestionChange}
            onDelete={handleDeleteSelectedQuestion}
            onClose={() => setSelection(null)}
          />
        )}
        {selection?.kind === 'decoy-of-question' && (
          <div style={{ border: '1px solid #ccc', padding: 16, borderRadius: 8 }}>
            <p>Ложная точка вопроса</p>
            <button onClick={() => handleDeleteDecoyOfQuestion(selection.questionId, selection.decoyIndex)}>Удалить эту точку</button>
          </div>
        )}
        {selection?.kind === 'generic-decoy' && (
          <div style={{ border: '1px solid #ccc', padding: 16, borderRadius: 8 }}>
            <p>Общая ложная точка</p>
            <button onClick={() => handleDeleteGenericDecoy(selection.index)}>Удалить эту точку</button>
          </div>
        )}
        <div style={{ marginTop: 16, border: '1px solid #ccc', padding: 16, borderRadius: 8 }}>
          <p style={{ margin: 0 }}>Пароль викторины: {quiz.passwordHash ? 'установлен' : 'не установлен'}</p>
          <input
            type="password"
            placeholder="Новый пароль"
            value={passwordDraft}
            onChange={(e) => setPasswordDraft(e.target.value)}
            style={{ display: 'block', width: '100%', padding: 6, marginTop: 8 }}
          />
          <div style={{ marginTop: 8 }}>
            <button onClick={handleSetPassword} disabled={passwordDraft.trim().length === 0}>
              Задать пароль
            </button>
            {quiz.passwordHash && (
              <button onClick={handleClearPassword} style={{ marginLeft: 8 }}>
                Снять пароль
              </button>
            )}
          </div>
        </div>
        {saveError && <p style={{ color: '#c0392b' }}>{saveError}</p>}
        <div style={{ marginTop: 16 }}>
          <button onClick={handleSave} disabled={saving}>
            Сохранить
          </button>
          <button onClick={handleExit} style={{ marginLeft: 8 }}>
            Назад к каталогу
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditorScreen;
```

- [ ] **Step 2: Заменить заглушку дублирования встроенной викторины в `QuizCatalogScreen.tsx`**

Заменить пропсы:

```typescript
interface Props {
  builtinQuizTitle: string;
  activeQuizId: string | null;
  onSetActiveQuiz: (quizId: string | null) => void;
  onEditQuiz: (quiz: RusiqQuiz, pendingBackground: { buffer: ArrayBuffer; mimeType: string } | null) => void;
  onExit: () => void;
}
```

на:

```typescript
interface Props {
  builtinQuizTitle: string;
  activeQuizId: string | null;
  onSetActiveQuiz: (quizId: string | null) => void;
  onEditQuiz: (quiz: RusiqQuiz, pendingBackground: { buffer: ArrayBuffer; mimeType: string } | null) => void;
  onDuplicateBuiltin: () => Promise<void>;
  onExit: () => void;
}
```

Заменить сигнатуру и удалить пустое тело `handleDuplicateBuiltin`:

```typescript
  async function handleDuplicateBuiltin() {
    // Дублирование встроенной "Обучение грамоте" требует её полного объекта
    // (все 608 вопросов) - но RusiqRuntime хранит его как модульную
    // константу BUILTIN_QUIZ, недоступную отсюда напрямую. Проще и надёжнее
    // передать колбэк, который делает дублирование средствами родителя -
    // см. Задачу 11, где RusiqRuntime прокидывает готовую функцию через
    // проп onDuplicateBuiltin вместо прямого доступа к константе.
  }
```

Удалить полностью — вызов заменяется на проп `onDuplicateBuiltin` напрямую.

В `QuizCatalogScreen`, заменить сигнатуру компонента:

```typescript
const QuizCatalogScreen: React.FC<Props> = ({ builtinQuizTitle, activeQuizId, onSetActiveQuiz, onEditQuiz, onExit }) => {
```

на:

```typescript
const QuizCatalogScreen: React.FC<Props> = ({ builtinQuizTitle, activeQuizId, onSetActiveQuiz, onEditQuiz, onDuplicateBuiltin, onExit }) => {
```

Заменить кнопку встроенной викторины:

```tsx
          <button onClick={() => alert('Дублирование встроенной викторины доступно из этого экрана в полной сборке — см. Задачу 11.')}>
            Дублировать
          </button>
```

на:

```tsx
          <button onClick={() => onDuplicateBuiltin().then(refresh)}>Дублировать</button>
```

- [ ] **Step 3: Подключить в `RusiqRuntime.tsx`**

Добавить импорт:

```typescript
import EditorScreen from './editor/EditorScreen.tsx';
import { saveQuiz } from './editor/quizStore.ts';
```

Добавить обработчик дублирования встроенной викторины (использует уже существующую в этом файле константу `BUILTIN_QUIZ`):

```typescript
  async function handleDuplicateBuiltin() {
    const newId = crypto.randomUUID();
    const duplicated: RusiqQuiz = { ...BUILTIN_QUIZ, id: newId, title: `${BUILTIN_QUIZ.title} (копия)`, passwordHash: null };
    await saveQuiz(duplicated);
  }
```

Найти вызов `<QuizCatalogScreen ... />` (добавлен Задачей 8) и заменить целиком:

```tsx
    return (
      <QuizCatalogScreen
        builtinQuizTitle={BUILTIN_QUIZ.title}
        activeQuizId={userData.activeQuizId}
        onSetActiveQuiz={(quizId) => {
          const updated: RusiqUserData = { ...userData, activeQuizId: quizId };
          setUserData(updated);
          saveUserData(updated);
        }}
        onEditQuiz={(quiz, pendingBackground) => {
          setEditingQuiz({ quiz, pendingBackground });
          setPhase('editor');
        }}
        onExit={() => setPhase('intro')}
      />
    );
```

на (добавлена строка `onDuplicateBuiltin`):

```tsx
    return (
      <QuizCatalogScreen
        builtinQuizTitle={BUILTIN_QUIZ.title}
        activeQuizId={userData.activeQuizId}
        onSetActiveQuiz={(quizId) => {
          const updated: RusiqUserData = { ...userData, activeQuizId: quizId };
          setUserData(updated);
          saveUserData(updated);
        }}
        onEditQuiz={(quiz, pendingBackground) => {
          setEditingQuiz({ quiz, pendingBackground });
          setPhase('editor');
        }}
        onDuplicateBuiltin={handleDuplicateBuiltin}
        onExit={() => setPhase('intro')}
      />
    );
```

Заменить финальную заглушку `if (phase === 'editor') return null;` на:

```typescript
  if (phase === 'editor' && editingQuiz) {
    return (
      <EditorScreen
        initialQuiz={editingQuiz.quiz}
        pendingBackground={editingQuiz.pendingBackground}
        onExit={() => {
          setEditingQuiz(null);
          setPhase('catalog');
        }}
      />
    );
  }
```

- [ ] **Step 4: `tsc --noEmit`**

Run: `cd packages/player && npx tsc --noEmit`
Expected: без ошибок. Обратить особое внимание на неиспользуемые параметры/импорты, оставшиеся после правок Step 2.

- [ ] **Step 5: Прогнать весь набор тестов player**

Run: `cd packages/player && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/player/src/rusiq/editor/EditorScreen.tsx packages/player/src/rusiq/editor/QuizCatalogScreen.tsx packages/player/src/rusiq/RusiqRuntime.tsx
git commit -m "feat(rusiq): EditorScreen - сборка редактора точек воедино"
```

---

### Task 12: Приёмочная сверка, документация, финальная живая проверка

**Files:**
- Create: `Тип7_РусIQ/Тип7_трассировочная_матрица_Фаза2a.md` (вне git, в `C:\Users\Алексей\Desktop\kiosk admin\`)
- Modify: `CHANGELOG-DEV.md`
- Modify: `STATUS.md` (вне git)

**Interfaces:**
- Нет — финальная задача, не производит код для последующих задач.

- [ ] **Step 1: Полный прогон тестов и типов**

Run: `cd packages/player && npm test && npx tsc --noEmit`
Expected: PASS, 0 ошибок типов. Записать итоговое число тестов.

- [ ] **Step 2: Живая CDP-проверка полного цикла (протокол playbook §13 — backup/маркер/grep/сборка/восстановление реального `project.json` клиента «Музей СВО»)**

Сценарий (по спеке Фазы 2a, разд. 6 и 1.1):
1. Собрать плеер (`npm run build`) с тестовым `project.json`, содержащим виджет `rusiq`.
2. Восстановить реальный `project.json` СРАЗУ ПОСЛЕ сборки (не до запуска — см. известную ловушку этой же фичи в Фазе 1).
3. Запустить собранное приложение, подключиться по CDP.
4. Открыть интро → «Режим учителя» → задать PIN (например, «1234») → каталог викторин.
5. «Создать новую» → указать название → выбрать локальный файл изображения → форма создания принимает — открывается `EditorScreen`.
6. Кликнуть «Добавить вопрос» → кликнуть на канвасе → заполнить форму (текст/ответ/тема/уровень/вес/время) → добавить ложную точку к этому вопросу → добавить 1-2 общих ложных точки.
7. Задать пароль викторины → нажать «Сохранить».
8. «Назад к каталогу» → убедиться, что новая викторина отображается в списке с иконкой замка.
9. Выйти из каталога, снова войти в режим учителя (PIN уже задан — проверяется форма входа, не setup) → войти в каталог → «Редактировать» на созданной викторине → ввести пароль → убедиться, что редактор открылся с ранее внесёнными вопросом/точками (правки сохранены на диске).
10. В каталоге нажать «Играть эту» на созданной викторине → «Выйти» → пройти обычную игру (интро→настройка→поле→результаты) → подтвердить по заголовку интро и тексту вопроса, что играется именно созданная викторина, не встроенная «Обучение грамоте» (спека разд. 1.1).
11. Отдельно — сценарий отмены: попытаться выйти из `EditorScreen` с несохранёнными изменениями, убедиться, что появляется подтверждение.

Зафиксировать результат каждого шага (успех/находка) в ledger сессии.

- [ ] **Step 3: Написать `Тип7_РусIQ/Тип7_трассировочная_матрица_Фаза2a.md`**

По образцу `Тип7_РусIQ/Тип7_трассировочная_матрица.md` (Фаза 1) — таблица FR-002/008/012/016/017 (все переходят в ✅, см. спеку разд. 0) с указанием конкретного механизма/файла/теста/строки живой проверки для каждого. Указать итоговый процент закрытия ТЗ (уже посчитан в разговоре с пользователем: 18 из 23 содержательных FR виджета до Фазы 2a; после Фазы 2a — обновить с учётом того, что FR-012/016/017 теперь полностью ✅, а не ⏭).

- [ ] **Step 4: Обновить `CHANGELOG-DEV.md`**

Добавить запись в начало файла (по образцу существующих записей этого же виджета) с датой выполнения, перечнем реализованного (12 задач), тестовым покрытием (итоговое число тестов), ссылкой на живую проверку.

- [ ] **Step 5: Обновить `STATUS.md`**

Обновить абзац по Тип7 «РусIQ»: Фаза 2a реализована, ветка `feat/rusiq-editor-phase2a`, обновлённый процент закрытия ТЗ, ссылка на новую трассировочную матрицу.

- [ ] **Step 6: Commit**

```bash
git add CHANGELOG-DEV.md
git commit -m "docs(rusiq): Фаза 2a - трассировочная матрица, приёмочная сверка"
```

(`STATUS.md` и новая трассировочная матрица — вне git, сохраняются напрямую в `C:\Users\Алексей\Desktop\kiosk admin\`, без коммита.)
