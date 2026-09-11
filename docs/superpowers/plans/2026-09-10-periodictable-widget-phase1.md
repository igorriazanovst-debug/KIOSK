# Тип 8 «Интерактивная таблица Менделеева» — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `periodictable` KIOSK widget — a standalone-app Electron reference tool showing all 118 chemical elements in short-period and IUPAC long-period forms, with element cards covering all 18 FR-005 characteristics, class/oxide-character highlighting (FR-006), a teacher-PIN-gated view-settings tab, search, and a legend — in one phase (no content editor, per the literal ТЗ text).

**Architecture:** New widget package under `packages/player/src/periodictable/` following the `rusiq`/`mathmachine` convention exactly (own `model/schema.ts` with zod, own `content/elements.json`, own `screens/`). No IPC/electron main-process changes are needed (unlike rusiq/mathmachine) because this widget has no per-user progress data — the only local state (last-chosen table form/indication) lives in `localStorage`. Widget registration follows the established three-file pattern (`Player.tsx`, `windowMode.js`, `packages/shared/.../widgetProperties.ts`) plus the established allow-list pattern (`packages/server/src/config/periodicTableAccess.ts`).

**Tech Stack:** TypeScript, React 18, zod, `node --test` (via `--experimental-strip-types`, no build step for tests), Vite (player bundler), Express + Prisma (server, unchanged except allow-list), same monorepo conventions as `packages/player/src/rusiq`.

**Spec:** `docs/superpowers/specs/2026-09-10-periodictable-widget-design.md`

## Global Constraints

- Interface is Russian-only — no language switcher, no OS3 branding, no start screen (spec §1 п.4, §2).
- All 18 FR-005 characteristics must be present on every element record (spec §4); numeric facts sourced from open scientific data, descriptive text rewritten in our own words — never copied verbatim from the ОС3 dump or zperiod.app (spec §1 п.1).
- Element sample photos come from zperiod.app as literal image files (accepted legal risk, user decision 2026-09-10) — not Wikimedia. Confirm technical feasibility via the Task 3 spike before committing to a photo count in the content task.
- `schemaVersion: 1` on the content file from day one (playbook §2) — do not skip versioning "because there's no migration yet."
- Content package lives in `packages/player/src/periodictable/`, **not** `packages/shared/` — `packages/shared` has no wired `npm test` script; this project's test convention keeps validated content next to the tests that run it (matches `rusiq`/`mathmachine`).
- `packages/player/package.json`'s `test` script is an explicit file-glob list, not a wildcard directory scan — every new `*.test.ts` directory added by this plan MUST be appended to that glob or the tests silently never run (Task 1, Step 8).
- Widget registration is a three-file operation that must land together: `packages/player/src/Player.tsx` (import + switch case + `isStandaloneAppProject` list), `packages/player/electron/chrono/windowMode.js` (`STANDALONE_APP_WIDGET_TYPES`), `packages/shared/src/periodictable/widgetProperties.ts` (type + defaults). Forgetting one produces a working-looking but broken standalone window (playbook §4 finding, repeated twice in Тип6 history).
- Allow-list is `mokretcov.m@poznaikino.ru`, same pattern as chronoline/naturalcommunities/mathmachine/rusiq — duplicated client-side (`WidgetLibrary.tsx`, cosmetic hide) and server-side (`periodicTableAccess.ts`, the actual enforcement).
- Work happens on branch `feat/periodictable-widget` (already created, pushed) in the isolated worktree `C:\recovery_work\worktrees\periodictable-widget` (set up 2026-09-10 to stop this branch colliding with a parallel session sharing `C:\recovery_work\kiosk-repo`) — commit and push at the end of every task (playbook §7). The shared clone `C:\recovery_work\kiosk-repo` is parked on `main` and must not be touched by this plan's execution.

---

### Task 1: Widget type + vertical slice integration

**Files:**
- Create: `packages/shared/src/periodictable/widgetProperties.ts`
- Create: `packages/shared/src/periodictable/widgetProperties.test.ts`
- Modify: `packages/shared/src/index.ts`
- Create: `packages/player/src/periodictable/PeriodicTableRuntime.tsx`
- Modify: `packages/player/src/Player.tsx`
- Modify: `packages/player/electron/chrono/windowMode.js`
- Modify: `packages/player/package.json`
- Create: `packages/editor-web/src/components/PeriodicTablePropertiesSection.tsx`
- Modify: `packages/editor-web/src/components/PropertiesPanel.tsx`
- Modify: `packages/editor-web/src/components/WidgetLibrary.tsx`

**Interfaces:**
- Produces: `PERIODICTABLE_WIDGET_TYPE = 'periodictable'`, `interface PeriodicTableWidgetProperties { title?: string; teacherPin?: string }`, `PERIODICTABLE_DEFAULT_PROPS`, `PERIODICTABLE_DEFAULT_SIZE`, `PERIODICTABLE_PROPS_VERSION` — all later tasks importing widget-level config use these exact names from `@kiosk/shared`.
- Produces: `PeriodicTableRuntime` React component accepting `{ properties: { title?: string; teacherPin?: string } }` — Task 9 (PIN) reads `properties.teacherPin` from here.

- [ ] **Step 1: Write `widgetProperties.ts`**

```ts
// packages/shared/src/periodictable/widgetProperties.ts
// Описание типа виджета "periodictable" — формат поля widget.properties.
// Единственный источник (editor-web И player подключают отсюда), тот же
// принцип, что у mathmachine/rusiq/widgetProperties.ts. Как и mathmachine/
// rusiq, у этого виджета НЕТ встроенного сервера и НЕТ IPC-хранилища —
// единственное настраиваемое свойство (teacherPin) живёт в самом проекте,
// не на диске устройства (спека, разд. 5/9,
// docs/superpowers/specs/2026-09-10-periodictable-widget-design.md).

export const PERIODICTABLE_WIDGET_TYPE = 'periodictable' as const;

export interface PeriodicTableWidgetProperties {
  /** Заголовок виджета (опционально) */
  title?: string;
  /** 4-значный PIN для разблокировки вкладки «Настройки вида» учителем */
  teacherPin?: string;
}

export const PERIODICTABLE_PROPS_VERSION = '1.0';

export const PERIODICTABLE_DEFAULT_PROPS: PeriodicTableWidgetProperties = {
  title: 'Таблица Менделеева',
  teacherPin: '0000',
};

export const PERIODICTABLE_DEFAULT_SIZE = {
  width: 1024,
  height: 768,
};
```

- [ ] **Step 2: Write `widgetProperties.test.ts`**

```ts
// packages/shared/src/periodictable/widgetProperties.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PERIODICTABLE_WIDGET_TYPE,
  PERIODICTABLE_DEFAULT_PROPS,
  PERIODICTABLE_DEFAULT_SIZE,
} from './widgetProperties.ts';

test('widget type constant is the expected string', () => {
  assert.equal(PERIODICTABLE_WIDGET_TYPE, 'periodictable');
});

test('default props include a non-empty title and a 4-digit teacherPin', () => {
  assert.ok(PERIODICTABLE_DEFAULT_PROPS.title && PERIODICTABLE_DEFAULT_PROPS.title.length > 0);
  assert.match(PERIODICTABLE_DEFAULT_PROPS.teacherPin ?? '', /^\d{4}$/);
});

test('default size is positive in both dimensions', () => {
  assert.ok(PERIODICTABLE_DEFAULT_SIZE.width > 0);
  assert.ok(PERIODICTABLE_DEFAULT_SIZE.height > 0);
});
```

Note: check `packages/shared/package.json` for how `mathmachine`/`rusiq` `.test.ts` files are actually run (this plan's Global Constraints note that `packages/shared` has no wired `npm test` — if that's still true, this test file documents intent/type-checks under `tsc` but isn't executed by CI; do not spend time trying to wire a shared test runner as part of this task, it's out of scope).

- [ ] **Step 3: Add the shared export**

In `packages/shared/src/index.ts`, alongside the existing `rusiq`/`mathmachine` export lines, add:

```ts
export * from './periodictable/widgetProperties';
```

- [ ] **Step 4: Write a placeholder `PeriodicTableRuntime.tsx`**

This is the vertical slice — proves the widget opens full-screen before any real content exists.

```tsx
// packages/player/src/periodictable/PeriodicTableRuntime.tsx
import React from 'react';
import type { PeriodicTableWidgetProperties } from '@kiosk/shared';

interface Props {
  properties: PeriodicTableWidgetProperties;
}

const PeriodicTableRuntime: React.FC<Props> = ({ properties }) => (
  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
    <h1>{properties.title ?? 'Таблица Менделеева'}</h1>
  </div>
);

export default PeriodicTableRuntime;
```

(Task 6 replaces this body with the real `TableScreen`/tab orchestration; the exported component name and `Props` shape stay the same so `Player.tsx` never needs a second edit.)

- [ ] **Step 5: Wire `Player.tsx`**

Add the import near the existing `RusiqRuntime` import (around line 12):

```ts
import PeriodicTableRuntime from './periodictable/PeriodicTableRuntime';
```

Add a new `case` in the widget-render switch, directly after the existing `case 'rusiq':` block (around line 585), following the exact same shape:

```tsx
      case 'periodictable':
        // Тот же принцип, что "mathmachine"/"rusiq"/"naturalcommunities"/
        // "chronoline" выше — заполняет реальный размер окна/экрана целиком.
        return (
          <div
            key={widget.id}
            style={{ ...commonStyle, left: 0, top: 0, width: viewportSize.width, height: viewportSize.height, overflow: 'hidden' }}
          >
            <PeriodicTableRuntime properties={widget.properties as any} />
          </div>
        );
```

Update the `isStandaloneAppProject` check (around line 1124-1126) to include the new type:

```ts
  const isStandaloneAppProject = project.widgets.some(
    (w) => w.type === 'chronoline' || w.type === 'naturalcommunities' || w.type === 'mathmachine' || w.type === 'rusiq' || w.type === 'periodictable'
  );
```

- [ ] **Step 6: Wire `windowMode.js`**

In `packages/player/electron/chrono/windowMode.js`, add a fifth constant and extend the list (around lines 22-26):

```js
const PERIODICTABLE_WIDGET_TYPE = 'periodictable';
const STANDALONE_APP_WIDGET_TYPES = [CHRONOLINE_WIDGET_TYPE, NATCOM_WIDGET_TYPE, MATHMACHINE_WIDGET_TYPE, RUSIQ_WIDGET_TYPE, PERIODICTABLE_WIDGET_TYPE];
```

- [ ] **Step 7: Verify `windowMode.js`'s existing test still passes and covers the new type**

Run: `cd packages/player && node --experimental-strip-types --test electron/chrono/windowMode.test.js`
Expected: PASS. Open `electron/chrono/windowMode.test.js`, find the test that iterates `STANDALONE_APP_WIDGET_TYPES` (or asserts window options per known type) and add a `'periodictable'` case matching the existing `'rusiq'`/`'mathmachine'` assertions if the test enumerates types explicitly. If the test already iterates the exported list generically, no edit is needed — just confirm by reading it.

- [ ] **Step 8: Register the new test globs in `package.json`**

In `packages/player/package.json`, extend the `test` script (this is the step described in Global Constraints — easy to forget):

```json
"test": "node --experimental-strip-types --test src/chrono/*.test.ts src/natcom/*.test.ts src/mathmachine/*.test.ts src/mathmachine/tools/*.test.ts src/mathmachine/content/*.test.ts src/rusiq/*.test.ts src/rusiq/model/*.test.ts src/rusiq/content/*.test.ts src/periodictable/*.test.ts src/periodictable/model/*.test.ts src/periodictable/content/*.test.ts electron/chrono/*.test.js electron/natcom/*.test.js electron/mathmachine/*.test.js electron/rusiq/*.test.js"
```

- [ ] **Step 9: Add the editor-web widget-properties section**

```tsx
// packages/editor-web/src/components/PeriodicTablePropertiesSection.tsx
// Панель свойств виджета «Таблица Менделеева» в редакторе — заголовок +
// PIN «режима учителя» (спека, разд. 5). Контент справочника не
// редактируется через эту панель — он встроен и неизменен (спека, разд. 2).

import React from 'react';
import type { Widget } from '../types';
import { PERIODICTABLE_WIDGET_TYPE, PeriodicTableWidgetProperties } from '@kiosk/shared';

interface Props {
  widget: Widget;
  onPropertiesChange: (key: string, value: any) => void;
}

const PeriodicTablePropertiesSection: React.FC<Props> = ({ widget, onPropertiesChange }) => {
  if (widget.type !== PERIODICTABLE_WIDGET_TYPE) return null;

  const props = widget.properties as Partial<PeriodicTableWidgetProperties>;

  return (
    <div className="property-section">
      <h4>Таблица Менделеева</h4>

      <div className="property-field">
        <label>Заголовок виджета</label>
        <input
          type="text"
          value={props.title || ''}
          placeholder="Таблица Менделеева"
          onChange={(e) => onPropertiesChange('title', e.target.value)}
        />
      </div>

      <div className="property-field">
        <label>PIN «режима учителя» (4 цифры)</label>
        <input
          type="text"
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          value={props.teacherPin || ''}
          placeholder="0000"
          onChange={(e) => onPropertiesChange('teacherPin', e.target.value.replace(/\D/g, '').slice(0, 4))}
        />
      </div>
    </div>
  );
};

export default PeriodicTablePropertiesSection;
```

