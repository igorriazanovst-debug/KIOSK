// packages/editor-web/src/utils/navigation/multiFloor.ts
// Мульти-этажный граф: объединение этажей + межэтажные переходы

import { buildGraph, dijkstra } from './navEngine';
import { dist } from './geometry';
import type {
  NavigationData,
  FloorData,
  Graph,
  GraphNode,
  GraphEdge,
  EdgeType,
  Point,
  BuildGraphOptions,
  MultiFloorRouteOutcome,
} from './types';

/**
 * Построить единый граф по всем этажам, склеив их переходами.
 *
 * Идентификаторы узлов префиксуются `floorId:` чтобы не было коллизий.
 * Переходы добавляют ребро со штрафом из edgeCosts.
 */
export function buildMultiFloorGraph(
  data: NavigationData,
  opts: BuildGraphOptions = {},
): Graph {
  const merged: Graph = {
    nodes: [],
    adj: new Map(),
    roomEntryNode: {},
    roomPoiNode: {},
    serviceNode: {},
    terminalNode: {},
  };

  // Локальные ID → глобальные (с префиксом этажа)
  const idMap: Record<string, Record<string, string>> = {};

  for (const floor of data.floors) {
    const fg = buildGraph(floor, opts, data.edgeCosts);
    idMap[floor.id] = {};

    for (const n of fg.nodes) {
      const gid = `${floor.id}:${n.id}`;
      idMap[floor.id][n.id] = gid;
      merged.nodes.push({
        id: gid,
        x: n.x,
        y: n.y,
        meta: { ...n.meta, floorId: floor.id },
      });
      merged.adj.set(gid, []);
    }

    // Переносим рёбра в merged.adj (id обновляем на глобальные)
    for (const [localId, edges] of fg.adj.entries()) {
      const gid = idMap[floor.id][localId];
      const mappedEdges: GraphEdge[] = edges.map(e => ({
        to: idMap[floor.id][e.to],
        w: e.w,
        type: e.type,
      }));
      merged.adj.set(gid, mappedEdges);
    }

    // Маппинги верхнего уровня (с глобальными id)
    for (const [roomId, nodeId] of Object.entries(fg.roomEntryNode)) {
      merged.roomEntryNode[roomId] = idMap[floor.id][nodeId];
    }
    for (const [roomId, nodeId] of Object.entries(fg.roomPoiNode)) {
      merged.roomPoiNode[roomId] = idMap[floor.id][nodeId];
    }
    for (const [svId, nodeId] of Object.entries(fg.serviceNode)) {
      merged.serviceNode[svId] = idMap[floor.id][nodeId];
    }
    for (const [tId, nodeId] of Object.entries(fg.terminalNode)) {
      merged.terminalNode[tId] = idMap[floor.id][nodeId];
    }
  }

  // Межэтажные переходы
  for (const tr of data.transitions || []) {
    const aGid = merged.serviceNode[tr.fromServiceId];
    const bGid = merged.serviceNode[tr.toServiceId];
    if (!aGid || !bGid) continue;

    const a = merged.nodes.find(n => n.id === aGid);
    const b = merged.nodes.find(n => n.id === bGid);
    if (!a || !b) continue;

    // Вес: если явно задан — используем; иначе штраф (евклид между этажами лишён смысла)
    let w: number;
    if (tr.weight != null) {
      w = tr.weight;
    } else if (tr.type === 'elevator') {
      w = data.edgeCosts.elevatorPenalty || 0;
    } else {
      w = data.edgeCosts.stairsPenalty || 0;
    }

    const edgeType: EdgeType = tr.type;
    const listA = merged.adj.get(aGid)!;
    const listB = merged.adj.get(bGid)!;
    if (!listA.some(e => e.to === bGid)) listA.push({ to: bGid, w, type: edgeType });
    if (!listB.some(e => e.to === aGid)) listB.push({ to: aGid, w, type: edgeType });
  }

  return merged;
}

/**
 * Построить маршрут от терминала к помещению с учётом всех этажей.
 *
 * Возвращает segmentsByFloor — путь разбитый по этажам для покадрового рендера.
 */
export function routeMultiFloor(
  data: NavigationData,
  terminalId: string,
  roomId: string,
  opts?: BuildGraphOptions,
): MultiFloorRouteOutcome {
  const graph = buildMultiFloorGraph(data, opts);
  const s = graph.terminalNode[terminalId];
  const t = graph.roomPoiNode[roomId];
  if (!s || !t) return { graph, result: null };

  const result = dijkstra(graph, s, t);
  if (!result) return { graph, result: null };

  // Разбиваем путь по этажам
  const segmentsByFloor: Array<{ floorId: string; coords: Point[] }> = [];
  let curFloor: string | null = null;
  let curCoords: Point[] = [];

  for (const nodeId of result.path) {
    const n = graph.nodes.find(x => x.id === nodeId);
    if (!n) continue;
    const fId = n.meta.floorId || '';
    if (fId !== curFloor) {
      if (curFloor !== null) {
        segmentsByFloor.push({ floorId: curFloor, coords: curCoords });
      }
      curFloor = fId;
      curCoords = [];
    }
    curCoords.push({ x: n.x, y: n.y });
  }
  if (curFloor !== null) {
    segmentsByFloor.push({ floorId: curFloor, coords: curCoords });
  }

  return { graph, result, segmentsByFloor };
}

/**
 * Поиск этажа, на котором находится данный терминал.
 * Возвращает null если не найден.
 */
export function findFloorByTerminal(
  data: NavigationData,
  terminalId: string,
): FloorData | null {
  for (const f of data.floors) {
    if (f.terminals.some(t => t.id === terminalId)) return f;
  }
  return null;
}

/**
 * Поиск этажа, на котором находится данное помещение.
 */
export function findFloorByRoom(
  data: NavigationData,
  roomId: string,
): FloorData | null {
  for (const f of data.floors) {
    if (f.rooms.some(r => r.id === roomId)) return f;
  }
  return null;
}

// Пере-экспорт хелпера на всякий случай
export { dist };
