# Тип 6 «Матемашка» — Этап 2a: инструменты-лаборатории «Цепочка» и «Два отрезка» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить в виджет KIOSK «Матемашка» два оставшихся обязательных по ТЗ (FR-023/024) инструмента-лаборатории — «Цепочка» и «Два отрезка» — рядом с уже реализованными Весами.

**Architecture:** Продолжение существующей ветки `feat/mathmachine-widget`. Оба инструмента — параметризуемые на лету песочницы без авторского контента (как Весы), с чистой логикой генерации/проверки в отдельных модулях (тестируется без DOM) и рендером на react-konva (уже используется Весами). Экран «Лаборатория» становится меню из трёх инструментов вместо прямого перехода в Весы.

**Tech Stack:** TypeScript, React, react-konva/konva (уже в зависимостях `packages/player`), zod (`packages/shared`), `node:test`/`node:assert/strict`.

**Spec:** `docs/superpowers/specs/2026-09-08-mathmachine-lab-tools-design.md`

## Global Constraints

- Оба новых инструмента — без авторского контента; параметры генерируются на лету (спека разд. 3-5), а не хранятся в JSON-контенте.
- «Цепочка» реализует **собственную** механику продолжения закономерности — оригинальная логика недоступна для восстановления, копировать нечего (спека разд. 1).
- «Два отрезка» реализует механику, максимально близкую к оригиналу (спека разд. 1/5).
- Задания лаборатории **не озвучиваются** (спека разд. 7, подтверждено `help_chm/3_3.html`) — TTS/аудио не добавляются.
- Не входит в объём: изменения `editor-web`, каталога/тем/групп/прогресса обычных заданий, самих Весов, дробного ввода ответа (спека разд. 6).
- Тестовые файлы (`node --experimental-strip-types --test`) обязаны использовать явное расширение `.ts` во всех относительных импортах (ruling Этапа 1, task-1) — иначе `ERR_MODULE_NOT_FOUND`.
- React-компоненты этого плана (`ChainTool.tsx`, `TwoSegmentsTool.tsx`, `LabScreen.tsx`) не имеют автотестов — в `packages/player` нет React-тестовой инфраструктуры (ни в Этапе 1); они верифицируются финальной живой проверкой (Задача 7), а не unit-тестами. Только чистая логика (`chainLogic.ts`, `twoSegmentsLogic.ts`) тестируется.
- `packages/player/package.json`'s `"test"` script уже глобит `src/mathmachine/tools/*.test.ts` (починено в финальном ревью Этапа 1) — новые тестовые файлы в `tools/` подхватятся автоматически, package.json трогать не нужно.
- Ветка — существующая `feat/mathmachine-widget` (не создавать новую), продолжение той же фичи.
- Работа ведётся в том же git-клоне/воркдире, где уже находится ветка `feat/mathmachine-widget` со всей историей Этапа 1 — не клонировать репозиторий заново с нуля.

---

### Task 1: Схема — добавить `chain`/`two_segments` в `MATH_TOOL_IDS`

**Files:**
- Modify: `packages/shared/src/mathmachine/model/schema.ts:72-73`
- Modify: `packages/shared/src/mathmachine/model/schema.test.ts:78-82`

**Interfaces:**
- Consumes: ничего нового — расширяет уже существующий `MathToolSchema`/`MATH_TOOL_IDS`.
- Produces: `MATH_TOOL_IDS` теперь включает `'chain'` и `'two_segments'` — все последующие задачи и контент могут использовать эти id как валидные значения `MathTool.id`.

- [ ] **Step 1: Написать падающий тест**

В `packages/shared/src/mathmachine/model/schema.test.ts` замени существующий тест (строки 78-82):