- [ ] **Step 10: Wire the new section into `PropertiesPanel.tsx`**

Add the import near the existing `MathMachinePropertiesSection` import (around line 8):

```ts
import PeriodicTablePropertiesSection from './PeriodicTablePropertiesSection';
```

Add the JSX block directly after the existing `<MathMachinePropertiesSection ... />` block (around line 81):

```tsx
        {/* Секция виджета «Таблица Менделеева» */}
        <PeriodicTablePropertiesSection
          widget={selectedWidget}
          onPropertiesChange={handlePropertiesChange}
        />
```

- [ ] **Step 11: Register the widget in `WidgetLibrary.tsx`**

Add `Atom` to the `lucide-react` import (line 3) and the shared-constants import (line 6):

```ts
import { Square, Type, Image, Video, MousePointer, Menu, Globe, Compass, History, TreePine, Calculator, Languages, Atom } from 'lucide-react';
```

```ts
import { CHRONOLINE_WIDGET_TYPE, CHRONOLINE_DEFAULT_PROPS, CHRONOLINE_DEFAULT_SIZE, NATCOM_WIDGET_TYPE, NATCOM_DEFAULT_PROPS, NATCOM_DEFAULT_SIZE, MATHMACHINE_WIDGET_TYPE, MATHMACHINE_DEFAULT_PROPS, MATHMACHINE_DEFAULT_SIZE, RUSIQ_WIDGET_TYPE, RUSIQ_DEFAULT_PROPS, RUSIQ_DEFAULT_SIZE, PERIODICTABLE_WIDGET_TYPE, PERIODICTABLE_DEFAULT_PROPS, PERIODICTABLE_DEFAULT_SIZE } from '@kiosk/shared';
```

Add the allow-list constant next to the existing ones (around line 18):

```ts
const PERIODICTABLE_ALLOWED_EMAILS = ['mokretcov.m@poznaikino.ru'];
```

Add the derived boolean next to `isRusiqAllowed` (around line 26):

```ts
  const isPeriodicTableAllowed = !!currentUserEmail && PERIODICTABLE_ALLOWED_EMAILS.includes(currentUserEmail.toLowerCase());
```

Add the widget-type entry directly after the existing `isRusiqAllowed` block (around line 144):

```tsx
    ...(isPeriodicTableAllowed ? [{
      type: PERIODICTABLE_WIDGET_TYPE,
      name: 'Таблица Менделеева',
      icon: Atom,
      defaultProps: PERIODICTABLE_DEFAULT_PROPS,
      defaultSize: PERIODICTABLE_DEFAULT_SIZE
    }] : [])
```

- [ ] **Step 12: Build and run every affected package's checks**

Run: `cd packages/shared && npx tsc --noEmit`
Expected: no new errors.

Run: `cd packages/player && npx tsc --noEmit && npm test`
Expected: PASS, including the new `widgetProperties`-adjacent files compiling and the existing `windowMode.test.js` green.

Run: `cd packages/editor-web && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 13: Live check — widget opens full-screen**

Follow playbook §5's CDP procedure: start `packages/player` in dev mode with `--remote-debugging-port`, load a test project whose `widgets` array contains one `{ type: 'periodictable', properties: { title: 'Таблица Менделеева' } }` entry, connect via CDP, confirm the placeholder heading renders and fills the window (no double-scroll, no clipped canvas — the exact failure mode from the Global Constraints note about the three-file registration).

- [ ] **Step 14: Commit**

```bash
git add packages/shared/src/periodictable packages/shared/src/index.ts packages/player/src/periodictable packages/player/src/Player.tsx packages/player/electron/chrono/windowMode.js packages/player/electron/chrono/windowMode.test.js packages/player/package.json packages/editor-web/src/components/PeriodicTablePropertiesSection.tsx packages/editor-web/src/components/PropertiesPanel.tsx packages/editor-web/src/components/WidgetLibrary.tsx
git commit -m "feat(periodictable): register widget type and vertical slice"
git push
```

---

### Task 2: Content schema (zod)

**Files:**
- Create: `packages/player/src/periodictable/model/schema.ts`
- Create: `packages/player/src/periodictable/model/schema.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `PERIODICTABLE_CONTENT_SCHEMA_VERSION = 1`, `PeriodicElementSchema`, `type PeriodicElement`, `PeriodicTableContentSchema`, `type PeriodicTableContent` — every later task (content, layout, screens) imports these exact names.

- [ ] **Step 1: Write the failing test first**

```ts
// packages/player/src/periodictable/model/schema.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PeriodicTableContentSchema, PERIODICTABLE_CONTENT_SCHEMA_VERSION } from './schema.ts';

const hydrogen = {
  atomicNumber: 1,
  symbol: 'H',
  nameRu: 'Водород',
  nameLatin: 'Hydrogenium',
  atomicMass: 1.008,
  period: 1,
  groupIupac: 1,
  isLanthanide: false,
  isActinide: false,
  electronType: 's',
  elementClass: 'nonmetal',
  oxideCharacter: 'none',
  electronConfiguration: '1s1',
  naturalOccurrence: 'Самый распространённый элемент во Вселенной; на Земле — в составе воды и органических соединений.',
  physicalStateNormal: 'газ',
  crystalLattice: 'не образует (газ при н.у.)',
  allotropes: '',
  stableIsotopes: '1, 2',
  electrochemicalSeriesPosition: null,
  density: 0.00009,
  meltingPointK: 14.01,
  boilingPointK: 20.28,
  oxidationStates: '+1, -1',
  electronegativityPauling: 2.2,
  photo: null,
};

test('a valid element passes PeriodicTableContentSchema', () => {
  const content = { schemaVersion: PERIODICTABLE_CONTENT_SCHEMA_VERSION, elements: [hydrogen] };
  assert.equal(PeriodicTableContentSchema.safeParse(content).success, true);
});

test('duplicate atomicNumber is rejected', () => {
  const content = { schemaVersion: PERIODICTABLE_CONTENT_SCHEMA_VERSION, elements: [hydrogen, { ...hydrogen }] };
  const result = PeriodicTableContentSchema.safeParse(content);
  assert.equal(result.success, false);
});

test('a main-grid element (not lanthanide/actinide footer) missing groupIupac is rejected', () => {
  const broken = { ...hydrogen, groupIupac: null };
  const content = { schemaVersion: PERIODICTABLE_CONTENT_SCHEMA_VERSION, elements: [broken] };
  const result = PeriodicTableContentSchema.safeParse(content);
  assert.equal(result.success, false);
});

test('a footer lanthanide (atomicNumber 58-71, not 57) may have groupIupac null', () => {
  const cerium = { ...hydrogen, atomicNumber: 58, symbol: 'Ce', nameRu: 'Церий', nameLatin: 'Cerium', period: 6, groupIupac: null, isLanthanide: true, elementClass: 'metal' };
  const content = { schemaVersion: PERIODICTABLE_CONTENT_SCHEMA_VERSION, elements: [cerium] };
  assert.equal(PeriodicTableContentSchema.safeParse(content).success, true);
});

test('lanthanum itself (atomicNumber 57) still requires groupIupac even though isLanthanide is true', () => {
  const lanthanum = { ...hydrogen, atomicNumber: 57, symbol: 'La', nameRu: 'Лантан', nameLatin: 'Lanthanum', period: 6, groupIupac: null, isLanthanide: true, elementClass: 'metal' };
  const content = { schemaVersion: PERIODICTABLE_CONTENT_SCHEMA_VERSION, elements: [lanthanum] };
  assert.equal(PeriodicTableContentSchema.safeParse(content).success, false);
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd packages/player && node --experimental-strip-types --test src/periodictable/model/schema.test.ts`
Expected: FAIL — `./schema.ts` does not exist yet.

- [ ] **Step 3: Write `schema.ts`**

```ts
// packages/player/src/periodictable/model/schema.ts
// zod-схема данных виджета «Таблица Менделеева» (Тип 8) — единственная
// точка, через которую проходит справочный контент (118 элементов). Тот же
// принцип, что у mathmachine/rusiq model/schema.ts. Размещено в
// packages/player (не packages/shared) сознательно — см. Global Constraints
// плана: у packages/shared нет подключённого npm test.

import { z } from 'zod';

export const PERIODICTABLE_CONTENT_SCHEMA_VERSION = 1 as const;

export const ElementClassSchema = z.enum(['metal', 'metalloid', 'nonmetal']);
export type ElementClass = z.infer<typeof ElementClassSchema>;

export const ElectronTypeSchema = z.enum(['s', 'p', 'd', 'f']);
export type ElectronType = z.infer<typeof ElectronTypeSchema>;

export const OxideCharacterSchema = z.enum(['acidic', 'basic', 'amphoteric', 'none']);
export type OxideCharacter = z.infer<typeof OxideCharacterSchema>;

export const PeriodicElementSchema = z.object({
  atomicNumber: z.number().int().min(1).max(118),
  symbol: z.string().min(1).max(3),
  nameRu: z.string().min(1),
  nameLatin: z.string().min(1),
  atomicMass: z.number().positive(),

  period: z.number().int().min(1).max(7),
  // null ТОЛЬКО для лантаноидов/актиноидов, вынесенных в отдельную
  // строку-«подвал» (Ce..Lu = 58..71, Th..Lr = 90..103) — сам лантан (57) и
  // актиний (89) занимают место в основной сетке и обязаны иметь groupIupac
  // (проверяется в superRefine ниже).
  groupIupac: z.number().int().min(1).max(18).nullable(),
  isLanthanide: z.boolean(),
  isActinide: z.boolean(),

  // Классификация FR-006
  electronType: ElectronTypeSchema,
  elementClass: ElementClassSchema,
  oxideCharacter: OxideCharacterSchema,

  // Остальные характеристики FR-005 (18 всего, см. разд. 4 спеки)
  electronConfiguration: z.string().min(1),
  naturalOccurrence: z.string(),
  physicalStateNormal: z.string().min(1),
  crystalLattice: z.string(),
  allotropes: z.string(),
  stableIsotopes: z.string(),
  electrochemicalSeriesPosition: z.string().nullable(),
  density: z.number().nonnegative().nullable(),
  meltingPointK: z.number().nonnegative().nullable(),
  boilingPointK: z.number().nonnegative().nullable(),
  oxidationStates: z.string(),
  electronegativityPauling: z.number().nonnegative().nullable(),

  photo: z.object({ fileName: z.string().min(1) }).nullable(),
});
export type PeriodicElement = z.infer<typeof PeriodicElementSchema>;

function isFooterElement(el: PeriodicElement): boolean {
  return (el.isLanthanide && el.atomicNumber !== 57) || (el.isActinide && el.atomicNumber !== 89);
}

const PeriodicTableContentShapeSchema = z.object({
  schemaVersion: z.literal(PERIODICTABLE_CONTENT_SCHEMA_VERSION),
  elements: z.array(PeriodicElementSchema),
});

export const PeriodicTableContentSchema = PeriodicTableContentShapeSchema.superRefine((content, ctx) => {
  const seenNumbers = new Set<number>();
  content.elements.forEach((el, idx) => {
    if (seenNumbers.has(el.atomicNumber)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['elements', idx, 'atomicNumber'],
        message: `duplicate atomicNumber ${el.atomicNumber} (${el.symbol})`,
      });
    }
    seenNumbers.add(el.atomicNumber);

    if (!isFooterElement(el) && el.groupIupac === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['elements', idx, 'groupIupac'],
        message: `${el.symbol} (${el.atomicNumber}): groupIupac is required for a main-grid element`,
      });
    }
  });
});
export type PeriodicTableContent = z.infer<typeof PeriodicTableContentShapeSchema>;

export { isFooterElement };
```

- [ ] **Step 4: Run the test again to confirm it passes**

