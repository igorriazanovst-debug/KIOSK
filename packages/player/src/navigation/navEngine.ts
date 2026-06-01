// packages/editor-web/src/utils/navigation/navEngine.ts
// Движок навигации одного этажа: построение графа из коридоров + Дейкстра

import { dist, projectOnSegment } from './geometry';
import type {
  FloorData,
  Graph,
  GraphNode,
  NodeMeta,
  EdgeType,
  Point,
  BuildGraphOptions,
  RouteResult,
  RouteOutcome,
  EdgeCosts,
} from './types';

const DEFAULT_SNAP = 300;

interface Segment {
  aId: string;
  bId: string;
  a: Point;
  b: Point;
}

/**
 * Построение графа из данных этажа.
 *
 * 1. Каждая осевая линия даёт цепочку вершин (по её точкам) и рёбра между ними.
 * 2. Точки разных линий, оказавшиеся ближе SNAP, сливаются (перекрёстки).
 * 3. POI/entry/terminal/service привязываются к ближайшей точке на любой осевой линии
 *    (с разбиением сегмента, если нужно).
 */
export function buildGraph(
  data: FloorData,
  opts: BuildGraphOptions = {},
  edgeCosts?: EdgeCosts,
): Graph {
  const SNAP = opts.snap != null ? opts.snap : DEFAULT_SNAP;
  const costs: EdgeCosts = edgeCosts || { stairsPenalty: 0, elevatorPenalty: 0 };

  const nodes: GraphNode[] = [];
  const adj: Map<string, GraphEdgeInternal[]> = new Map();
  let nid = 0;

  function addNode(x: number, y: number, meta: NodeMeta = {}): string {
    for (const n of nodes) {
      if (Math.hypot(n.x - x, n.y - y) <= SNAP) return n.id;
    }
    const id = `g${nid++}`;
    nodes.push({ id, x, y, meta });
    adj.set(id, []);
    return id;
  }

  function link(aId: string, bId: string, type: EdgeType): void {
    if (aId === bId) return;
    const a = nodes.find(n => n.id === aId);
    const b = nodes.find(n => n.id === bId);
    if (!a || !b) return;
    let w = dist(a, b);
    if (type === 'stairs') w += costs.stairsPenalty || 0;
    if (type === 'elevator') w += costs.elevatorPenalty || 0;
    const listA = adj.get(aId)!;
    const listB = adj.get(bId)!;
    if (!listA.some(e => e.to === bId)) listA.push({ to: bId, w, type });
    if (!listB.some(e => e.to === aId)) listB.push({ to: aId, w, type });
  }

  const segments: Segment[] = [];

  // 1. Осевые линии коридоров → вершины + рёбра
  for (const cor of data.corridors || []) {
    const pts = cor.points || [];
    let prevId: string | null = null;
    for (const p of pts) {
      const id = addNode(p.x, p.y, { kind: 'corridor' });
      if (prevId !== null) {
        link(prevId, id, 'walk');
        const a = nodes.find(n => n.id === prevId)!;
        const b = nodes.find(n => n.id === id)!;
        segments.push({
          aId: prevId,
          bId: id,
          a: { x: a.x, y: a.y },
          b: { x: b.x, y: b.y },
        });
      }
      prevId = id;
    }
  }

  // 2. Привязка произвольной точки к сети коридоров
  function attachToCorridors(p: Point, meta: NodeMeta): string {
    if (segments.length === 0) return addNode(p.x, p.y, meta);
    let best: { d: number; pr: { x: number; y: number }; s: Segment } | null = null;
    for (const s of segments) {
      const pr = projectOnSegment(p, s.a, s.b);
      const d = Math.hypot(pr.x - p.x, pr.y - p.y);
      if (!best || d < best.d) best = { d, pr, s };
    }
    if (!best) return addNode(p.x, p.y, meta);
    const projId = addNode(best.pr.x, best.pr.y, { kind: 'attach' });
    link(projId, best.s.aId, 'walk');
    link(projId, best.s.bId, 'walk');
    const pId = addNode(p.x, p.y, meta);
    link(pId, projId, 'walk');
    return pId;
  }

  // 3. Помещения: entry + poi
  const roomEntryNode: Record<string, string> = {};
  const roomPoiNode: Record<string, string> = {};

  for (const r of data.rooms || []) {
    if (r.entry) {
      const eId = attachToCorridors(r.entry, { kind: 'entry', roomId: r.id });
      roomEntryNode[r.id] = eId;
      if (r.poi) {
        const poiId = addNode(r.poi.x, r.poi.y, { kind: 'poi', roomId: r.id });
        link(poiId, eId, 'walk');
        roomPoiNode[r.id] = poiId;
      } else {
        roomPoiNode[r.id] = eId;
      }
    } else if (r.poi) {
      const poiId = attachToCorridors(r.poi, { kind: 'poi', roomId: r.id });
      roomPoiNode[r.id] = poiId;
    }
  }

  // 4. Служебные точки (лестницы/лифты)
  const serviceNode: Record<string, string> = {};
  for (const sv of data.service || []) {
    serviceNode[sv.id] = attachToCorridors(
      { x: sv.x, y: sv.y },
      { kind: sv.kind, serviceId: sv.id },
    );
  }

  // 5. Терминалы
  const terminalNode: Record<string, string> = {};
  for (const t of data.terminals || []) {
    terminalNode[t.id] = attachToCorridors(
      { x: t.x, y: t.y },
      { kind: 'terminal', terminalId: t.id },
    );
  }

  // Конвертируем внутренний adj в публичный (тот же тип)
  const pubAdj = new Map<string, Array<{ to: string; w: number; type: EdgeType }>>();
  for (const [k, v] of adj.entries()) pubAdj.set(k, v);

  return {
    nodes,
    adj: pubAdj,
    roomEntryNode,
    roomPoiNode,
    serviceNode,
    terminalNode,
  };
}