```ts
test('SectionSchema and MathToolSchema accept minimal well-formed records', () => {
  assert.equal(SectionSchema.safeParse({ id: 's1', name: 'Арифметика', topicIds: ['t1'] }).success, true);
  assert.equal(MathToolSchema.safeParse({ id: 'weights', name: 'Весы' }).success, true);
  assert.equal(MathToolSchema.safeParse({ id: 'not_a_tool', name: 'X' }).success, false);
});

test('MathToolSchema accepts the two Этап 2a tool ids (chain, two_segments)', () => {
  assert.equal(MathToolSchema.safeParse({ id: 'chain', name: 'Цепочка' }).success, true);
  assert.equal(MathToolSchema.safeParse({ id: 'two_segments', name: 'Два отрезка' }).success, true);
});
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

Run: `cd packages/shared && npx tsx --test src/mathmachine/model/schema.test.ts`
Expected: FAIL — новый тест `MathToolSchema accepts the two Этап 2a tool ids...` не проходит, т.к. `'chain'`/`'two_segments'` ещё не входят в `MATH_TOOL_IDS` (`safeParse` вернёт `success: false`).

- [ ] **Step 3: Реализовать минимальное изменение**

В `packages/shared/src/mathmachine/model/schema.ts`, строки 72-73, замени:

```ts
/** Этап 1 — только «Весы»; Этап 2 добавит 'chain'/'two_segments' (ТЗ FR-024). */
export const MATH_TOOL_IDS = ['weights'] as const;
```

на:

```ts
/** Этап 1 — «Весы»; Этап 2a добавил 'chain'/'two_segments' (ТЗ FR-024). */
export const MATH_TOOL_IDS = ['weights', 'chain', 'two_segments'] as const;
```

- [ ] **Step 4: Запустить тест и убедиться, что он проходит**

Run: `cd packages/shared && npx tsx --test src/mathmachine/model/schema.test.ts`
Expected: PASS, все тесты в файле зелёные (включая ранее существовавшие).

- [ ] **Step 5: Пересобрать `packages/shared` (нужно всем последующим задачам)**

Run: `cd packages/shared && npm run build`
Expected: успешная сборка без ошибок TypeScript. Если в этом окружении сломан симлинк `node_modules/@kiosk/shared` в `packages/player`/`packages/server` — пересоздать его (`ln -s ../../shared packages/player/node_modules/@kiosk/shared`, абсолютный или относительный путь в зависимости от ОС) прежде чем переходить к Задаче 2.

- [ ] **Step 6: Закоммитить**

```bash
git add packages/shared/src/mathmachine/model/schema.ts packages/shared/src/mathmachine/model/schema.test.ts
git commit -m "feat(mathmachine): add chain/two_segments to MATH_TOOL_IDS"
```

---

### Task 2: `chainLogic.ts` — генерация и проверка закономерности «Цепочки»

**Files:**
- Create: `packages/player/src/mathmachine/tools/chainLogic.ts`
- Test: `packages/player/src/mathmachine/tools/chainLogic.test.ts`

**Interfaces:**
- Consumes: ничего из предыдущих задач этого плана (чистый модуль, без зависимостей на `@kiosk/shared`).
- Produces (используется Задачей 3, `ChainTool.tsx`):
  - `type ChainCategory = 'number' | 'shape' | 'letter' | 'toy'`
  - `SHAPE_POOL: readonly string[]`, `LETTER_POOL: readonly string[]`, `TOY_POOL: readonly string[]`
  - `interface ChainPuzzle { category: ChainCategory; values: string[]; blankIndices: number[] }`
  - `generateChainPuzzle(rng?: () => number): ChainPuzzle`
  - `checkChainAnswers(puzzle: ChainPuzzle, placedByIndex: Record<number, string>): Record<number, boolean>`
  - `buildNumberPaletteValues(puzzle: ChainPuzzle): string[]`

- [ ] **Step 1: Написать падающие тесты**

Создай `packages/player/src/mathmachine/tools/chainLogic.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateChainPuzzle,
  checkChainAnswers,
  buildNumberPaletteValues,
  SHAPE_POOL,
  LETTER_POOL,
  TOY_POOL,
  type ChainPuzzle,
} from './chainLogic.ts';

test('generateChainPuzzle is deterministic given a fixed rng', () => {
  const puzzle = generateChainPuzzle(() => 0);
  assert.deepEqual(puzzle, { category: 'number', values: ['12', '9', '6', '3', '0'], blankIndices: [2] });
});

test('generateChainPuzzle always keeps number-category values within 0..30 with a constant step', () => {
  for (let i = 0; i < 200; i++) {
    const puzzle = generateChainPuzzle(Math.random);
    assert.ok(puzzle.values.length >= 5 && puzzle.values.length <= 7);
    assert.ok(puzzle.blankIndices.length === 1 || puzzle.blankIndices.length === 2);
    assert.equal(new Set(puzzle.blankIndices).size, puzzle.blankIndices.length);
    for (const idx of puzzle.blankIndices) {
      assert.ok(idx > 0 && idx < puzzle.values.length - 1);
    }
    if (puzzle.category === 'number') {
      const nums = puzzle.values.map(Number);
      const step = nums[1] - nums[0];
      assert.notEqual(step, 0);
      for (const n of nums) assert.ok(n >= 0 && n <= 30);
      for (let k = 1; k < nums.length; k++) {
        assert.equal(nums[k] - nums[k - 1], step);
      }
    } else {
      const pool = puzzle.category === 'shape' ? SHAPE_POOL : puzzle.category === 'letter' ? LETTER_POOL : TOY_POOL;
      for (const v of puzzle.values) assert.ok((pool as readonly string[]).includes(v));
    }
  }
});

test('checkChainAnswers marks each blank correct only on exact match', () => {
  const puzzle: ChainPuzzle = { category: 'number', values: ['2', '4', '6', '8', '10'], blankIndices: [2, 4] };
  const result = checkChainAnswers(puzzle, { 2: '6', 4: '9' });
  assert.deepEqual(result, { 2: true, 4: false });
});

test('checkChainAnswers treats a missing placement as incorrect', () => {
  const puzzle: ChainPuzzle = { category: 'letter', values: ['А', 'Б', 'А', 'Б', 'А'], blankIndices: [1] };
  const result = checkChainAnswers(puzzle, {});
  assert.deepEqual(result, { 1: false });
});

test('buildNumberPaletteValues always includes 0-9 plus any correct two-digit blank values', () => {
  const puzzle: ChainPuzzle = { category: 'number', values: ['20', '23', '26', '29'], blankIndices: [1, 3] };
  const tiles = buildNumberPaletteValues(puzzle);
  assert.deepEqual(tiles, ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '23', '29']);
});