Run: `cd packages/player && node --experimental-strip-types --test src/periodictable/model/schema.test.ts`
Expected: PASS, all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/player/src/periodictable/model
git commit -m "feat(periodictable): add content schema with footer-element validation"
git push
```

---

### Task 3: Spike — zperiod.app photo feasibility

**Files:**
- Create: `Тип8_ТаблицаМенделеева/zperiod_фото_спайк.md` (in the admin working folder `C:\Users\Алексей\Desktop\kiosk admin`, **not** the code repo — this is investigation notes, not product code, matching where the ОС3 разбор docs already live).

**Interfaces:**
- Consumes: nothing.
- Produces: a written decision that Task 4 Step 2 and Task 12 depend on — either a concrete, working method to fetch per-element photo files from zperiod.app, or an explicit "not feasible in reasonable time, ship without photos" verdict.

This is a feasibility question, not an implementation task — timebox it. Per playbook §1 п.3: spike the risky technical unknown before planning the content step's scope around it.

- [ ] **Step 1: Inspect zperiod.app's network behavior for a single element**

Use a browser (Playwright MCP tool, already available in this session) to open `https://zperiod.app`, navigate to one element's detail view (e.g. hydrogen or iron — pick a common one likely to have a "verified portrait" per the earlier WebFetch summary), and capture the network requests it makes (`mcp__playwright__browser_network_requests`). Look specifically for image requests (`.jpg`/`.png`/`.webp`) tied to that element.

- [ ] **Step 2: Determine the URL pattern**

If image URLs follow a predictable pattern (e.g. `https://.../elements/<symbol>.jpg` or a CDN path keyed by atomic number), note the exact pattern and confirm it resolves for 2-3 different elements (a light metal, a transition metal, a gas) by fetching them directly.

If URLs are NOT predictable (signed, session-scoped, loaded via a JS SPA route with no stable public asset URL), note that finding explicitly — this is a real possible outcome, not a failure of the spike.

- [ ] **Step 3: Check for rate limiting / robots.txt**

Fetch `https://zperiod.app/robots.txt` and note any `Disallow` rules relevant to the paths found in Step 1-2. If a systematic per-element fetch (118 requests) would violate a stated crawl policy, note that as a constraint on Task 12's photo-sourcing step (space out requests, or skip photos entirely).

- [ ] **Step 4: Write the findings**

Write `zperiod_фото_спайк.md` with: the URL pattern found (or "none found"), confirmation that images are typically without a visible watermark at the source resolution (spec §1 п.2 explicitly wants photos "без водяных знаков и логотипов" — check this directly on 2-3 samples), the robots.txt constraint if any, and a one-line recommendation: proceed with per-element fetch in Task 4, or mark photos as out of scope for this pass.

- [ ] **Step 5: Report the recommendation and get a go/no-go before Task 4**

This spike's output feeds directly into how Task 4 is scoped — if photos are infeasible, Task 4's `photo` fields are simply `null` for all 118 elements and Task 12's acceptance sweep documents this as a known, ТЗ-compliant gap (FR-005 does not require photos — see spec §1 п.4/§2). No code changes in this task; this step is a checkpoint, not a commit.

---

### Task 4: Content — 118 elements