interface GraphEdgeInternal {
  to: string;
  w: number;
  type: EdgeType;
}

/**
 * Алгоритм Дейкстры — кратчайший путь от startId до endId.
 * Возвращает null, если путь не существует или один из узлов отсутствует.
 */
export function dijkstra(graph: Graph, startId: string, endId: string): RouteResult | null {
  const { adj, nodes } = graph;
  const D = new Map<string, number>();
  const P = new Map<string, string>();
  const V = new Set<string>();

  for (const n of nodes) D.set(n.id, Infinity);
  if (!D.has(startId) || !D.has(endId)) return null;
  D.set(startId, 0);

  while (V.size < nodes.length) {
    let u: string | null = null;
    let best = Infinity;
    for (const [id, d] of D) {
      if (!V.has(id) && d < best) {
        best = d;
        u = id;
      }
    }
    if (u === null) break;
    if (u === endId) break;
    V.add(u);
    const edges = adj.get(u);
    if (!edges) continue;
    for (const e of edges) {
      if (V.has(e.to)) continue;
      const nd = D.get(u)! + e.w;
      if (nd < (D.get(e.to) ?? Infinity)) {
        D.set(e.to, nd);
        P.set(e.to, u);
      }
    }
  }

  if (D.get(endId) === Infinity) return null;

  const path: string[] = [];
  let cur: string | undefined = endId;
  while (cur !== undefined) {
    path.unshift(cur);
    if (cur === startId) break;
    cur = P.get(cur);
  }

  const coords: Point[] = path.map(id => {
    const n = nodes.find(x => x.id === id)!;
    return { x: n.x, y: n.y };
  });

  return { path, coords, total: D.get(endId)! };
}

/**
 * Высокоуровневый: построить маршрут от терминала к помещению на одном этаже.
 */
export function route(
  data: FloorData,
  terminalId: string,
  roomId: string,
  opts?: BuildGraphOptions,
  edgeCosts?: EdgeCosts,
): RouteOutcome {
  const graph = buildGraph(data, opts, edgeCosts);
  const s = graph.terminalNode[terminalId];
  const t = graph.roomPoiNode[roomId];
  if (!s || !t) return { graph, result: null };
  return { graph, result: dijkstra(graph, s, t) };
}