test('buildNumberPaletteValues returns the base digits for non-number categories', () => {
  const puzzle: ChainPuzzle = { category: 'shape', values: ['circle', 'square', 'circle'], blankIndices: [1] };
  assert.deepEqual(buildNumberPaletteValues(puzzle), ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
});
```

- [ ] **Step 2: Запустить тесты и убедиться, что они падают**

Run: `cd packages/player && node --experimental-strip-types --test src/mathmachine/tools/chainLogic.test.ts`
Expected: FAIL с `ERR_MODULE_NOT_FOUND` (`./chainLogic.ts` ещё не существует).

- [ ] **Step 3: Реализовать `chainLogic.ts`**

Создай `packages/player/src/mathmachine/tools/chainLogic.ts`:

```ts
// Чистая математика/логика инструмента-лаборатории «Цепочка» (ТЗ FR-024,
// Этап 2a). Оригинальная механика недоступна для восстановления (в
// распакованных ресурсах — только графика `lab_chain.xml/png`, правила
// закономерности были зашиты в недоступный .swf) — это собственная
// закономерность с той же дидактической целью, см. спеку разд. 1/4.

export type ChainCategory = 'number' | 'shape' | 'letter' | 'toy';

export const SHAPE_POOL = ['circle', 'square', 'triangle'] as const;
export const LETTER_POOL = ['А', 'Б', 'В'] as const;
export const TOY_POOL = ['ball', 'car', 'flower'] as const;

const CHAIN_LENGTH_MIN = 5;
const CHAIN_LENGTH_MAX = 7;
const NUMBER_RANGE_MIN = 0;
const NUMBER_RANGE_MAX = 30;
const NUMBER_STEPS = [-3, -2, -1, 1, 2, 3];

export interface ChainPuzzle {
  category: ChainCategory;
  values: string[];
  blankIndices: number[];
}

function pickInt(rng: () => number, min: number, maxInclusive: number): number {
  return min + Math.floor(rng() * (maxInclusive - min + 1));
}

function pickOne<T>(rng: () => number, items: readonly T[]): T {
  return items[pickInt(rng, 0, items.length - 1)];
}

function generateNumberValues(rng: () => number, length: number): string[] {
  const step = pickOne(rng, NUMBER_STEPS);
  const span = (length - 1) * step;
  const minStart = step > 0 ? NUMBER_RANGE_MIN : NUMBER_RANGE_MIN - span;
  const maxStart = step > 0 ? NUMBER_RANGE_MAX - span : NUMBER_RANGE_MAX;
  const start = pickInt(rng, minStart, maxStart);
  return Array.from({ length }, (_, i) => String(start + i * step));
}

function poolForCategory(category: Exclude<ChainCategory, 'number'>): readonly string[] {
  if (category === 'shape') return SHAPE_POOL;
  if (category === 'letter') return LETTER_POOL;
  return TOY_POOL;
}

function generatePatternValues(rng: () => number, category: Exclude<ChainCategory, 'number'>, length: number): string[] {
  const pool = poolForCategory(category);
  const period = pickInt(rng, 2, Math.min(3, pool.length));
  return Array.from({ length }, (_, i) => pool[i % period]);
}

function pickBlankIndices(rng: () => number, length: number): number[] {
  const interior = Array.from({ length: length - 2 }, (_, i) => i + 1); // 1..length-2, никогда не первая/последняя
  const count = pickInt(rng, 1, 2);
  const shuffled = [...interior];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = pickInt(rng, 0, i);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count).sort((a, b) => a - b);
}

export function generateChainPuzzle(rng: () => number = Math.random): ChainPuzzle {
  const category = pickOne<ChainCategory>(rng, ['number', 'shape', 'letter', 'toy']);
  const length = pickInt(rng, CHAIN_LENGTH_MIN, CHAIN_LENGTH_MAX);
  const values = category === 'number' ? generateNumberValues(rng, length) : generatePatternValues(rng, category, length);
  const blankIndices = pickBlankIndices(rng, length);
  return { category, values, blankIndices };
}

export function checkChainAnswers(puzzle: ChainPuzzle, placedByIndex: Record<number, string>): Record<number, boolean> {
  const result: Record<number, boolean> = {};
  for (const index of puzzle.blankIndices) {
    result[index] = placedByIndex[index] === puzzle.values[index];
  }
  return result;
}

const BASE_DIGIT_TILES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function buildNumberPaletteValues(puzzle: ChainPuzzle): string[] {
  if (puzzle.category !== 'number') return [...BASE_DIGIT_TILES];
  const extras = puzzle.blankIndices.map((i) => puzzle.values[i]).filter((v) => !BASE_DIGIT_TILES.includes(v));
  return [...BASE_DIGIT_TILES, ...extras];
}
```

- [ ] **Step 4: Запустить тесты и убедиться, что они проходят**

Run: `cd packages/player && node --experimental-strip-types --test src/mathmachine/tools/chainLogic.test.ts`
Expected: PASS, все 6 тестов зелёные.

- [ ] **Step 5: Закоммитить**

```bash
git add packages/player/src/mathmachine/tools/chainLogic.ts packages/player/src/mathmachine/tools/chainLogic.test.ts
git commit -m "feat(mathmachine): add chainLogic — generation/validation for the Цепочка lab tool"
```

---

### Task 3: `ChainTool.tsx` — рендер и drag-and-drop «Цепочки»

**Files:**
- Create: `packages/player/src/mathmachine/tools/ChainTool.tsx`

**Interfaces:**
- Consumes: всё из Задачи 2 (`generateChainPuzzle`, `checkChainAnswers`, `buildNumberPaletteValues`, `SHAPE_POOL`, `LETTER_POOL`, `TOY_POOL`, `ChainCategory`, `ChainPuzzle`).
- Produces (используется Задачей 6): `ChainTool: React.FC<{ onClose: () => void }>` (default export), тот же контракт пропсов, что у существующего `WeightsTool`.

Эта задача не имеет автотеста (React-компонент, см. Global Constraints) — сборка TypeScript — единственная механическая проверка на этом шаге, полная верификация — в Задаче 7.

- [ ] **Step 1: Создать компонент**

Создай `packages/player/src/mathmachine/tools/ChainTool.tsx`:

```tsx
// packages/player/src/mathmachine/tools/ChainTool.tsx
import React, { useRef, useState } from 'react';
import { Stage, Layer, Circle, Group, Line, Text } from 'react-konva';
import {
  generateChainPuzzle,
  checkChainAnswers,
  buildNumberPaletteValues,
  SHAPE_POOL,
  LETTER_POOL,
  TOY_POOL,
  type ChainCategory,
  type ChainPuzzle,
} from './chainLogic.ts';

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 300;
const CHAIN_Y = 80;
const PALETTE_Y = 220;
const DROP_RADIUS = 40;