**Files:**
- Create: `packages/player/src/periodictable/content/elements.json`
- Create: `packages/player/src/periodictable/content/elements.test.ts`
- Create (conditionally, depending on Task 3's verdict): `packages/player/public/periodictable/photos/*.jpg`

**Interfaces:**
- Consumes: `PeriodicTableContentSchema`, `PeriodicElement` (Task 2).
- Produces: `elements.json` — the single content file every screen task (5-8) renders from.

This task is content authorship, not code — the schema and invariant tests below are the actual deliverable structure; populating 118 records with real values is the bulk of the work and is expected to take multiple passes (matching the "brute-force takes multiple rounds" precedent from the Матемашка retrospective, though for a different reason here — sourcing/cross-checking facts, not salt search).

- [ ] **Step 1: Write the content invariant tests first**

```ts
// packages/player/src/periodictable/content/elements.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PeriodicTableContentSchema, isFooterElement } from '../model/schema.ts';
import elementsJson from './elements.json' with { type: 'json' };

const parsed = PeriodicTableContentSchema.parse(elementsJson);

test('elements.json parses against PeriodicTableContentSchema without errors', () => {
  assert.equal(PeriodicTableContentSchema.safeParse(elementsJson).success, true);
});

test('exactly 118 elements, atomic numbers 1..118 with no gaps or duplicates', () => {
  const numbers = parsed.elements.map((e) => e.atomicNumber).sort((a, b) => a - b);
  assert.equal(numbers.length, 118);
  for (let i = 0; i < 118; i++) {
    assert.equal(numbers[i], i + 1, `expected atomic number ${i + 1} at sorted index ${i}, got ${numbers[i]}`);
  }
});

test('electron type distribution covers all four blocks (s/p/d/f present)', () => {
  const types = new Set(parsed.elements.map((e) => e.electronType));
  assert.ok(types.has('s') && types.has('p') && types.has('d') && types.has('f'));
});

test('exactly 14 lanthanide-footer elements (58-71) and 14 actinide-footer elements (90-103)', () => {
  const lnFooter = parsed.elements.filter((e) => e.isLanthanide && e.atomicNumber !== 57);
  const acFooter = parsed.elements.filter((e) => e.isActinide && e.atomicNumber !== 89);
  assert.equal(lnFooter.length, 14, `expected 14 footer lanthanides, got ${lnFooter.length}`);
  assert.equal(acFooter.length, 14, `expected 14 footer actinides, got ${acFooter.length}`);
  assert.ok(lnFooter.every((e) => e.atomicNumber >= 58 && e.atomicNumber <= 71));
  assert.ok(acFooter.every((e) => e.atomicNumber >= 90 && e.atomicNumber <= 103));
});

test('every non-footer element has a unique (period, groupIupac) position', () => {
  const seen = new Set<string>();
  for (const el of parsed.elements) {
    if (isFooterElement(el)) continue;
    const key = `${el.period}:${el.groupIupac}`;
    assert.ok(!seen.has(key), `duplicate main-grid position ${key} (latest: ${el.symbol})`);
    seen.add(key);
  }
});

test('metals have a non-null electrochemicalSeriesPosition or explicitly document why not (noble metals below hydrogen are allowed null=documented position text instead)', () => {
  // Не строгий null-запрет — часть благородных металлов имеет текстовое
  // положение вроде "правее водорода, не вытесняет его из кислот", а не
  // null. Инвариант здесь — что поле ХОТЬ ЧТО-ТО непустое содержит для
  // класса metal, т.е. не забыто молча.
  const metalsWithoutPosition = parsed.elements.filter(
    (e) => e.elementClass === 'metal' && e.electrochemicalSeriesPosition === null
  );
  assert.ok(
    metalsWithoutPosition.length < parsed.elements.filter((e) => e.elementClass === 'metal').length * 0.15,
    `too many metals (${metalsWithoutPosition.length}) missing electrochemicalSeriesPosition — likely an omission, not chemistry`
  );
});

test('every element with a photo reference points to a file name, not a full URL (local asset convention)', () => {
  for (const el of parsed.elements) {
    if (el.photo) {
      assert.ok(!el.photo.fileName.startsWith('http'), `${el.symbol}: photo.fileName should be a local file name, not a URL`);
    }
  }
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `cd packages/player && node --experimental-strip-types --test src/periodictable/content/elements.test.ts`
Expected: FAIL — `elements.json` does not exist yet.

- [ ] **Step 3: Author `elements.json` — worked examples for the 5 structural edge cases**

Before filling all 118, lock in the pattern with 5 elements spanning every structural edge case the schema/tests care about: a main-group nonmetal (hydrogen), a transition metal (iron), a footer lanthanide (cerium), a footer actinide (thorium), and a synthetic superheavy element with no stable isotopes/no photo (oganesson). Use open reference data (standard atomic weights, melting/boiling points, Pauling electronegativity — these are well-established, freely available scientific facts, per spec §1 п.1) for the numeric fields; write the descriptive fields in your own words.

```json
[
  {
    "atomicNumber": 1, "symbol": "H", "nameRu": "Водород", "nameLatin": "Hydrogenium",
    "atomicMass": 1.008, "period": 1, "groupIupac": 1, "isLanthanide": false, "isActinide": false,
    "electronType": "s", "elementClass": "nonmetal", "oxideCharacter": "none",
    "electronConfiguration": "1s1",
    "naturalOccurrence": "Самый распространённый элемент во Вселенной; на Земле практически весь связан — в воде, органических веществах, природном газе.",
    "physicalStateNormal": "газ", "crystalLattice": "не образует (газ при нормальных условиях)",
    "allotropes": "", "stableIsotopes": "1, 2", "electrochemicalSeriesPosition": null,
    "density": 0.00009, "meltingPointK": 14.01, "boilingPointK": 20.28,
    "oxidationStates": "+1, -1", "electronegativityPauling": 2.2, "photo": null
  },
  {
    "atomicNumber": 26, "symbol": "Fe", "nameRu": "Железо", "nameLatin": "Ferrum",
    "atomicMass": 55.845, "period": 4, "groupIupac": 8, "isLanthanide": false, "isActinide": false,
    "electronType": "d", "elementClass": "metal", "oxideCharacter": "amphoteric",
    "electronConfiguration": "[Ar] 3d6 4s2",
    "naturalOccurrence": "Второй по распространённости металл земной коры после алюминия; основные руды — гематит, магнетит.",
    "physicalStateNormal": "твёрдое вещество", "crystalLattice": "объёмноцентрированная кубическая (α-Fe)",
    "allotropes": "α-железо (феррит), γ-железо (аустенит), δ-железо — различаются кристаллической решёткой при разных температурах",
    "stableIsotopes": "54, 56, 57, 58", "electrochemicalSeriesPosition": "левее водорода, вытесняет водород из кислот",
    "density": 7.874, "meltingPointK": 1811, "boilingPointK": 3134,
    "oxidationStates": "+2, +3, +6", "electronegativityPauling": 1.83, "photo": null
  },
  {
    "atomicNumber": 58, "symbol": "Ce", "nameRu": "Церий", "nameLatin": "Cerium",
    "atomicMass": 140.116, "period": 6, "groupIupac": null, "isLanthanide": true, "isActinide": false,
    "electronType": "f", "elementClass": "metal", "oxideCharacter": "basic",
    "electronConfiguration": "[Xe] 4f1 5d1 6s2",
    "naturalOccurrence": "Самый распространённый из лантаноидов; добывается из минералов монацита и бастнезита.",
    "physicalStateNormal": "твёрдое вещество", "crystalLattice": "гранецентрированная кубическая",
    "allotropes": "", "stableIsotopes": "136, 138, 140, 142", "electrochemicalSeriesPosition": "левее водорода, вытесняет водород из кислот",
    "density": 6.77, "meltingPointK": 1068, "boilingPointK": 3716,
    "oxidationStates": "+3, +4", "electronegativityPauling": 1.12, "photo": null
  },
  {
    "atomicNumber": 90, "symbol": "Th", "nameRu": "Торий", "nameLatin": "Thorium",
    "atomicMass": 232.038, "period": 7, "groupIupac": null, "isLanthanide": false, "isActinide": true,
    "electronType": "f", "elementClass": "metal", "oxideCharacter": "basic",
    "electronConfiguration": "[Rn] 6d2 7s2",
    "naturalOccurrence": "Слаборадиоактивный, встречается в минерале торите и в составе монацитовых песков вместе с лантаноидами.",
    "physicalStateNormal": "твёрдое вещество", "crystalLattice": "гранецентрированная кубическая",
    "allotropes": "", "stableIsotopes": "", "electrochemicalSeriesPosition": "левее водорода, вытесняет водород из кислот",
    "density": 11.72, "meltingPointK": 2023, "boilingPointK": 5061,
    "oxidationStates": "+4", "electronegativityPauling": 1.3, "photo": null
  },
  {
    "atomicNumber": 118, "symbol": "Og", "nameRu": "Оганесон", "nameLatin": "Oganesson",
    "atomicMass": 294, "period": 7, "groupIupac": 18, "isLanthanide": false, "isActinide": false,
    "electronType": "p", "elementClass": "nonmetal", "oxideCharacter": "none",
    "electronConfiguration": "[Rn] 5f14 6d10 7s2 7p6 (расчётная)",
    "naturalOccurrence": "В природе не встречается — синтезирован искусственно, известны единичные атомы с периодом полураспада менее миллисекунды.",
    "physicalStateNormal": "предположительно твёрдое вещество при н.у. (не подтверждено экспериментально из-за крайне малого времени жизни)",
    "crystalLattice": "не определена экспериментально", "allotropes": "",
    "stableIsotopes": "", "electrochemicalSeriesPosition": null,
    "density": null, "meltingPointK": null, "boilingPointK": null,
    "oxidationStates": "не установлены", "electronegativityPauling": null, "photo": null
  }
]
```

- [ ] **Step 4: Fill in the remaining 113 elements**

Follow the exact field set and sourcing rule from spec §1 п.1 for every remaining element (2-25, 27-57, 59-89, 91-117): numeric fields from open reference data (standard atomic weight tables, melting/boiling points, Pauling electronegativity scale — cross-check figures against zperiod.app's displayed values where convenient, per the original user instruction to use it as an information source, but do not copy its prose); descriptive fields written fresh. Assign `groupIupac`/`period`/`isLanthanide`/`isActinide` per the standard 18-column periodic table layout; assign `elementClass`/`electronType`/`oxideCharacter` per standard inorganic chemistry classification (well-established, not a matter of invention).

- [ ] **Step 5: Add photos, conditionally on Task 3's verdict**

If Task 3 found a workable per-element fetch pattern: download available photos into `packages/player/public/periodictable/photos/<symbol-lowercase>.jpg`, set `photo: { fileName: '<symbol-lowercase>.jpg' }` for each element with a real sample (skip synthetic superheavy elements with no physical sample — `photo: null` for those is correct, not a gap). If Task 3 found it infeasible: leave every `photo` field `null` and note this explicitly in Task 12's acceptance sweep as a documented, ТЗ-compliant simplification (FR-005 doesn't require photos).

- [ ] **Step 6: Run the full content test suite**

Run: `cd packages/player && node --experimental-strip-types --test src/periodictable/content/elements.test.ts`
Expected: PASS, all invariants green (118 elements, no gaps, all 4 electron-type blocks present, exactly 14+14 footer elements, no position collisions).

- [ ] **Step 7: Commit**

```bash
git add packages/player/src/periodictable/content packages/player/public/periodictable
git commit -m "feat(periodictable): add full 118-element content with invariant tests"
git push
```

---

### Task 5: Table layout (both forms)

**Files:**
- Create: `packages/player/src/periodictable/tableLayout.ts`
- Create: `packages/player/src/periodictable/tableLayout.test.ts`

**Interfaces:**
- Consumes: `PeriodicElement` (Task 2), `isFooterElement` (Task 2).
- Produces: `type TableForm = 'short' | 'iupac'`, `function getCellPosition(el: PeriodicElement, form: TableForm): { row: number; col: number }`, `function formatGroupLabel(groupIupac: number, form: TableForm): string` — Task 6's `TableScreen` renders the grid from these.

- [ ] **Step 1: Write the failing test**

```ts
// packages/player/src/periodictable/tableLayout.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getCellPosition, formatGroupLabel } from './tableLayout.ts';
import { PeriodicTableContentSchema } from './model/schema.ts';
import elementsJson from './content/elements.json' with { type: 'json' };

const { elements } = PeriodicTableContentSchema.parse(elementsJson);

test('main-grid short-form positions have no collisions', () => {
  const seen = new Set<string>();
  for (const el of elements) {
    const pos = getCellPosition(el, 'short');
    if (pos.row === 9 || pos.row === 10) continue; // footer rows checked separately below
    const key = `${pos.row}:${pos.col}`;
    assert.ok(!seen.has(key), `short form collision at ${key} (${el.symbol})`);
    seen.add(key);
  }
});

test('main-grid iupac-form positions have no collisions', () => {
  const seen = new Set<string>();
  for (const el of elements) {
    const pos = getCellPosition(el, 'iupac');
    if (pos.row === 9 || pos.row === 10) continue;
    const key = `${pos.row}:${pos.col}`;
    assert.ok(!seen.has(key), `iupac form collision at ${key} (${el.symbol})`);
    seen.add(key);
  }
});

test('lanthanide footer row (9) has exactly 14 unique columns, both forms agree', () => {
  const lnFooter = elements.filter((e) => e.isLanthanide && e.atomicNumber !== 57);
  const shortCols = new Set(lnFooter.map((e) => getCellPosition(e, 'short').col));
  const iupacCols = new Set(lnFooter.map((e) => getCellPosition(e, 'iupac').col));
  assert.equal(shortCols.size, 14);
  assert.equal(iupacCols.size, 14);
  assert.deepEqual([...shortCols].sort(), [...iupacCols].sort());
});

test('actinide footer row (10) has exactly 14 unique columns', () => {
  const acFooter = elements.filter((e) => e.isActinide && e.atomicNumber !== 89);
  const cols = new Set(acFooter.map((e) => getCellPosition(e, 'short').col));
  assert.equal(cols.size, 14);
});

test('formatGroupLabel renders roman numerals for short form and plain numbers for iupac', () => {
  assert.equal(formatGroupLabel(1, 'iupac'), '1');
  assert.equal(formatGroupLabel(1, 'short'), 'I');
  assert.equal(formatGroupLabel(11, 'short'), 'I'); // Cu/Ag/Au — traditional IB folds into column I
  assert.equal(formatGroupLabel(18, 'short'), 'VIII'); // noble gases — traditional group VIII/0
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd packages/player && node --experimental-strip-types --test src/periodictable/tableLayout.test.ts`
Expected: FAIL — `./tableLayout.ts` does not exist yet.

- [ ] **Step 3: Write `tableLayout.ts`**

```ts
// packages/player/src/periodictable/tableLayout.ts
// Раскладка ячеек обеих форм таблицы (FR-004) из ОДНОГО набора данных
// (спека, разд. 7) — различается только раскладка ячеек, не контент.
//
// Упрощение, принятое сознательно (спека, разд. 7 — «решить при
// реализации»), ИСПРАВЛЕНО по факту находки Задачи 5 (см. ledger плана,
// "Task 5: implementer found a REAL plan defect"): первая версия этого
// файла пыталась схлопнуть главную и побочную подгруппу в один физический
// столбец сетки (напр. группа 1 и группа 11 — в один столбец). Это ломается
// структурно, а не из-за данных: период 4 одновременно содержит элемент
// главной подгруппы (K, группа 1) И элемент побочной подгруппы (Cu, группа
// 11) — они физически не могут занимать одну ячейку сетки. То же самое verno
// для КАЖДОЙ из 8 колонок, не только «VIII» (Fe/Co/Ni/Kr). Классическая
// бумажная короткая форма решает это раздвоением строки периода на два
// под-ряда — сознательно вне рамок (см. упрощение выше). Правильное
// решение, не ломающее позиционирование: короткая и IUPAC формы используют
// ОДНУ И ТУ ЖЕ 18-колоночную сетку (col = groupIupac напрямую, без
// схлопывания) — коллизии невозможны по построению, та же гарантия, что уже
// работает для формы IUPAC. Разница между формами — ТОЛЬКО в подписи
// колонки (`formatGroupLabel`): короткая форма показывает аутентичную
// римскую цифру по Менделееву (группы 1 и 11 обе подписаны «I», просто в
// двух соседних физических столбцах, а не в одном схлопнутом) — то есть
// визуально узнаваемый стиль сохраняется, просто не пытается физически
// объединить колонки.

import type { PeriodicElement } from './model/schema.ts';
import { isFooterElement } from './model/schema.ts';

export type TableForm = 'short' | 'iupac';

export interface CellPosition {
  row: number; // 1-7 основная сетка; 9 = подвал лантаноидов; 10 = подвал актиноидов
  col: number; // 1-18 в основной сетке (ОБЕ формы — см. комментарий выше); 2-15 в строках подвала
}

// Групп IUPAC (1-18) → традиционная короткая римская ПОДПИСЬ (не физическая
// колонка — только для formatGroupLabel). Стандартное соответствие
// классической 8-группной формы: 1,11→I; 2,12→II; 3,13→III; 4,14→IV;
// 5,15→V; 6,16→VI; 7,17→VII; 8,9,10,18→VIII.
const IUPAC_TO_SHORT_LABEL_INDEX: Record<number, number> = {
  1: 1, 11: 1,
  2: 2, 12: 2,
  3: 3, 13: 3,
  4: 4, 14: 4,
  5: 5, 15: 5,
  6: 6, 16: 6,
  7: 7, 17: 7,
  8: 8, 9: 8, 10: 8, 18: 8,
};

const ROMAN_BY_SHORT_LABEL_INDEX = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

export function getCellPosition(el: PeriodicElement, form: TableForm): CellPosition {
  if (el.isLanthanide && el.atomicNumber !== 57) {
    return { row: 9, col: el.atomicNumber - 58 + 2 }; // Ce(58)->2 .. Lu(71)->15
  }
  if (el.isActinide && el.atomicNumber !== 89) {
    return { row: 10, col: el.atomicNumber - 90 + 2 }; // Th(90)->2 .. Lr(103)->15
  }
  if (el.groupIupac === null) {
    throw new Error(`${el.symbol} (${el.atomicNumber}): missing groupIupac for a main-grid element`);
  }
  // ВАЖНО: col = groupIupac для ОБЕИХ форм — короткая форма НЕ схлопывает
  // колонки (см. комментарий в шапке файла). `form` здесь намеренно не
  // используется для позиционирования, только formatGroupLabel ниже
  // зависит от form.
  return { row: el.period, col: el.groupIupac };
}

export function formatGroupLabel(groupIupac: number, form: TableForm): string {
  if (form === 'iupac') return String(groupIupac);
  return ROMAN_BY_SHORT_LABEL_INDEX[IUPAC_TO_SHORT_LABEL_INDEX[groupIupac]];
}

export { isFooterElement };
```

- [ ] **Step 4: Run the test again to confirm it passes**

Run: `cd packages/player && node --experimental-strip-types --test src/periodictable/tableLayout.test.ts`
Expected: PASS, all 5 tests green. (This depends on Task 4's `elements.json` being complete and consistent — if it fails here, the failure is almost certainly a content bug in Task 4's data, not this file; fix the data, not the layout logic.)

- [ ] **Step 5: Commit**

```bash
git add packages/player/src/periodictable/tableLayout.ts packages/player/src/periodictable/tableLayout.test.ts
git commit -m "feat(periodictable): add short/IUPAC table layout with collision tests"
git push
```

---

### Task 6: Table screen (rendering + navigation)

**Files:**
- Create: `packages/player/src/periodictable/viewTypes.ts`
- Create: `packages/player/src/periodictable/screens/TableScreen.tsx`
- Modify: `packages/player/src/periodictable/PeriodicTableRuntime.tsx`

**Interfaces:**
- Consumes: `PeriodicElement`, `PeriodicTableContentSchema` (Task 2); `elements.json` (Task 4); `getCellPosition`, `formatGroupLabel`, `TableForm` (Task 5); `ViewSettings`, `loadViewSettings` (Task 9, but Task 6 can proceed with an inline default and Task 9 wires the real storage — see Step 3 note).
- Produces: `viewTypes.ts` — `ColorIndicationSchema`/`type ColorIndicationMode`, `HighlightModeSchema`/`type HighlightMode`. **This is the single source of truth for these two types** — Task 9's `viewSettingsStorage.ts` imports the zod schemas from here instead of redeclaring them, and Task 10's `LegendTab.tsx` imports `ColorIndicationMode` from here, not from `TableScreen.tsx`. Declaring these twice (once as a plain TS union, once as a separately-typed zod enum) is exactly the kind of drift the plan's own Type Consistency check exists to catch — don't reintroduce it in a later task.
- Produces: `TableScreen` component with props `{ elements: PeriodicElement[]; form: TableForm; colorIndication: ColorIndicationMode; highlight: HighlightMode; onSelectElement: (el: PeriodicElement) => void }` — Task 7 (cards) and Task 8 (search highlight) both render on top of / alongside this.

- [ ] **Step 1: Write `viewTypes.ts`, then `TableScreen.tsx`**

```ts
// packages/player/src/periodictable/viewTypes.ts
// Единственный источник типов режима отображения (цветовая индикация/
// подсветка) — TableScreen.tsx (рендер), ViewSettingsTab.tsx (выбор),
// LegendTab.tsx (расшифровка, Задача 10) и viewSettingsStorage.ts
// (валидация при хранении, Задача 9) ссылаются СЮДА, а не заводят
// параллельные копии одного и того же набора строковых литералов.

import { z } from 'zod';

export const ColorIndicationSchema = z.enum(['none', 'class', 'electronType', 'oxideCharacter']);
export type ColorIndicationMode = z.infer<typeof ColorIndicationSchema>;

export const HighlightModeSchema = z.enum(['none', 'metal', 'nonmetal', 'metalloid', 's', 'p', 'd', 'f', 'acidic', 'basic', 'amphoteric']);
export type HighlightMode = z.infer<typeof HighlightModeSchema>;
```

```tsx
// packages/player/src/periodictable/screens/TableScreen.tsx
import React from 'react';
import type { PeriodicElement } from '../model/schema.ts';
import { getCellPosition, formatGroupLabel, type TableForm } from '../tableLayout.ts';
import type { ColorIndicationMode, HighlightMode } from '../viewTypes.ts';

interface Props {
  elements: PeriodicElement[];
  form: TableForm;
  colorIndication: ColorIndicationMode;
  highlight: HighlightMode;
  highlightedSymbol?: string | null; // подсветка найденного элемента (Задача 8, Поиск)
  onSelectElement: (el: PeriodicElement) => void;
}

const CLASS_COLOR: Record<string, string> = { metal: '#e3f2fd', metalloid: '#fff3e0', nonmetal: '#e8f5e9' };
const ELECTRON_TYPE_COLOR: Record<string, string> = { s: '#ffebee', p: '#e8f5e9', d: '#e3f2fd', f: '#f3e5f5' };
const OXIDE_COLOR: Record<string, string> = { acidic: '#ffebee', basic: '#e3f2fd', amphoteric: '#fff3e0', none: '#f5f5f5' };

function cellBackground(el: PeriodicElement, mode: ColorIndicationMode): string {
  if (mode === 'class') return CLASS_COLOR[el.elementClass];
  if (mode === 'electronType') return ELECTRON_TYPE_COLOR[el.electronType];
  if (mode === 'oxideCharacter') return OXIDE_COLOR[el.oxideCharacter];
  return '#ffffff';
}

function isHighlighted(el: PeriodicElement, highlight: HighlightMode): boolean {
  if (highlight === 'none') return false;
  if (highlight === 'metal' || highlight === 'nonmetal' || highlight === 'metalloid') return el.elementClass === highlight;
  if (highlight === 's' || highlight === 'p' || highlight === 'd' || highlight === 'f') return el.electronType === highlight;
  return el.oxideCharacter === highlight;
}

const TableScreen: React.FC<Props> = ({ elements, form, colorIndication, highlight, highlightedSymbol, onSelectElement }) => {
  // 18 колонок для ОБЕИХ форм — короткая форма не схлопывает колонки
  // (см. tableLayout.ts, исправлено по находке Задачи 5), различается
  // только подпись колонки через formatGroupLabel в самой ячейке.
  const maxCol = 18;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${maxCol}, 1fr)`, gap: 2, padding: 8, touchAction: 'manipulation' }}>
      {elements.map((el) => {
        const pos = getCellPosition(el, form);
        const highlighted = isHighlighted(el, highlight) || el.symbol === highlightedSymbol;
        return (
          <button
            key={el.atomicNumber}
            onClick={() => onSelectElement(el)}
            style={{
              gridRow: pos.row,
              gridColumn: pos.col,
              background: cellBackground(el, colorIndication),
              border: highlighted ? '3px solid #d32f2f' : '1px solid #ccc',
              borderRadius: 4,
              padding: 4,
              minHeight: 56,
              minWidth: 56,
              cursor: 'pointer',
              fontFamily: 'sans-serif',
            }}
            title={`${el.nameRu} — группа ${formatGroupLabel(el.groupIupac ?? 1, form)}`}
          >
            <div style={{ fontSize: 11, textAlign: 'left' }}>{el.atomicNumber}</div>
            <div style={{ fontSize: 18, fontWeight: 'bold' }}>{el.symbol}</div>
            <div style={{ fontSize: 9 }}>{el.nameRu}</div>
          </button>
        );
      })}
    </div>
  );
};

export default TableScreen;
```

- [ ] **Step 2: Wire `TableScreen` into `PeriodicTableRuntime.tsx`**

Replace the placeholder body from Task 1 Step 4 with real orchestration. This intermediate version wires the table and a bare card modal; Task 7 fleshes out the card content, Task 8/9/10 add the tab bar. Keep the component/prop names exactly as declared so later tasks only ADD to this file, not restructure it.

```tsx
// packages/player/src/periodictable/PeriodicTableRuntime.tsx
import React, { useState } from 'react';
import type { PeriodicTableWidgetProperties } from '@kiosk/shared';
import { PeriodicTableContentSchema, type PeriodicElement } from './model/schema.ts';
import TableScreen from './screens/TableScreen.tsx';
import type { ColorIndicationMode, HighlightMode } from './viewTypes.ts';
import type { TableForm } from './tableLayout.ts';
import elementsJson from './content/elements.json' with { type: 'json' };

interface Props {
  properties: PeriodicTableWidgetProperties;
}

const { elements } = PeriodicTableContentSchema.parse(elementsJson);

const PeriodicTableRuntime: React.FC<Props> = () => {
  const [form, setForm] = useState<TableForm>('short');
  const [colorIndication, setColorIndication] = useState<ColorIndicationMode>('class');
  const [highlight, setHighlight] = useState<HighlightMode>('none');
  const [selected, setSelected] = useState<PeriodicElement | null>(null);

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto', fontFamily: 'sans-serif' }}>
      <TableScreen
        elements={elements}
        form={form}
        colorIndication={colorIndication}
        highlight={highlight}
        onSelectElement={setSelected}
      />
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', padding: 24, borderRadius: 8, maxWidth: 480 }}>
            <h2>{selected.nameRu} ({selected.symbol})</h2>
            <p>№ {selected.atomicNumber}, масса {selected.atomicMass}</p>
            <button onClick={() => setSelected(null)}>Закрыть</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PeriodicTableRuntime;
```

- [ ] **Step 3: Type-check and run existing tests**

Run: `cd packages/player && npx tsc --noEmit && npm test`
Expected: PASS. (There's no dedicated `.test.tsx` for `TableScreen` in this task — visual rendering correctness is verified live in Step 4, per playbook §5: UI/integration needs live verification, not just tests. The layout MATH is already unit-tested in Task 5.)

- [ ] **Step 4: Live check — both forms render without collisions or overflow**

Via CDP (playbook §5 procedure): load the widget, confirm the short-period grid renders 118 buttons with no visual overlap, click an element, confirm the modal opens with its name/number/mass. This is the scenario most likely to reveal a layout bug Task 5's math tests can't catch (e.g. CSS grid `gridRow`/`gridColumn` off-by-one, footer rows overlapping row 7 visually) — target this specific scenario, not "any button works" (Тип6 retrospective §4 lesson: live checks must hit the scenario that could actually be broken).

- [ ] **Step 5: Commit**

```bash
git add packages/player/src/periodictable/viewTypes.ts packages/player/src/periodictable/screens/TableScreen.tsx packages/player/src/periodictable/PeriodicTableRuntime.tsx
git commit -m "feat(periodictable): render table screen with element selection"
git push
```

---

### Task 7: Element cards (summary + detail)

**Files:**
- Create: `packages/player/src/periodictable/screens/ElementSummaryCard.tsx`
- Create: `packages/player/src/periodictable/screens/ElementDetailCard.tsx`
- Modify: `packages/player/src/periodictable/PeriodicTableRuntime.tsx`

**Interfaces:**
- Consumes: `PeriodicElement` (Task 2).
- Produces: `ElementSummaryCard` (props `{ element: PeriodicElement; onMoreDetails: () => void; onClose: () => void }`), `ElementDetailCard` (props `{ element: PeriodicElement; onClose: () => void }`).

- [ ] **Step 1: Write `ElementSummaryCard.tsx`**

```tsx
// packages/player/src/periodictable/screens/ElementSummaryCard.tsx
import React from 'react';
import type { PeriodicElement } from '../model/schema.ts';

interface Props {
  element: PeriodicElement;
  onMoreDetails: () => void;
  onClose: () => void;
}

const ElementSummaryCard: React.FC<Props> = ({ element, onMoreDetails, onClose }) => (
  <div style={{ background: '#fff', padding: 24, borderRadius: 8, maxWidth: 480 }}>
    <h2>{element.nameRu} ({element.nameLatin}) — {element.symbol}</h2>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <tbody>
        <tr><td>Номер</td><td>{element.atomicNumber}</td></tr>
        <tr><td>Атомная масса</td><td>{element.atomicMass}</td></tr>
        <tr><td>Период / группа</td><td>{element.period} / {element.groupIupac ?? '—'}</td></tr>
        <tr><td>Электронная конфигурация</td><td>{element.electronConfiguration}</td></tr>
        <tr><td>Электронный тип</td><td>{element.electronType}</td></tr>
      </tbody>
    </table>
    <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
      <button onClick={onMoreDetails}>Подробнее</button>
      <button onClick={onClose}>Закрыть</button>
    </div>
  </div>
);

export default ElementSummaryCard;
```

- [ ] **Step 2: Write `ElementDetailCard.tsx`**

All 18 FR-005 characteristics, in the exact order listed in the ТЗ (spec §4), plus the photo where available.

```tsx
// packages/player/src/periodictable/screens/ElementDetailCard.tsx
import React from 'react';
import type { PeriodicElement } from '../model/schema.ts';

interface Props {
  element: PeriodicElement;
  onClose: () => void;
}

const ROW: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <tr><td style={{ fontWeight: 'bold', paddingRight: 12, verticalAlign: 'top' }}>{label}</td><td>{value ?? '—'}</td></tr>
);

const ElementDetailCard: React.FC<Props> = ({ element, onClose }) => (
  <div style={{ background: '#fff', padding: 24, borderRadius: 8, maxWidth: 640, maxHeight: '80vh', overflow: 'auto' }}>
    <h2>{element.nameRu} ({element.symbol})</h2>
    {element.photo && (
      <img
        src={`./periodictable/photos/${element.photo.fileName}`}
        alt={`Образец: ${element.nameRu}`}
        style={{ maxWidth: 200, display: 'block', marginBottom: 12 }}
      />
    )}
    <table style={{ borderCollapse: 'collapse' }}>
      <tbody>
        <ROW label="Символ элемента" value={element.symbol} />
        <ROW label="Номер элемента" value={element.atomicNumber} />
        <ROW label="Относительная атомная масса" value={element.atomicMass} />
        <ROW label="Название на русском" value={element.nameRu} />
        <ROW label="Название на латыни" value={element.nameLatin} />
        <ROW label="Электронный тип" value={element.electronType} />
        <ROW label="Нахождение в природе" value={element.naturalOccurrence} />
        <ROW label="Агрегатное состояние при н.у." value={element.physicalStateNormal} />
        <ROW label="Тип кристаллической решётки" value={element.crystalLattice} />
        <ROW label="Аллотропные модификации" value={element.allotropes || '—'} />
        <ROW label="Стабильные изотопы" value={element.stableIsotopes || '—'} />
        <ROW label="Положение в ряду электрохимического напряжения" value={element.electrochemicalSeriesPosition} />
        <ROW label="Характер оксидов и гидроксидов" value={element.oxideCharacter} />
        <ROW label="Плотность (г/см³)" value={element.density} />
        <ROW label="Температура плавления (К)" value={element.meltingPointK} />
        <ROW label="Температура кипения (К)" value={element.boilingPointK} />
        <ROW label="Характерные степени окисления" value={element.oxidationStates} />
        <ROW label="Электроотрицательность по Полингу" value={element.electronegativityPauling} />
      </tbody>
    </table>
    <button onClick={onClose} style={{ marginTop: 16 }}>Закрыть</button>
  </div>
);

export default ElementDetailCard;
```

- [ ] **Step 3: Replace the inline modal in `PeriodicTableRuntime.tsx` with the two real cards**

```tsx
// packages/player/src/periodictable/PeriodicTableRuntime.tsx
import React, { useState } from 'react';
import type { PeriodicTableWidgetProperties } from '@kiosk/shared';
import { PeriodicTableContentSchema, type PeriodicElement } from './model/schema.ts';
import TableScreen from './screens/TableScreen.tsx';
import type { ColorIndicationMode, HighlightMode } from './viewTypes.ts';
import ElementSummaryCard from './screens/ElementSummaryCard.tsx';
import ElementDetailCard from './screens/ElementDetailCard.tsx';
import type { TableForm } from './tableLayout.ts';
import elementsJson from './content/elements.json' with { type: 'json' };

interface Props {
  properties: PeriodicTableWidgetProperties;
}

const { elements } = PeriodicTableContentSchema.parse(elementsJson);

type CardMode = 'none' | 'summary' | 'detail';

const PeriodicTableRuntime: React.FC<Props> = () => {
  const [form, setForm] = useState<TableForm>('short');
  const [colorIndication, setColorIndication] = useState<ColorIndicationMode>('class');
  const [highlight, setHighlight] = useState<HighlightMode>('none');
  const [selected, setSelected] = useState<PeriodicElement | null>(null);
  const [cardMode, setCardMode] = useState<CardMode>('none');

  function selectElement(el: PeriodicElement) {
    setSelected(el);
    setCardMode('summary');
  }

  function closeCard() {
    setCardMode('none');
    setSelected(null);
  }

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto', fontFamily: 'sans-serif' }}>
      <TableScreen
        elements={elements}
        form={form}
        colorIndication={colorIndication}
        highlight={highlight}
        onSelectElement={selectElement}
      />
      {selected && cardMode !== 'none' && (
        <div
          onClick={closeCard}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div onClick={(e) => e.stopPropagation()}>
            {cardMode === 'summary' && (
              <ElementSummaryCard element={selected} onMoreDetails={() => setCardMode('detail')} onClose={closeCard} />
            )}
            {cardMode === 'detail' && <ElementDetailCard element={selected} onClose={closeCard} />}
          </div>
        </div>
      )}
    </div>
  );
};

export default PeriodicTableRuntime;
```

- [ ] **Step 4: Type-check**

Run: `cd packages/player && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Live check — full card flow**

Via CDP: click an element → summary card shows name/number/mass/period/group/config/electron-type → click «Подробнее» → detail card shows all 18 labeled rows with real (non-`—`, except where chemistry genuinely has no value, e.g. oganesson's melting point) data → close returns to the table. Specifically verify at least one metal (electrochemical series position populated), one footer lanthanide/actinide, and oganesson (many nulls, all correctly rendered as «—», not `undefined`/`NaN`/a crash).

- [ ] **Step 6: Commit**

```bash
git add packages/player/src/periodictable/screens/ElementSummaryCard.tsx packages/player/src/periodictable/screens/ElementDetailCard.tsx packages/player/src/periodictable/PeriodicTableRuntime.tsx
git commit -m "feat(periodictable): add summary and detail element cards (all 18 FR-005 fields)"
git push
```

---

### Task 8: Search tab

**Files:**
- Create: `packages/player/src/periodictable/search.ts`
- Create: `packages/player/src/periodictable/search.test.ts`
- Create: `packages/player/src/periodictable/screens/SearchTab.tsx`
- Modify: `packages/player/src/periodictable/PeriodicTableRuntime.tsx`

**Interfaces:**
- Consumes: `PeriodicElement` (Task 2).
- Produces: `function searchElements(elements: PeriodicElement[], query: string): PeriodicElement[]`; `SearchTab` component (props `{ elements: PeriodicElement[]; onSelectElement: (el: PeriodicElement) => void; onHighlightChange: (symbol: string | null) => void }`) — Task 6's `TableScreen` already accepts `highlightedSymbol`, this task is what feeds it.

- [ ] **Step 1: Write the failing test**

```ts
// packages/player/src/periodictable/search.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchElements } from './search.ts';
import { PeriodicTableContentSchema } from './model/schema.ts';
import elementsJson from './content/elements.json' with { type: 'json' };

const { elements } = PeriodicTableContentSchema.parse(elementsJson);

test('empty query returns no results', () => {
  assert.deepEqual(searchElements(elements, ''), []);
  assert.deepEqual(searchElements(elements, '   '), []);
});

test('search by Russian name is case-insensitive and matches substrings', () => {
  const results = searchElements(elements, 'желез');
  assert.ok(results.some((e) => e.symbol === 'Fe'));
});

test('search by exact symbol matches, but does not substring-match unrelated names', () => {
  const results = searchElements(elements, 'Fe');
  assert.ok(results.some((e) => e.symbol === 'Fe'));
});

test('search by atomic number matches exactly', () => {
  const results = searchElements(elements, '26');
  assert.ok(results.some((e) => e.atomicNumber === 26));
  assert.ok(results.every((e) => String(e.atomicNumber) === '26' || String(e.atomicMass).startsWith('26')));
});

test('search by Latin name works', () => {
  const results = searchElements(elements, 'ferrum');
  assert.ok(results.some((e) => e.symbol === 'Fe'));
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd packages/player && node --experimental-strip-types --test src/periodictable/search.test.ts`
Expected: FAIL — `./search.ts` does not exist yet.

- [ ] **Step 3: Write `search.ts`**

```ts
// packages/player/src/periodictable/search.ts
// Поиск по названию/номеру/символу/массе (вкладка «Поиск», раздел 2 спеки).
// Без защиты PIN — справочная функция, не требует блокировки (спека, разд. 5).

import type { PeriodicElement } from './model/schema.ts';

export function searchElements(elements: PeriodicElement[], query: string): PeriodicElement[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return elements.filter((el) =>
    el.nameRu.toLowerCase().includes(q) ||
    el.nameLatin.toLowerCase().includes(q) ||
    el.symbol.toLowerCase() === q ||
    String(el.atomicNumber) === q ||
    String(el.atomicMass).startsWith(q)
  );
}
```

- [ ] **Step 4: Run the test again to confirm it passes**

Run: `cd packages/player && node --experimental-strip-types --test src/periodictable/search.test.ts`
Expected: PASS, all 5 tests green.

- [ ] **Step 5: Write `SearchTab.tsx`**

```tsx
// packages/player/src/periodictable/screens/SearchTab.tsx
import React, { useState } from 'react';
import type { PeriodicElement } from '../model/schema.ts';
import { searchElements } from '../search.ts';

interface Props {
  elements: PeriodicElement[];
  onSelectElement: (el: PeriodicElement) => void;
  onHighlightChange: (symbol: string | null) => void;
}

const SearchTab: React.FC<Props> = ({ elements, onSelectElement, onHighlightChange }) => {
  const [query, setQuery] = useState('');
  const results = searchElements(elements, query);

  function handleChange(value: string) {
    setQuery(value);
    const found = searchElements(elements, value);
    onHighlightChange(found.length === 1 ? found[0].symbol : null);
  }

  return (
    <div style={{ padding: 16 }}>
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Название, номер, символ или масса"
        style={{ fontSize: 18, padding: 8, width: '100%', boxSizing: 'border-box' }}
      />
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {results.map((el) => (
          <li key={el.atomicNumber}>
            <button onClick={() => onSelectElement(el)} style={{ width: '100%', textAlign: 'left', padding: 8 }}>
              № {el.atomicNumber} — {el.nameRu} ({el.symbol})
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SearchTab;
```

- [ ] **Step 6: Wire a tab bar into `PeriodicTableRuntime.tsx`**

This step introduces the tab-bar structure that Tasks 9 and 10 extend — add all three tab buttons now (Search wired, View Settings/Legend as inert placeholders Task 9/10 will fill in), so this is the only task that touches the tab-bar's structural shape.

```tsx
// packages/player/src/periodictable/PeriodicTableRuntime.tsx
import React, { useState } from 'react';
import type { PeriodicTableWidgetProperties } from '@kiosk/shared';
import { PeriodicTableContentSchema, type PeriodicElement } from './model/schema.ts';
import TableScreen from './screens/TableScreen.tsx';
import type { ColorIndicationMode, HighlightMode } from './viewTypes.ts';
import ElementSummaryCard from './screens/ElementSummaryCard.tsx';
import ElementDetailCard from './screens/ElementDetailCard.tsx';
import SearchTab from './screens/SearchTab.tsx';
import type { TableForm } from './tableLayout.ts';
import elementsJson from './content/elements.json' with { type: 'json' };

interface Props {
  properties: PeriodicTableWidgetProperties;
}

const { elements } = PeriodicTableContentSchema.parse(elementsJson);

type CardMode = 'none' | 'summary' | 'detail';
type BottomTab = 'none' | 'search' | 'viewSettings' | 'legend';

const PeriodicTableRuntime: React.FC<Props> = ({ properties }) => {
  const [form, setForm] = useState<TableForm>('short');
  const [colorIndication, setColorIndication] = useState<ColorIndicationMode>('class');
  const [highlight, setHighlight] = useState<HighlightMode>('none');
  const [selected, setSelected] = useState<PeriodicElement | null>(null);
  const [cardMode, setCardMode] = useState<CardMode>('none');
  const [activeTab, setActiveTab] = useState<BottomTab>('none');
  const [highlightedSymbol, setHighlightedSymbol] = useState<string | null>(null);

  function selectElement(el: PeriodicElement) {
    setSelected(el);
    setCardMode('summary');
  }

  function closeCard() {
    setCardMode('none');
    setSelected(null);
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <TableScreen
          elements={elements}
          form={form}
          colorIndication={colorIndication}
          highlight={highlight}
          highlightedSymbol={highlightedSymbol}
          onSelectElement={selectElement}
        />
      </div>

      <div style={{ display: 'flex', borderTop: '1px solid #ccc' }}>
        <button onClick={() => setActiveTab(activeTab === 'search' ? 'none' : 'search')} style={{ flex: 1, padding: 12 }}>Поиск</button>
        <button onClick={() => setActiveTab(activeTab === 'viewSettings' ? 'none' : 'viewSettings')} style={{ flex: 1, padding: 12 }}>Настройки вида</button>
        <button onClick={() => setActiveTab(activeTab === 'legend' ? 'none' : 'legend')} style={{ flex: 1, padding: 12 }}>Легенда</button>
      </div>

      {activeTab === 'search' && (
        <div style={{ maxHeight: '40vh', overflow: 'auto', borderTop: '1px solid #ccc' }}>
          <SearchTab elements={elements} onSelectElement={selectElement} onHighlightChange={setHighlightedSymbol} />
        </div>
      )}
      {/* activeTab === 'viewSettings' — заполняется Задачей 9 */}
      {/* activeTab === 'legend' — заполняется Задачей 10 */}

      {selected && cardMode !== 'none' && (
        <div
          onClick={closeCard}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div onClick={(e) => e.stopPropagation()}>
            {cardMode === 'summary' && (
              <ElementSummaryCard element={selected} onMoreDetails={() => setCardMode('detail')} onClose={closeCard} />
            )}
            {cardMode === 'detail' && <ElementDetailCard element={selected} onClose={closeCard} />}
          </div>
        </div>
      )}
    </div>
  );
};

export default PeriodicTableRuntime;
```

- [ ] **Step 7: Register the new test file in `package.json`**

`src/periodictable/*.test.ts` was already added to the glob in Task 1 Step 8 — confirm `search.test.ts` is picked up:

Run: `cd packages/player && npm test 2>&1 | grep -i search`
Expected: search tests appear in the output and pass.

- [ ] **Step 8: Type-check**

Run: `cd packages/player && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 9: Live check — search highlights and opens the right element**

Via CDP: type a partial Russian name (e.g. "жел") into the search box, confirm results list narrows to iron, click it, confirm both that the summary card opens for iron AND that closing the card leaves the table with iron's cell outlined (the `highlightedSymbol` prop threading). Also test a query matching multiple elements (e.g. a common substring) and confirm the list shows all matches, not just the first.

- [ ] **Step 10: Commit**

```bash
git add packages/player/src/periodictable/search.ts packages/player/src/periodictable/search.test.ts packages/player/src/periodictable/screens/SearchTab.tsx packages/player/src/periodictable/PeriodicTableRuntime.tsx
git commit -m "feat(periodictable): add search tab with table highlight"
git push
```

---

### Task 9: View settings tab + teacher PIN

**Files:**
- Create: `packages/player/src/periodictable/viewSettingsStorage.ts`
- Create: `packages/player/src/periodictable/viewSettingsStorage.test.ts`
- Create: `packages/player/src/periodictable/screens/TeacherPinModal.tsx`
- Create: `packages/player/src/periodictable/screens/ViewSettingsTab.tsx`
- Modify: `packages/player/src/periodictable/PeriodicTableRuntime.tsx`

**Interfaces:**
- Consumes: `TableForm` (Task 5); `ColorIndicationSchema`, `HighlightModeSchema` (Task 6, `viewTypes.ts` — imported directly, not redeclared, per that task's note); `PeriodicTableWidgetProperties.teacherPin` (Task 1).
- Produces: `type ViewSettings`, `DEFAULT_VIEW_SETTINGS`, `loadViewSettings()`, `saveViewSettings()`; `TeacherPinModal` (props `{ expectedPin: string; onSuccess: () => void; onCancel: () => void }`); `ViewSettingsTab` (props `{ settings: ViewSettings; onChange: (s: ViewSettings) => void }`).

- [ ] **Step 1: Write the failing storage test**

```ts
// packages/player/src/periodictable/viewSettingsStorage.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadViewSettings, saveViewSettings, DEFAULT_VIEW_SETTINGS } from './viewSettingsStorage.ts';

test('loadViewSettings returns the default when window/localStorage is unavailable (Node test environment)', () => {
  assert.deepEqual(loadViewSettings(), DEFAULT_VIEW_SETTINGS);
});

test('saveViewSettings does not throw when window/localStorage is unavailable', () => {
  assert.doesNotThrow(() => saveViewSettings({ tableForm: 'iupac', colorIndication: 'none', highlight: 'metal' }));
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd packages/player && node --experimental-strip-types --test src/periodictable/viewSettingsStorage.test.ts`
Expected: FAIL — `./viewSettingsStorage.ts` does not exist yet.

- [ ] **Step 3: Write `viewSettingsStorage.ts`**

```ts
// packages/player/src/periodictable/viewSettingsStorage.ts
// Последний выбранный вид (форма таблицы/индикация/подсветка) — чистое
// UI-удобство конкретного устройства, не пользовательский прогресс (спека,
// разд. 9: в отличие от rusiq/mathmachine здесь нет прогресс-данных вообще,
// поэтому localStorage без IPC достаточно — не через window.periodictableAPI).
//
// Guard по `typeof window` — тот же принцип, что userDataStorage.ts у
// rusiq/mathmachine использует для window.rusiqAPI/window.mathmachineAPI:
// в тестовой среде `node --test` глобального window/localStorage нет
// вообще, обращение к нему без проверки — ReferenceError, а не просто
// "undefined".

import { z } from 'zod';
import { ColorIndicationSchema, HighlightModeSchema } from './viewTypes.ts';

const STORAGE_KEY = 'periodictable.viewSettings.v1';

export const TableFormSchema = z.enum(['short', 'iupac']);
// ColorIndicationSchema/HighlightModeSchema imported from viewTypes.ts
// (Task 6) — do NOT redeclare them here, that was the exact duplication
// this plan's Type Consistency self-review caught and fixed before Task 9
// shipped. TableScreen.tsx's prop types and this file's ViewSettingsSchema
// now derive from the same single definition.

export const ViewSettingsSchema = z.object({
  tableForm: TableFormSchema,
  colorIndication: ColorIndicationSchema,
  highlight: HighlightModeSchema,
});
export type ViewSettings = z.infer<typeof ViewSettingsSchema>;

export const DEFAULT_VIEW_SETTINGS: ViewSettings = {
  tableForm: 'short',
  colorIndication: 'class',
  highlight: 'none',
};

function hasLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function loadViewSettings(): ViewSettings {
  if (!hasLocalStorage()) return DEFAULT_VIEW_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_VIEW_SETTINGS;
    const parsed = ViewSettingsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_VIEW_SETTINGS;
  } catch {
    return DEFAULT_VIEW_SETTINGS;
  }
}

export function saveViewSettings(settings: ViewSettings): void {
  if (!hasLocalStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Приватный режим/квота — не критично, следующая попытка запишет снова.
  }
}
```

- [ ] **Step 4: Run the test again to confirm it passes**

Run: `cd packages/player && node --experimental-strip-types --test src/periodictable/viewSettingsStorage.test.ts`
Expected: PASS, both tests green.

- [ ] **Step 5: Write `TeacherPinModal.tsx`**

```tsx
// packages/player/src/periodictable/screens/TeacherPinModal.tsx
import React, { useState } from 'react';

interface Props {
  expectedPin: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const TeacherPinModal: React.FC<Props> = ({ expectedPin, onSuccess, onCancel }) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);

  function handleSubmit() {
    if (value === expectedPin) {
      onSuccess();
    } else {
      setError(true);
    }
  }

  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', padding: 24, borderRadius: 8 }}>
        <h3>PIN учителя</h3>
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={value}
          onChange={(e) => { setValue(e.target.value.replace(/\D/g, '').slice(0, 4)); setError(false); }}
          style={{ fontSize: 24, padding: 8, width: 120, textAlign: 'center' }}
        />
        {error && <p style={{ color: '#d32f2f' }}>Неверный PIN</p>}
        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <button onClick={handleSubmit}>Подтвердить</button>
          <button onClick={onCancel}>Отмена</button>
        </div>
      </div>
    </div>
  );
};

export default TeacherPinModal;
```

- [ ] **Step 6: Write `ViewSettingsTab.tsx`**

```tsx
// packages/player/src/periodictable/screens/ViewSettingsTab.tsx
import React from 'react';
import type { ViewSettings } from '../viewSettingsStorage.ts';

interface Props {
  settings: ViewSettings;
  onChange: (s: ViewSettings) => void;
}

const ViewSettingsTab: React.FC<Props> = ({ settings, onChange }) => (
  <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div>
      <label>Форма таблицы: </label>
      <select value={settings.tableForm} onChange={(e) => onChange({ ...settings, tableForm: e.target.value as ViewSettings['tableForm'] })}>
        <option value="short">Короткопериодная</option>
        <option value="iupac">Длиннопериодная (IUPAC)</option>
      </select>
    </div>
    <div>
      <label>Цветовая индикация: </label>
      <select value={settings.colorIndication} onChange={(e) => onChange({ ...settings, colorIndication: e.target.value as ViewSettings['colorIndication'] })}>
        <option value="none">Отсутствует</option>
        <option value="class">Классы элементов</option>
        <option value="electronType">Электронный тип</option>
        <option value="oxideCharacter">Характер оксидов и гидроксидов</option>
      </select>
    </div>
    <div>
      <label>Подсветка: </label>
      <select value={settings.highlight} onChange={(e) => onChange({ ...settings, highlight: e.target.value as ViewSettings['highlight'] })}>
        <option value="none">Нет</option>
        <option value="metal">Металлы</option>
        <option value="nonmetal">Неметаллы</option>
        <option value="metalloid">Металлоиды</option>
        <option value="s">s-элементы</option>
        <option value="p">p-элементы</option>
        <option value="d">d-элементы</option>
        <option value="f">f-элементы</option>
        <option value="acidic">Кислотный характер оксидов</option>
        <option value="basic">Основной характер оксидов</option>
        <option value="amphoteric">Амфотерный характер оксидов</option>
      </select>
    </div>
  </div>
);

export default ViewSettingsTab;
```

- [ ] **Step 7: Wire PIN gating + the real tab into `PeriodicTableRuntime.tsx`**

Replace the `viewSettings`/`highlight`/`colorIndication`/`form` local `useState`s with a single `ViewSettings` state loaded from storage, and gate the "Настройки вида" tab behind `TeacherPinModal`.

```tsx
// packages/player/src/periodictable/PeriodicTableRuntime.tsx
import React, { useEffect, useState } from 'react';
import type { PeriodicTableWidgetProperties } from '@kiosk/shared';
import { PeriodicTableContentSchema, type PeriodicElement } from './model/schema.ts';
import TableScreen from './screens/TableScreen.tsx';
import ElementSummaryCard from './screens/ElementSummaryCard.tsx';
import ElementDetailCard from './screens/ElementDetailCard.tsx';
import SearchTab from './screens/SearchTab.tsx';
import ViewSettingsTab from './screens/ViewSettingsTab.tsx';
import TeacherPinModal from './screens/TeacherPinModal.tsx';
import { loadViewSettings, saveViewSettings, DEFAULT_VIEW_SETTINGS, type ViewSettings } from './viewSettingsStorage.ts';
import elementsJson from './content/elements.json' with { type: 'json' };

interface Props {
  properties: PeriodicTableWidgetProperties;
}

const { elements } = PeriodicTableContentSchema.parse(elementsJson);

type CardMode = 'none' | 'summary' | 'detail';
type BottomTab = 'none' | 'search' | 'viewSettings' | 'legend';

const PeriodicTableRuntime: React.FC<Props> = ({ properties }) => {
  const [viewSettings, setViewSettings] = useState<ViewSettings>(DEFAULT_VIEW_SETTINGS);
  const [selected, setSelected] = useState<PeriodicElement | null>(null);
  const [cardMode, setCardMode] = useState<CardMode>('none');
  const [activeTab, setActiveTab] = useState<BottomTab>('none');
  const [highlightedSymbol, setHighlightedSymbol] = useState<string | null>(null);
  const [viewSettingsUnlocked, setViewSettingsUnlocked] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);

  useEffect(() => {
    setViewSettings(loadViewSettings());
  }, []);

  function updateViewSettings(next: ViewSettings) {
    setViewSettings(next);
    saveViewSettings(next);
  }

  function selectElement(el: PeriodicElement) {
    setSelected(el);
    setCardMode('summary');
  }

  function closeCard() {
    setCardMode('none');
    setSelected(null);
  }

  function handleViewSettingsTabClick() {
    if (activeTab === 'viewSettings') {
      setActiveTab('none');
      return;
    }
    const pin = properties.teacherPin ?? '0000';
    if (viewSettingsUnlocked || !pin) {
      setActiveTab('viewSettings');
    } else {
      setShowPinModal(true);
    }
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <TableScreen
          elements={elements}
          form={viewSettings.tableForm}
          colorIndication={viewSettings.colorIndication}
          highlight={viewSettings.highlight}
          highlightedSymbol={highlightedSymbol}
          onSelectElement={selectElement}
        />
      </div>

      <div style={{ display: 'flex', borderTop: '1px solid #ccc' }}>
        <button onClick={() => setActiveTab(activeTab === 'search' ? 'none' : 'search')} style={{ flex: 1, padding: 12 }}>Поиск</button>
        <button onClick={handleViewSettingsTabClick} style={{ flex: 1, padding: 12 }}>Настройки вида {!viewSettingsUnlocked ? '🔒' : ''}</button>
        <button onClick={() => setActiveTab(activeTab === 'legend' ? 'none' : 'legend')} style={{ flex: 1, padding: 12 }}>Легенда</button>
      </div>

      {activeTab === 'search' && (
        <div style={{ maxHeight: '40vh', overflow: 'auto', borderTop: '1px solid #ccc' }}>
          <SearchTab elements={elements} onSelectElement={selectElement} onHighlightChange={setHighlightedSymbol} />
        </div>
      )}
      {activeTab === 'viewSettings' && viewSettingsUnlocked && (
        <div style={{ maxHeight: '40vh', overflow: 'auto', borderTop: '1px solid #ccc' }}>
          <ViewSettingsTab settings={viewSettings} onChange={updateViewSettings} />
        </div>
      )}
      {/* activeTab === 'legend' — заполняется Задачей 10 */}

      {showPinModal && (
        <TeacherPinModal
          expectedPin={properties.teacherPin ?? '0000'}
          onSuccess={() => { setViewSettingsUnlocked(true); setShowPinModal(false); setActiveTab('viewSettings'); }}
          onCancel={() => setShowPinModal(false)}
        />
      )}

      {selected && cardMode !== 'none' && (
        <div
          onClick={closeCard}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div onClick={(e) => e.stopPropagation()}>
            {cardMode === 'summary' && (
              <ElementSummaryCard element={selected} onMoreDetails={() => setCardMode('detail')} onClose={closeCard} />
            )}
            {cardMode === 'detail' && <ElementDetailCard element={selected} onClose={closeCard} />}
          </div>
        </div>
      )}
    </div>
  );
};

export default PeriodicTableRuntime;
```

Note: `viewSettingsUnlocked` stays `true` for the rest of the current player session once entered correctly (matches spec §5 — "не требует повторного ввода до перезапуска приложения"), not re-checked per click.

- [ ] **Step 8: Type-check**

Run: `cd packages/player && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 9: Live check — PIN gate actually blocks and unblocks**

Via CDP: click "Настройки вида" → PIN modal appears → enter wrong PIN → error message shown, tab stays closed → enter correct PIN (whatever `teacherPin` the test project's `widget.properties` carries, default `0000`) → tab opens, form/indication/highlight selects work and immediately reflect on the table → close and reopen the widget (simulating remount) is NOT required to re-enter the PIN within the same running instance, but changing `tableForm` to `iupac` and reloading the PAGE (full remount) should still remember the last chosen form via `localStorage` (verifies Task 9's storage wiring, not just the in-memory state).

- [ ] **Step 10: Commit**

```bash
git add packages/player/src/periodictable/viewSettingsStorage.ts packages/player/src/periodictable/viewSettingsStorage.test.ts packages/player/src/periodictable/screens/TeacherPinModal.tsx packages/player/src/periodictable/screens/ViewSettingsTab.tsx packages/player/src/periodictable/PeriodicTableRuntime.tsx
git commit -m "feat(periodictable): add teacher-PIN-gated view settings tab"
git push
```

---

### Task 10: Legend tab

**Files:**
- Create: `packages/player/src/periodictable/screens/LegendTab.tsx`
- Modify: `packages/player/src/periodictable/PeriodicTableRuntime.tsx`

**Interfaces:**
- Consumes: `ColorIndicationMode` (Task 6), `ViewSettings` (Task 9).
- Produces: `LegendTab` component (props `{ colorIndication: ColorIndicationMode }`).

- [ ] **Step 1: Write `LegendTab.tsx`**

Renders the color key for whichever indication mode is currently active — matches the original ОС3 behaviour (spec §6, «Легенда — расшифровка ТЕКУЩЕЙ цветовой индикации»).

```tsx
// packages/player/src/periodictable/screens/LegendTab.tsx
import React from 'react';
import type { ColorIndicationMode } from '../viewTypes.ts';

interface Props {
  colorIndication: ColorIndicationMode;
}

const LEGEND_ENTRIES: Record<Exclude<ColorIndicationMode, 'none'>, { color: string; label: string }[]> = {
  class: [
    { color: '#e3f2fd', label: 'Металлы' },
    { color: '#fff3e0', label: 'Металлоиды' },
    { color: '#e8f5e9', label: 'Неметаллы' },
  ],
  electronType: [
    { color: '#ffebee', label: 's-элементы' },
    { color: '#e8f5e9', label: 'p-элементы' },
    { color: '#e3f2fd', label: 'd-элементы' },
    { color: '#f3e5f5', label: 'f-элементы' },
  ],
  oxideCharacter: [
    { color: '#ffebee', label: 'Кислотный характер' },
    { color: '#e3f2fd', label: 'Основной характер' },
    { color: '#fff3e0', label: 'Амфотерный характер' },
    { color: '#f5f5f5', label: 'Не выражен' },
  ],
};

const LegendTab: React.FC<Props> = ({ colorIndication }) => {
  if (colorIndication === 'none') {
    return <div style={{ padding: 16 }}>Цветовая индикация сейчас отключена — включите её во вкладке «Настройки вида».</div>;
  }
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {LEGEND_ENTRIES[colorIndication].map((entry) => (
        <div key={entry.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 24, height: 24, background: entry.color, border: '1px solid #ccc', display: 'inline-block' }} />
          <span>{entry.label}</span>
        </div>
      ))}
    </div>
  );
};

export default LegendTab;
```

Note: the color values here must stay in sync with `CLASS_COLOR`/`ELECTRON_TYPE_COLOR`/`OXIDE_COLOR` in `TableScreen.tsx` (Task 6, Step 1) — both were written from the same 3-entry/4-entry/4-entry palettes; if a future change touches one, it must touch the other. This is a DRY smell worth a small follow-up refactor (hoist the color maps into a shared `colorIndication.ts` module) if this file set grows further — out of scope for this task, noted for Task 12's acceptance sweep.

- [ ] **Step 2: Wire the tab into `PeriodicTableRuntime.tsx`**

Replace the `{/* activeTab === 'legend' — заполняется Задачей 10 */}` comment with:

```tsx
      {activeTab === 'legend' && (
        <div style={{ maxHeight: '40vh', overflow: 'auto', borderTop: '1px solid #ccc' }}>
          <LegendTab colorIndication={viewSettings.colorIndication} />
        </div>
      )}
```

And add the import near the other screen imports:

```ts
import LegendTab from './screens/LegendTab.tsx';
```

- [ ] **Step 3: Type-check**

Run: `cd packages/player && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Live check — legend matches the active indication**

Via CDP: set color indication to "Классы элементов" via the (now-unlocked) view settings tab, open Legend, confirm 3 entries shown (металлы/металлоиды/неметаллы) with colors visibly matching a couple of actual table cells of each class. Switch indication to "Характер оксидов и гидроксидов", reopen Legend, confirm it now shows the 4 oxide-character entries instead.

- [ ] **Step 5: Commit**

```bash
git add packages/player/src/periodictable/screens/LegendTab.tsx packages/player/src/periodictable/PeriodicTableRuntime.tsx
git commit -m "feat(periodictable): add legend tab matching active color indication"
git push
```

---

### Task 11: Server-side allow-list

**Files:**
- Create: `packages/server/src/config/periodicTableAccess.ts`
- Create: `packages/server/src/config/periodicTableAccess.test.ts`
- Modify: `packages/server/src/controllers/ProjectController.ts`

**Interfaces:**
- Consumes: `PERIODICTABLE_WIDGET_TYPE` (Task 1, from `@kiosk/shared`).
- Produces: `isEmailAllowedForPeriodicTable(email)`, `projectDataHasPeriodicTableWidget(projectData)` — consumed only by `ProjectController.ts` in this plan; the same shape as `mathmachineAccess`/`rusiqAccess` so any future controller doing the same check can copy the pattern.

- [ ] **Step 1: Write the failing test**

```ts
// packages/server/src/config/periodicTableAccess.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEmailAllowedForPeriodicTable, projectDataHasPeriodicTableWidget } from './periodicTableAccess.ts';

test('isEmailAllowedForPeriodicTable allows the designated email, case-insensitively', () => {
  assert.equal(isEmailAllowedForPeriodicTable('mokretcov.m@poznaikino.ru'), true);
  assert.equal(isEmailAllowedForPeriodicTable('MOKRETCOV.M@POZNAIKINO.RU'), true);
});

test('isEmailAllowedForPeriodicTable denies other emails and empty input', () => {
  assert.equal(isEmailAllowedForPeriodicTable('test@kiosk.local'), false);
  assert.equal(isEmailAllowedForPeriodicTable(undefined), false);
  assert.equal(isEmailAllowedForPeriodicTable(null), false);
});

test('projectDataHasPeriodicTableWidget detects the widget among other widgets', () => {
  assert.equal(
    projectDataHasPeriodicTableWidget({ widgets: [{ type: 'text' }, { type: 'periodictable' }] }),
    true,
  );
});

test('projectDataHasPeriodicTableWidget returns false when absent or malformed', () => {
  assert.equal(projectDataHasPeriodicTableWidget({ widgets: [{ type: 'text' }] }), false);
  assert.equal(projectDataHasPeriodicTableWidget(null), false);
  assert.equal(projectDataHasPeriodicTableWidget({}), false);
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd packages/server && node --experimental-strip-types --test src/config/periodicTableAccess.test.ts` (check `packages/server/package.json` for the exact test invocation the project already uses for `mathmachineAccess.test.ts` and match it exactly — likely the same `node --test` glob style as player, possibly via a different script name).
Expected: FAIL — `./periodicTableAccess.ts` does not exist yet.

- [ ] **Step 3: Write `periodicTableAccess.ts`**

```ts
// packages/server/src/config/periodicTableAccess.ts
import { PERIODICTABLE_WIDGET_TYPE } from '@kiosk/shared';

// Тот же принцип, что chronolineAccess.ts/natcomAccess.ts/mathmachineAccess.ts/
// rusiqAccess.ts — allow-list доступа к РЕДАКТИРОВАНИЮ (создание/сохранение)
// проекта с виджетом «Таблица Менделеева» по email аккаунта редактора. По
// решению пользователя (2026-09-10, см.
// docs/superpowers/specs/2026-09-10-periodictable-widget-design.md).
const PERIODICTABLE_ALLOWED_EMAILS = ['mokretcov.m@poznaikino.ru'];

export function isEmailAllowedForPeriodicTable(email: string | undefined | null): boolean {
  if (!email) return false;
  return PERIODICTABLE_ALLOWED_EMAILS.includes(email.toLowerCase());
}

export function projectDataHasPeriodicTableWidget(projectData: unknown): boolean {
  return (
    !!projectData &&
    typeof projectData === 'object' &&
    Array.isArray((projectData as any).widgets) &&
    (projectData as any).widgets.some(
      (widget: any) => widget && typeof widget === 'object' && widget.type === PERIODICTABLE_WIDGET_TYPE
    )
  );
}
```

- [ ] **Step 4: Run the test again to confirm it passes**

Run: (same command as Step 2)
Expected: PASS, all 4 tests green.

- [ ] **Step 5: Wire the check into `ProjectController.ts` — `createProject`**

Add the import next to the existing `rusiqAccess` import (line 10):

```ts
import { isEmailAllowedForPeriodicTable, projectDataHasPeriodicTableWidget } from '../config/periodicTableAccess';
```

Add the check directly after the existing RusIQ block in `createProject` (around line 224, before `const project = await ProjectService.createProject({`):

```ts
      if (projectDataHasPeriodicTableWidget(projectData) && !isEmailAllowedForPeriodicTable(req.client.email)) {
        return res.status(403).json({
          error: 'PeriodicTable widget not allowed',
          message: 'Виджет «Таблица Менделеева» пока недоступен для этого аккаунта'
        });
      }
```

- [ ] **Step 6: Wire the check into `ProjectController.ts` — `updateProject`**

Add the matching block directly after the existing RusIQ block in `updateProject` (around line 401, before `const project = await ProjectService.updateProject(`):

```ts
      if (
        Object.prototype.hasOwnProperty.call(updates, 'projectData') &&
        projectDataHasPeriodicTableWidget(updates.projectData) &&
        !isEmailAllowedForPeriodicTable(req.client.email)
      ) {
        return res.status(403).json({
          error: 'PeriodicTable widget not allowed',
          message: 'Виджет «Таблица Менделеева» пока недоступен для этого аккаунта'
        });
      }
```

- [ ] **Step 7: Confirm no other controller needs the same check**

Run: `cd packages/server && grep -rn "mathmachineAccess\|rusiqAccess" src` and check every file it lists (not just `ProjectController.ts`) — if a newer widget's access check was ever added to a second location since the RusIQ design doc was written, mirror that here too. If the grep result matches exactly what Task 3 §3 of the design doc already documented (only `ProjectController.ts`), no further wiring is needed.

- [ ] **Step 8: Build and test the server package**

Run: `cd packages/server && npx tsc --noEmit && npm test` (or whatever the project's actual server test command is — confirm from `package.json`)
Expected: PASS, no new errors, all allow-list tests green.

- [ ] **Step 9: Commit**

```bash
git add packages/server/src/config/periodicTableAccess.ts packages/server/src/config/periodicTableAccess.test.ts packages/server/src/controllers/ProjectController.ts
git commit -m "feat(periodictable): add server-side allow-list enforcement"
git push
```

---

### Task 12: Acceptance sweep, docs, deploy

**Files:**
- Create: `Тип8_ТаблицаМенделеева/Тип8_трассировочная_матрица.md` (admin folder, matching the `Тип6`/`Тип7` convention)
- Modify: `STATUS.md` (admin folder)
- Modify: `C:\Users\Алексей\.claude\projects\...\memory\MEMORY.md` and a new `kiosk-tip8-periodictable.md` memory file, per this session's memory-keeping convention

**Interfaces:** N/A — this is verification and documentation, not new code interfaces.

- [ ] **Step 1: Full local test run**

Run: `cd packages/shared && npx tsc --noEmit`
Run: `cd packages/player && npx tsc --noEmit && npm test`
Run: `cd packages/editor-web && npx tsc --noEmit`
Run: `cd packages/server && npx tsc --noEmit && npm test`
Expected: everything green. Fix any regression before proceeding — do not write the acceptance doc against a red build.

- [ ] **Step 2: Full live end-to-end run via CDP**

Following playbook §5/§10: build the player (`npm run build` in `packages/player`) with a test project containing the `periodictable` widget, open the built `dist/index.html` (or run electron directly), and walk the complete path in one session: table loads (short form by default) → switch to IUPAC form → click 5-6 different elements across different blocks (an s, a p, a d, an f/footer element, one metal, one nonmetal) and open both summary and detail cards for each → search for at least 3 different queries (name, symbol, number) → attempt "Настройки вида" with wrong PIN then correct PIN → change color indication and highlight, confirm the table visibly updates → open Legend and confirm it matches → reload and confirm the last view choice persisted. Note any bug found, fix it, re-run the specific broken scenario (not the whole sweep) to confirm, per the Тип6 retrospective §4 lesson about targeted re-verification.

- [ ] **Step 3: Write the trace matrix**

Create `Тип8_ТаблицаМенделеева/Тип8_трассировочная_матрица.md`, one row per FR-002 through FR-008 (7 requirements total, from `ТЗ_08_Интерактивная_таблица_Менделеева.docx` section 5), each marked done/done-via-reinterpretation with a one-line pointer to the implementing code, plus a separate short section listing the 4 explicit reinterpretations from spec §1 (data sourcing, photo legal risk, teacher PIN, no start screen) as "реализовано через согласованное переосмысление" — not "не реализовано" and not silently "реализовано буквально" (per playbook checklist item and spec §11).

- [ ] **Step 4: Update `STATUS.md`**

Add a new dated entry (today's date) summarizing: branch name, what's implemented, test counts, whether photos made it in (per Task 3's verdict), whether merged/deployed yet (not yet, at this point in the plan) — following the exact terse, dated-entry style already used for the Тип6/Тип7 entries in that file.

- [ ] **Step 5: Write the memory update**

Create `kiosk-tip8-periodictable.md` in the memory directory (type: `project`), summarizing current status per the `MEMORY.md` index convention, and add its one-line pointer to `MEMORY.md`. Include the photo-sourcing decision and its outcome (Task 3) since that's exactly the kind of non-obvious, easy-to-re-litigate decision the memory system exists to preserve.

- [ ] **Step 6: Ask the user about merge/deploy**

This plan stops at a fully implemented, tested, locally-verified feature branch. Per this project's established pattern (Тип6/Тип7 both stayed unmerged/undeployed until an explicit user request), do NOT merge to `main` or deploy to production as part of this plan — surface the finished branch and ask whether to proceed with merge + the standard deploy procedure (playbook §9), the same way РусIQ's Phase 1 was left for a separate explicit go-ahead.
