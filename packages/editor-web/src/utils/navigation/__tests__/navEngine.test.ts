// packages/editor-web/src/utils/navigation/__tests__/navEngine.test.ts
//
// Standalone-тесты движка. Запуск:
//   npx tsx src/utils/navigation/__tests__/navEngine.test.ts
// или после установки vitest:
//   npx vitest run src/utils/navigation
//
// Сейчас файл написан так, чтобы работать БЕЗ vitest — простой ассерт + process.exit.

import { buildGraph, dijkstra, route } from '../navEngine';
import { buildMultiFloorGraph, routeMultiFloor } from '../multiFloor';
import { dist, projectOnSegment, pointInPolygon } from '../geometry';
import type { FloorData, NavigationData } from '../types';

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, details?: string): void {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${details ? ` — ${details}` : ''}`);
  }
}

function approx(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) < eps;
}

// ─── Geometry ─────────────────────────────────────────────────────────
console.log('\n[geometry]');
check('dist (3,4)', dist({ x: 0, y: 0 }, { x: 3, y: 4 }) === 5);
{
  const pr = projectOnSegment({ x: 5, y: 10 }, { x: 0, y: 0 }, { x: 10, y: 0 });
  check('projection on horizontal segment', approx(pr.x, 5) && approx(pr.y, 0) && approx(pr.t, 0.5));
}
{
  const pr = projectOnSegment({ x: -5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 });
  check('projection clamped to t=0', approx(pr.t, 0) && approx(pr.x, 0));
}
{
  const poly = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  check('point inside polygon', pointInPolygon({ x: 5, y: 5 }, poly));
  check('point outside polygon', !pointInPolygon({ x: 50, y: 50 }, poly));
}

// ─── Однопэтажный граф ───────────────────────────────────────────────
console.log('\n[single floor]');

// Простейший этаж: один прямой коридор по оси X, помещение справа от него,
// терминал слева. Маршрут идёт по коридору.
const floor1: FloorData = {
  id: 'f1',
  name: 'Этаж 1',
  level: 1,
  viewBox: { width: 1000, height: 1000 },
  corridors: [
    {
      id: 'c1',
      points: [
        { x: 100, y: 500 },
        { x: 900, y: 500 },
      ],
    },
  ],
  rooms: [
    {
      id: 'r1',
      title: 'Кабинет 101',
      polygon: [
        { x: 800, y: 400 },
        { x: 900, y: 400 },
        { x: 900, y: 450 },
        { x: 800, y: 450 },
      ],
      poi: { x: 850, y: 420 },
      entry: { x: 850, y: 480 },
    },
  ],
  service: [],
  terminals: [
    { id: 't1', x: 150, y: 480, label: 'Терминал A' },
  ],
};

const g1 = buildGraph(floor1, { snap: 50 });
check('graph has nodes', g1.nodes.length > 0);
check('terminalNode mapped', !!g1.terminalNode['t1']);
check('roomPoiNode mapped', !!g1.roomPoiNode['r1']);
check('roomEntryNode mapped', !!g1.roomEntryNode['r1']);

const r1 = route(floor1, 't1', 'r1', { snap: 50 });
check('route built', r1.result !== null);
if (r1.result) {
  check('route has coords', r1.result.coords.length >= 2);
  check('route total > 0', r1.result.total > 0);
  // путь должен проходить близко к точке (850, 500) — около входа на коридоре
  const hasCorridorPoint = r1.result.coords.some(p => Math.abs(p.y - 500) < 100 && p.x > 800);
  check('route passes through corridor near entry', hasCorridorPoint);
}

// Несуществующий терминал → null
const r1bad = route(floor1, 'NO_SUCH', 'r1', { snap: 50 });
check('no terminal → null result', r1bad.result === null);

// ─── Граф с перекрёстком (две оси сливаются по snap) ─────────────────
console.log('\n[crossing corridors]');
const floor2: FloorData = {
  id: 'f2',
  name: 'Этаж 2',
  level: 2,
  viewBox: { width: 1000, height: 1000 },
  corridors: [
    {
      id: 'c1',
      points: [{ x: 100, y: 500 }, { x: 500, y: 500 }, { x: 900, y: 500 }], // горизонтальный с точкой перекрёстка
    },
    {
      id: 'c2',
      points: [{ x: 500, y: 100 }, { x: 500, y: 500 }, { x: 500, y: 900 }], // вертикальный с точкой перекрёстка
    },
  ],
  rooms: [
    {
      id: 'r1',
      title: 'Угловой',
      polygon: [
        { x: 800, y: 800 },
        { x: 900, y: 800 },
        { x: 900, y: 900 },
        { x: 800, y: 900 },
      ],
      poi: { x: 850, y: 850 },
      entry: { x: 850, y: 880 },
    },
  ],
  service: [],
  terminals: [
    { id: 't1', x: 150, y: 480, label: 'Старт' },
  ],
};

const g2 = buildGraph(floor2, { snap: 50 });
// в точке (500,500) должен быть один узел-перекрёсток
const centerNodes = g2.nodes.filter(n => Math.abs(n.x - 500) < 50 && Math.abs(n.y - 500) < 50);
check('crossing merged into one node', centerNodes.length === 1);

const r2 = route(floor2, 't1', 'r1', { snap: 50 });
check('cross route built', r2.result !== null);

// ─── Мульти-этаж ────────────────────────────────────────────────────
console.log('\n[multi-floor]');

const floorA: FloorData = {
  id: 'fa',
  name: 'Этаж 1',
  level: 1,
  viewBox: { width: 1000, height: 1000 },
  corridors: [{ id: 'c', points: [{ x: 100, y: 500 }, { x: 900, y: 500 }] }],
  rooms: [],
  service: [{ id: 'sA', kind: 'stairs', x: 800, y: 500, label: 'Лестница A' }],
  terminals: [{ id: 'tA', x: 150, y: 500, label: 'Терминал A' }],
};

const floorB: FloorData = {
  id: 'fb',
  name: 'Этаж 2',
  level: 2,
  viewBox: { width: 1000, height: 1000 },
  corridors: [{ id: 'c', points: [{ x: 100, y: 500 }, { x: 900, y: 500 }] }],
  rooms: [
    {
      id: 'rB',
      title: 'Цель',
      polygon: [{ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 200, y: 200 }, { x: 100, y: 200 }],
      poi: { x: 150, y: 150 },
      entry: { x: 150, y: 500 }, // вход прямо на коридоре
    },
  ],
  service: [{ id: 'sB', kind: 'stairs', x: 800, y: 500, label: 'Лестница B' }],
  terminals: [],
};

const navData: NavigationData = {
  version: '1.0',
  floors: [floorA, floorB],
  transitions: [
    { id: 'tr1', fromFloorId: 'fa', fromServiceId: 'sA', toFloorId: 'fb', toServiceId: 'sB', type: 'stairs' },
  ],
  edgeCosts: { stairsPenalty: 100, elevatorPenalty: 200 },
};

const mg = buildMultiFloorGraph(navData, { snap: 50 });
check('multi-graph has nodes from both floors', mg.nodes.some(n => n.meta.floorId === 'fa') && mg.nodes.some(n => n.meta.floorId === 'fb'));
check('multi-graph maps terminal globally', !!mg.terminalNode['tA']);
check('multi-graph maps room globally', !!mg.roomPoiNode['rB']);

const mr = routeMultiFloor(navData, 'tA', 'rB', { snap: 50 });
check('multi-route built', mr.result !== null);
if (mr.result && mr.segmentsByFloor) {
  check('route crosses 2 floors', mr.segmentsByFloor.length === 2);
  check('first segment is starting floor', mr.segmentsByFloor[0].floorId === 'fa');
  check('second segment is target floor', mr.segmentsByFloor[1].floorId === 'fb');
}

// ─── Итог ───────────────────────────────────────────────────────────
console.log(`\n────────────────────────`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed > 0) {
  if (typeof (globalThis as any).process !== 'undefined' && (globalThis as any).process.exit) {
    (globalThis as any).process.exit(1);
  }
  throw new Error(`${failed} test(s) failed`);
}