const TABS: { id: ChainCategory; label: string }[] = [
  { id: 'number', label: 'Числа' },
  { id: 'shape', label: 'Фигуры' },
  { id: 'letter', label: 'Буквы' },
  { id: 'toy', label: 'Игрушки' },
];

interface Props {
  onClose: () => void;
}

function slotX(index: number, length: number): number {
  const gap = CANVAS_WIDTH / (length + 1);
  return gap * (index + 1);
}

function paletteX(index: number): number {
  return 40 + index * 70;
}

function paletteValuesForTab(tab: ChainCategory, puzzle: ChainPuzzle): string[] {
  if (tab === 'number') return buildNumberPaletteValues(puzzle);
  if (tab === 'shape') return [...SHAPE_POOL];
  if (tab === 'letter') return [...LETTER_POOL];
  return [...TOY_POOL];
}

const ChainTool: React.FC<Props> = ({ onClose }) => {
  const [puzzle, setPuzzle] = useState<ChainPuzzle>(() => generateChainPuzzle());
  const [placedByIndex, setPlacedByIndex] = useState<Record<number, string>>({});
  const [result, setResult] = useState<Record<number, boolean> | null>(null);
  const [activeTab, setActiveTab] = useState<ChainCategory>('number');
  const tileHomeRef = useRef<Record<string, { x: number; y: number }>>({});

  function newPuzzle() {
    setPuzzle(generateChainPuzzle());
    setPlacedByIndex({});
    setResult(null);
  }

  function handleCheck() {
    setResult(checkChainAnswers(puzzle, placedByIndex));
  }

  function handleTileDragEnd(value: string, tileKey: string) {
    return (e: any) => {
      const node = e.target;
      const x = node.x();
      const y = node.y();
      let droppedIndex: number | null = null;
      for (const index of puzzle.blankIndices) {
        const dx = x - slotX(index, puzzle.values.length);
        const dy = y - CHAIN_Y;
        if (Math.sqrt(dx * dx + dy * dy) <= DROP_RADIUS) {
          droppedIndex = index;
          break;
        }
      }
      const home = tileHomeRef.current[tileKey];
      if (home) node.position(home);
      if (droppedIndex !== null) {
        setPlacedByIndex((prev) => ({ ...prev, [droppedIndex as number]: value }));
        setResult(null);
      }
    };
  }

  const paletteValues = paletteValuesForTab(activeTab, puzzle);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', maxWidth: CANVAS_WIDTH }}>
        <h3>Цепочка</h3>
        <button onClick={onClose}>Выйти</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={tabButtonStyle(tab.id === activeTab)}>
            {tab.label}
          </button>
        ))}
      </div>

      <Stage width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
        <Layer>
          <Line points={[20, CHAIN_Y, CANVAS_WIDTH - 20, CHAIN_Y]} stroke="#f1c40f" strokeWidth={4} />
          {puzzle.values.map((value, index) => {
            const isBlank = puzzle.blankIndices.includes(index);
            const placed = placedByIndex[index];
            const shown = isBlank ? placed : value;
            const isCorrect = result ? result[index] : undefined;
            const strokeColor = isCorrect === true ? '#2ecc71' : isCorrect === false ? '#e74c3c' : '#888';
            return (
              <React.Fragment key={index}>
                <Circle
                  x={slotX(index, puzzle.values.length)}
                  y={CHAIN_Y}
                  radius={26}
                  fill={shown ? '#fff' : 'transparent'}
                  stroke={strokeColor}
                  strokeWidth={3}
                  dash={shown ? undefined : [6, 4]}
                />
                {shown && (
                  <Text
                    text={shown}
                    x={slotX(index, puzzle.values.length) - 20}
                    y={CHAIN_Y - 12}
                    width={40}
                    align="center"
                    fontSize={20}
                  />
                )}
              </React.Fragment>
            );
          })}

          {paletteValues.map((value, i) => {
            const tileKey = `${activeTab}-${value}-${i}`;
            const home = { x: paletteX(i), y: PALETTE_Y };
            tileHomeRef.current[tileKey] = home;
            return (
              <Group key={tileKey} x={home.x} y={home.y} draggable onDragEnd={handleTileDragEnd(value, tileKey)}>
                <Circle radius={24} fill="#eaf4ff" stroke="#3498db" strokeWidth={2} />
                <Text text={value} x={-20} y={-10} width={40} align="center" fontSize={18} listening={false} />
              </Group>
            );
          })}
        </Layer>
      </Stage>

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={handleCheck}>Проверить</button>
        <button onClick={newPuzzle}>Новая цепочка</button>
      </div>
    </div>
  );
};

function tabButtonStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 12px',
    borderRadius: 6,
    border: active ? '2px solid #2ecc71' : '1px solid #ccc',
    background: active ? '#eafff2' : '#fff',
    cursor: 'pointer',
  };
}

