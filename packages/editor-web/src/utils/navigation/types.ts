// packages/editor-web/src/utils/navigation/types.ts
// Типы данных модуля навигации по зданию

/** Координаты точки в системе viewBox SVG */
export interface Point {
  x: number;
  y: number;
}

/** Осевая линия коридора (ломаная) */
export interface Corridor {
  id: string;
  points: Point[];
}

/** Помещение */
export interface Room {
  id: string;
  title: string;
  polygon: Point[];           // контур (для подсветки)
  poi?: Point;                // символьная точка (значок) — куда «приводим» взгляд
  entry?: Point;              // точка входа в помещение (привязывается к коридору)
  aliases?: string[];         // синонимы для поиска
}

/** Точка лестницы/лифта */
export type ServiceKind = 'stairs' | 'elevator';

export interface ServicePoint {
  id: string;
  kind: ServiceKind;
  x: number;
  y: number;
  label?: string;
}

/** Терминал (киоск) */
export interface Terminal {
  id: string;
  deviceId?: string;          // привязка к устройству (может быть пусто)
  x: number;
  y: number;
  label?: string;
}

/** Стоимости рёбер: штрафы для смены этажей */
export interface EdgeCosts {
  stairsPenalty: number;
  elevatorPenalty: number;
}

/** Данные одного этажа */
export interface FloorData {
  id: string;
  name: string;
  level: number;              // номер этажа (для сортировки/выбора)
  /**
   * Текст SVG-плана (inline-хранение, по схеме как у image-виджета: data в проекте).
   * НЕ URL — соответствует правилу №7.
   */
  svgContent?: string;
  /**
   * Зарезервировано: ID файла на сервере, если в будущем перейдём на ProjectFile.
   * Сейчас НЕ используется — план хранится inline в svgContent.
   */
  svgFileId?: string;
  viewBox: { width: number; height: number };
  corridors: Corridor[];
  rooms: Room[];
  service: ServicePoint[];
  terminals: Terminal[];
}

/** Межэтажный переход (пара service-точек на разных этажах) */
export interface FloorTransition {
  id: string;
  fromFloorId: string;
  fromServiceId: string;
  toFloorId: string;
  toServiceId: string;
  type: ServiceKind;
  weight?: number | null;     // null/undefined → используется penalty из edgeCosts
}

/** Полные данные навигации виджета (мульти-этаж) */
export interface NavigationData {
  version: string;
  floors: FloorData[];
  transitions: FloorTransition[];
  edgeCosts: EdgeCosts;
}

// ─── Граф ────────────────────────────────────────────────────────────

export type NodeKind =
  | 'corridor'    // узел на осевой линии
  | 'attach'      // узел-проекция (привязка точки к коридору)
  | 'poi'         // символьная точка помещения
  | 'entry'       // точка входа в помещение
  | 'terminal'    // терминал
  | 'stairs'      // лестница
  | 'elevator';   // лифт

export interface NodeMeta {
  kind?: NodeKind;
  roomId?: string;
  serviceId?: string;
  terminalId?: string;
  floorId?: string;           // для мульти-графа
}

export interface GraphNode {
  id: string;
  x: number;
  y: number;
  meta: NodeMeta;
}

export type EdgeType = 'walk' | 'stairs' | 'elevator';

export interface GraphEdge {
  to: string;
  w: number;
  type: EdgeType;
}

export interface Graph {
  nodes: GraphNode[];
  adj: Map<string, GraphEdge[]>;
  /** roomId → id узла точки входа */
  roomEntryNode: Record<string, string>;
  /** roomId → id узла POI (или entry, если POI не задан) */
  roomPoiNode: Record<string, string>;
  /** serviceId → id узла */
  serviceNode: Record<string, string>;
  /** terminalId → id узла */
  terminalNode: Record<string, string>;
}

/** Опции построения графа */
export interface BuildGraphOptions {
  /** Радиус слияния узлов (ед. viewBox). По умолчанию 300. */
  snap?: number;
}

/** Результат Дейкстры */
export interface RouteResult {
  path: string[];             // последовательность id узлов
  coords: Point[];            // координаты узлов пути
  total: number;              // суммарный вес
}

/** Высокоуровневый результат маршрута */
export interface RouteOutcome {
  graph: Graph;
  result: RouteResult | null;
}

/** Результат маршрута между этажами */
export interface MultiFloorRouteOutcome {
  graph: Graph;
  result: RouteResult | null;
  /** Сегменты пути по этажам (для покадрового рендера) */
  segmentsByFloor?: Array<{
    floorId: string;
    coords: Point[];
  }>;
}