export default ChainTool;
```

- [ ] **Step 2: Проверить сборку TypeScript**

Run: `cd packages/player && npx tsc --noEmit`
Expected: без новых ошибок типов (react-konva/konva уже в зависимостях `packages/player/package.json`; если `node_modules/react-konva`/`node_modules/konva` отсутствуют в этом окружении — `npm install` перед этим шагом).

- [ ] **Step 3: Закоммитить**

```bash
git add packages/player/src/mathmachine/tools/ChainTool.tsx
git commit -m "feat(mathmachine): add ChainTool — drag-and-drop UI for the Цепочка lab tool"
```

---

### Task 4: `twoSegmentsLogic.ts` — генерация и проверка «Двух отрезков»

**Files:**
- Create: `packages/player/src/mathmachine/tools/twoSegmentsLogic.ts`
- Test: `packages/player/src/mathmachine/tools/twoSegmentsLogic.test.ts`

**Interfaces:**
- Consumes: ничего из предыдущих задач (независимый чистый модуль).
- Produces (используется Задачей 5, `TwoSegmentsTool.tsx`):
  - `type SegmentDirection = 'longer' | 'shorter'`
  - `interface TwoSegmentsPuzzle { referenceLength: number; delta: number; direction: SegmentDirection }`
  - `RULER_MIN_CM: number`, `RULER_MAX_CM: number`
  - `generateTwoSegmentsPuzzle(rng?: () => number): TwoSegmentsPuzzle`
  - `targetLength(puzzle: TwoSegmentsPuzzle): number`
  - `checkSegmentAnswer(puzzle: TwoSegmentsPuzzle, draggedLength: number): boolean`

- [ ] **Step 1: Написать падающие тесты**

Создай `packages/player/src/mathmachine/tools/twoSegmentsLogic.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateTwoSegmentsPuzzle,
  checkSegmentAnswer,
  targetLength,
  RULER_MIN_CM,
  RULER_MAX_CM,
  type TwoSegmentsPuzzle,
} from './twoSegmentsLogic.ts';

test('generateTwoSegmentsPuzzle is deterministic given a fixed rng', () => {
  const puzzle = generateTwoSegmentsPuzzle(() => 0);
  assert.deepEqual(puzzle, { referenceLength: 4, delta: 1, direction: 'longer' });
  assert.equal(targetLength(puzzle), 5);
});

test('generateTwoSegmentsPuzzle always keeps the target length within the ruler range', () => {
  for (let i = 0; i < 200; i++) {
    const puzzle = generateTwoSegmentsPuzzle(Math.random);
    assert.ok(puzzle.referenceLength >= 4 && puzzle.referenceLength <= 20);
    assert.ok(puzzle.delta >= 1 && puzzle.delta <= 10);
    const target = targetLength(puzzle);
    assert.ok(target >= RULER_MIN_CM && target <= RULER_MAX_CM);
  }
});

test('checkSegmentAnswer accepts only the exact target length (longer direction)', () => {
  const puzzle: TwoSegmentsPuzzle = { referenceLength: 10, delta: 3, direction: 'longer' };
  assert.equal(checkSegmentAnswer(puzzle, 13), true);
  assert.equal(checkSegmentAnswer(puzzle, 12), false);
  assert.equal(checkSegmentAnswer(puzzle, 14), false);
});

test('checkSegmentAnswer accepts only the exact target length (shorter direction)', () => {
  const puzzle: TwoSegmentsPuzzle = { referenceLength: 10, delta: 3, direction: 'shorter' };
  assert.equal(checkSegmentAnswer(puzzle, 7), true);
  assert.equal(checkSegmentAnswer(puzzle, 8), false);
});
```

- [ ] **Step 2: Запустить тесты и убедиться, что они падают**

Run: `cd packages/player && node --experimental-strip-types --test src/mathmachine/tools/twoSegmentsLogic.test.ts`
Expected: FAIL с `ERR_MODULE_NOT_FOUND` (`./twoSegmentsLogic.ts` ещё не существует).

- [ ] **Step 3: Реализовать `twoSegmentsLogic.ts`**

Создай `packages/player/src/mathmachine/tools/twoSegmentsLogic.ts`:

```ts
// Чистая математика/логика инструмента-лаборатории «Два отрезка» (ТЗ
// FR-024, Этап 2a). Механика близка к оригиналу (спека разд. 1/5): один
// отрезок фиксированной длины, второй ребёнок подгоняет под текстовое
// условие сравнения.

export type SegmentDirection = 'longer' | 'shorter';

export interface TwoSegmentsPuzzle {
  referenceLength: number;
  delta: number;
  direction: SegmentDirection;
}

export const RULER_MIN_CM = 0;
export const RULER_MAX_CM = 30;

const REFERENCE_MIN_CM = 4;
const REFERENCE_MAX_CM = 20;
const DELTA_MIN_CM = 1;
const DELTA_MAX_CM = 10;

function pickInt(rng: () => number, min: number, maxInclusive: number): number {
  return min + Math.floor(rng() * (maxInclusive - min + 1));
}

export function generateTwoSegmentsPuzzle(rng: () => number = Math.random): TwoSegmentsPuzzle {
  const referenceLength = pickInt(rng, REFERENCE_MIN_CM, REFERENCE_MAX_CM);
  const direction: SegmentDirection = rng() < 0.5 ? 'longer' : 'shorter';
  const maxDelta = direction === 'longer' ? RULER_MAX_CM - referenceLength : referenceLength - RULER_MIN_CM;
  const delta = pickInt(rng, DELTA_MIN_CM, Math.min(DELTA_MAX_CM, maxDelta));
  return { referenceLength, delta, direction };
}

export function targetLength(puzzle: TwoSegmentsPuzzle): number {
  return puzzle.direction === 'longer' ? puzzle.referenceLength + puzzle.delta : puzzle.referenceLength - puzzle.delta;
}

export function checkSegmentAnswer(puzzle: TwoSegmentsPuzzle, draggedLength: number): boolean {
  return draggedLength === targetLength(puzzle);
}
```

Примечание для реализатора: `REFERENCE_MIN_CM=4`/`REFERENCE_MAX_CM=20` и `RULER_MAX_CM=30` подобраны так, что `maxDelta` всегда ≥ `DELTA_MIN_CM` (худший случай — `referenceLength=20` и `direction='longer'` даёт `maxDelta=10`; `referenceLength=4` и `direction='shorter'` даёт `maxDelta=4`) — `pickInt` никогда не получит `min > max`. Тест на 200 случайных прогонов выше проверяет этот инвариант напрямую; если в будущем константы поменяют, тест сразу это поймает.

- [ ] **Step 4: Запустить тесты и убедиться, что они проходят**

Run: `cd packages/player && node --experimental-strip-types --test src/mathmachine/tools/twoSegmentsLogic.test.ts`
Expected: PASS, все 4 теста зелёные.

- [ ] **Step 5: Закоммитить**

```bash
git add packages/player/src/mathmachine/tools/twoSegmentsLogic.ts packages/player/src/mathmachine/tools/twoSegmentsLogic.test.ts
git commit -m "feat(mathmachine): add twoSegmentsLogic — generation/validation for the Два отрезка lab tool"
```

---

### Task 5: `TwoSegmentsTool.tsx` — рендер и перетаскивание «Двух отрезков»

**Files:**
- Create: `packages/player/src/mathmachine/tools/TwoSegmentsTool.tsx`

**Interfaces:**
- Consumes: всё из Задачи 4 (`generateTwoSegmentsPuzzle`, `checkSegmentAnswer`, `targetLength`, `RULER_MIN_CM`, `RULER_MAX_CM`, `TwoSegmentsPuzzle`).
- Produces (используется Задачей 6): `TwoSegmentsTool: React.FC<{ onClose: () => void }>` (default export), тот же контракт пропсов, что у `WeightsTool`/`ChainTool`.

Без автотеста (см. Global Constraints) — TypeScript-сборка единственная механическая проверка здесь, полная верификация в Задаче 7.

- [ ] **Step 1: Создать компонент**

Создай `packages/player/src/mathmachine/tools/TwoSegmentsTool.tsx`:

```tsx
// packages/player/src/mathmachine/tools/TwoSegmentsTool.tsx
import React, { useState } from 'react';
import { Stage, Layer, Rect, Circle, Line, Text } from 'react-konva';
import {
  generateTwoSegmentsPuzzle,
  checkSegmentAnswer,
  RULER_MIN_CM,
  RULER_MAX_CM,
  type TwoSegmentsPuzzle,
} from './twoSegmentsLogic.ts';

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 260;
const RULER_X0 = 20;
const PX_PER_CM = (CANVAS_WIDTH - 40) / RULER_MAX_CM;
const REFERENCE_Y = 60;
const DRAGGED_Y = 160;
const BAR_HEIGHT = 20;

interface Props {
  onClose: () => void;
}

function cmToPx(cm: number): number {
  return RULER_X0 + cm * PX_PER_CM;
}

function directionLabel(direction: TwoSegmentsPuzzle['direction']): string {
  return direction === 'longer' ? 'длиннее' : 'короче';
}

const TwoSegmentsTool: React.FC<Props> = ({ onClose }) => {
  const [puzzle, setPuzzle] = useState<TwoSegmentsPuzzle>(() => generateTwoSegmentsPuzzle());
  const [draggedLength, setDraggedLength] = useState(puzzle.referenceLength);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  function newPuzzle() {
    const next = generateTwoSegmentsPuzzle();
    setPuzzle(next);
    setDraggedLength(next.referenceLength);
    setIsCorrect(null);
  }

  function handleCheck() {
    setIsCorrect(checkSegmentAnswer(puzzle, draggedLength));
  }

  function handleHandleDragMove(e: any) {
    const rawCm = (e.target.x() - RULER_X0) / PX_PER_CM;
    const snappedCm = Math.max(RULER_MIN_CM, Math.min(RULER_MAX_CM, Math.round(rawCm)));
    e.target.x(cmToPx(snappedCm));
    setDraggedLength(snappedCm);
    setIsCorrect(null);
  }

  const ticks = Array.from({ length: RULER_MAX_CM + 1 }, (_, cm) => cm);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', maxWidth: CANVAS_WIDTH }}>
        <h3>Два отрезка</h3>
        <button onClick={onClose}>Выйти</button>
      </div>

      <p style={{ fontSize: 18 }}>
        Розовый отрезок на {puzzle.delta} см {directionLabel(puzzle.direction)} зелёного.
      </p>

      <Stage width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
        <Layer>
          {ticks.map((cm) => (
            <Line
              key={cm}
              points={[cmToPx(cm), REFERENCE_Y - 10, cmToPx(cm), DRAGGED_Y + BAR_HEIGHT + 10]}
              stroke="#ddd"
              strokeWidth={1}
            />
          ))}

          <Rect x={RULER_X0} y={REFERENCE_Y} width={puzzle.referenceLength * PX_PER_CM} height={BAR_HEIGHT} fill="#2ecc71" />
          <Text x={RULER_X0} y={REFERENCE_Y - 22} text={`Зелёный: ${puzzle.referenceLength} см`} fontSize={16} />

          <Rect x={RULER_X0} y={DRAGGED_Y} width={draggedLength * PX_PER_CM} height={BAR_HEIGHT} fill="#e84393" />
          <Text x={RULER_X0} y={DRAGGED_Y - 22} text={`Розовый: ${draggedLength} см`} fontSize={16} />

          <Circle
            x={cmToPx(draggedLength)}
            y={DRAGGED_Y + BAR_HEIGHT / 2}
            radius={12}
            fill={isCorrect === true ? '#2ecc71' : isCorrect === false ? '#e74c3c' : '#e84393'}
            draggable
            dragBoundFunc={(pos) => ({ x: pos.x, y: DRAGGED_Y + BAR_HEIGHT / 2 })}
            onDragMove={handleHandleDragMove}
          />
        </Layer>
      </Stage>

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={handleCheck}>Проверить</button>
        <button onClick={newPuzzle}>Новое задание</button>
      </div>
    </div>
  );
};

export default TwoSegmentsTool;
```

- [ ] **Step 2: Проверить сборку TypeScript**

Run: `cd packages/player && npx tsc --noEmit`
Expected: без новых ошибок типов.

- [ ] **Step 3: Закоммитить**

```bash
git add packages/player/src/mathmachine/tools/TwoSegmentsTool.tsx
git commit -m "feat(mathmachine): add TwoSegmentsTool — draggable length-comparison UI"
```

---

### Task 6: Экран «Лаборатория» — меню трёх инструментов + регистрация в контенте

**Files:**
- Create: `packages/player/src/mathmachine/LabScreen.tsx`
- Modify: `packages/player/src/mathmachine/MathMachineRuntime.tsx`
- Modify: `packages/player/src/mathmachine/content/pilotContent.json`

**Interfaces:**
- Consumes: `WeightsTool` (существует), `ChainTool` (Задача 3), `TwoSegmentsTool` (Задача 5).
- Produces: `LabScreen: React.FC<{ onExit: () => void }>` (default export). `MathMachineRuntime`'s `Screen` type больше не включает `'weights'` напрямую — заменён на `'lab'`.

Без автотеста (см. Global Constraints) — TypeScript-сборка на этом шаге, полная верификация в Задаче 7.

- [ ] **Step 1: Создать `LabScreen.tsx`**

Создай `packages/player/src/mathmachine/LabScreen.tsx`:

```tsx
// packages/player/src/mathmachine/LabScreen.tsx
import React, { useState } from 'react';
import WeightsTool from './tools/WeightsTool';
import ChainTool from './tools/ChainTool';
import TwoSegmentsTool from './tools/TwoSegmentsTool';

type LabTool = 'menu' | 'weights' | 'chain' | 'two_segments';

interface Props {
  onExit: () => void;
}

const LabScreen: React.FC<Props> = ({ onExit }) => {
  const [tool, setTool] = useState<LabTool>('menu');

  if (tool === 'weights') return <WeightsTool onClose={() => setTool('menu')} />;
  if (tool === 'chain') return <ChainTool onClose={() => setTool('menu')} />;
  if (tool === 'two_segments') return <TwoSegmentsTool onClose={() => setTool('menu')} />;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', maxWidth: 640 }}>
        <h3>Лаборатория</h3>
        <button onClick={onExit}>Назад</button>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <button onClick={() => setTool('weights')}>Весы</button>
        <button onClick={() => setTool('chain')}>Цепочка</button>
        <button onClick={() => setTool('two_segments')}>Два отрезка</button>
      </div>
    </div>
  );
};

export default LabScreen;
```

- [ ] **Step 2: Подключить `LabScreen` в `MathMachineRuntime.tsx`**

В `packages/player/src/mathmachine/MathMachineRuntime.tsx`:

Замени (строки 4-7):
```ts
import CatalogScreen from './CatalogScreen';
import WeightsTool from './tools/WeightsTool';
import { loadUserDataAsync, saveUserDataAsync, FALLBACK_USER_DATA } from './userDataStorage';
import pilotContentJson from './content/pilotContent.json';
```
на:
```ts
import CatalogScreen from './CatalogScreen';
import LabScreen from './LabScreen';
import { loadUserDataAsync, saveUserDataAsync, FALLBACK_USER_DATA } from './userDataStorage';
import pilotContentJson from './content/pilotContent.json';
```

Замени (строка 13):
```ts
type Screen = 'catalog' | 'weights';
```
на:
```ts
type Screen = 'catalog' | 'lab';
```

Замени (строка 73):
```tsx
          <button onClick={() => setScreen('weights')}>Лаборатория: Весы</button>
```
на:
```tsx
          <button onClick={() => setScreen('lab')}>Лаборатория</button>
```

Замени (строка 88):
```tsx
      {screen === 'weights' && <WeightsTool onClose={() => setScreen('catalog')} />}
```
на:
```tsx
      {screen === 'lab' && <LabScreen onExit={() => setScreen('catalog')} />}
```

- [ ] **Step 3: Добавить `chain`/`two_segments` в `mathTools` пилотного контента**

В `packages/player/src/mathmachine/content/pilotContent.json`, найди массив `"mathTools"` (сейчас содержит только запись `weights`) и добавь две записи, чтобы список отражал все три реализованных инструмента (сам список пока не читается рантаймом — см. спеку разд. 2 «Уточнение» — но должен оставаться полным и корректным как часть контента):

```json
"mathTools": [
  { "id": "weights", "name": "Весы" },
  { "id": "chain", "name": "Цепочка" },
  { "id": "two_segments", "name": "Два отрезка" }
]
```

Редактируй JSON вручную (не через PowerShell `ConvertTo-Json` — в Этапе 1 это меняло форматирование всего файла без надобности) — вставь две записи в существующий массив, сохранив текущий стиль отступов файла.

- [ ] **Step 4: Проверить сборку TypeScript и валидность JSON**

Run: `cd packages/player && npx tsc --noEmit`
Expected: без новых ошибок типов.

Run: `cd packages/player && node -e "const c = require('./src/mathmachine/content/pilotContent.json'); console.log(c.mathTools.length)"`
Expected: выводит `3`.

- [ ] **Step 5: Закоммитить**

```bash
git add packages/player/src/mathmachine/LabScreen.tsx packages/player/src/mathmachine/MathMachineRuntime.tsx packages/player/src/mathmachine/content/pilotContent.json
git commit -m "feat(mathmachine): add LabScreen menu, wire Цепочка/Два отрезка into the runtime"
```

---

### Task 7: Живая проверка (packaged Electron + CDP)

**Files:** нет изменений кода, если живая проверка не найдёт багов (если найдёт — фикс-раунд по тому же файлу/файлам, что вызвали баг, тем же процессом, что Задача 15 Этапа 1).

**Interfaces:** нет новых — эта задача только верифицирует поведение всего, что произвели Задачи 1-6.

- [ ] **Step 1: Собрать и запустить пакетированный Electron**

Тот же процесс, что и Task 15/финальный фикс Этапа 1 (см. `.superpowers/sdd/2026-09-07-mathmachine-widget-phase1/` историю, если она ещё существует, либо коммиты `d221012`/`d933fb6`/`6d380e3` для справки):

1. Убедиться, что `packages/chrono-ui` собран (`cd packages/chrono-ui && npm install && npm run build`), если ещё не собран в этом окружении.
2. Временно подставить в `packages/player/electron/project.json` проект с виджетом `mathmachine` (сохранить оригинал перед правкой, восстановить после через `git checkout --`).
3. `cd packages/player && npm run package` (запускает `build && electron-builder --dir`).
4. Запустить `dist-electron/win-unpacked/Музей СВО.exe --remote-debugging-port=9333`.
5. Подключиться CDP (WebSocket, `ws`-пакет уже есть в `node_modules`) и провести через сценарий ниже, делая скриншоты на каждом шаге.

- [ ] **Step 2: Пройти голден-путь обоих новых инструментов**

Через CDP (`Runtime.evaluate` для кликов/чтения DOM, `Page.captureScreenshot` для доказательств):

1. Открыть виджет → кнопка «Лаборатория» → убедиться, что видно три кнопки (Весы/Цепочка/Два отрезка), не одна.
2. Открыть «Цепочка»: убедиться, что цепочка отрисована (звенья + минимум один пунктирный пропуск), палитра показывает вкладки и элементы текущей категории. Перетащить (drag) элемент из палитры на пустой слот — убедиться, что слот заполнился этим значением. Нажать «Проверить» — если значение верное, слот подсвечивается зелёным; если сгенерированный пример позволяет легко проверить неверный вариант — перетащить заведомо неверный элемент на другой пропуск и убедиться, что подсвечивается красным. Нажать «Новая цепочка» — убедиться, что генерируется новая закономерность (значения меняются).
3. Открыть «Два отрезка»: убедиться, что видно два прямоугольника-отрезка с общей линейкой и текст условия с конкретными числами. Перетащить ручку (кружок) розового отрезка вдоль линейки — убедиться, что розовый прямоугольник и подпись длины меняются вживую по мере перетаскивания, с привязкой к целым см. Дотащить до значения, удовлетворяющего условию, нажать «Проверить» — убедиться в зелёной подсветке; сдвинуть на 1 см и проверить снова — убедиться в красной подсветке. Нажать «Новое задание» — убедиться, что генерируется новое условие.
4. Проверить, что кнопка «Выйти» в каждом инструменте и «Назад» в меню «Лаборатория» возвращают на предыдущий экран корректно.
5. Проверить консоль (`Runtime.enable` + слушать `Runtime.consoleAPICalled`) на отсутствие необработанных ошибок за весь сценарий.

- [ ] **Step 3: Прогнать полный юнит-тестовый набор**

Run: `cd packages/player && npm test`
Expected: все тесты зелёные, включая новые `chainLogic.test.ts`/`twoSegmentsLogic.test.ts` (пикапятся существующим глобом `src/mathmachine/tools/*.test.ts`).

Run: `cd packages/shared && npx tsx --test $(find src -name "*.test.ts")` (bash) — или эквивалент на используемой ОС.
Expected: все тесты зелёные, включая обновлённый `schema.test.ts`.

- [ ] **Step 4: Откат временных правок и уборка**

```bash
git checkout -- packages/player/electron/project.json
git status --short packages/player/dist-electron  # если появились неожиданные треканые диффы — откатить тем же git checkout --
```
Убить процесс `Музей СВО.exe`, если ещё запущен. Удалить временные CDP-скрипты/логи из scratch-директории.

- [ ] **Step 5: Зафиксировать результат**

Если живая проверка нашла реальный баг — исправить в соответствующем файле (Задача 2-6), повторить Steps 1-3 живой проверки, затем закоммитить фикс отдельным коммитом с понятным сообщением (`fix(mathmachine): ...`), указав, что баг найден именно живой проверкой, а не только тестами (тот же паттерн, что коммиты `6337bfb`/`91c9f4d` Этапа 1).

Если багов не найдено — никакого дополнительного коммита не требуется, эта задача завершается без изменений кода.

---
