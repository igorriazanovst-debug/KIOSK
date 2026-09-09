// Этап 4 (2026-09-10) — Класс А покрытия FR-022: 13 категорий ТЗ,
// ложащихся на существующий choice/numeric движок новыми визуалами (без
// новой парадигмы взаимодействия) — см. Тип6_бэклог.md, Эпик 32, и
// docs/superpowers/specs/2026-09-10-mathmachine-fr022-groups23-design.md.

import type { Task } from '@kiosk/shared';
import type { MathMachineContent } from '@kiosk/shared';
import {
  buildGroup, rotate, contentHash, mergeWaveIntoContent, type TopicSpec,
  SHAPE_IDS, SOLID_IDS, POSITION_RELATION_IDS, DIRECTION_IDS,
} from './generatorShared.ts';

// ─── Пересчёт и сложение / пересчёт и вычитание ─────────────────────────

function countThenAddTask(seed: number): Omit<Task, 'id'> {
  const groupA = 2 + (seed % 8);
  const groupB = 2 + ((seed * 5 + 1) % 8);
  return {
    typeId: 'count_then_add',
    text: 'Посчитай кружки в первой группе, посчитай во второй, сложи вместе — сколько всего?',
    params: { groupA, groupB },
    correctAnswer: groupA + groupB,
  };
}

function buildCountAddTopic(): TopicSpec {
  const group = buildGroup(
    'counting_add_combo',
    'Посчитай и сложи',
    Array.from({ length: 10 }, (_, i) => countThenAddTask(i * 3 + 1)),
  );
  return { id: 'top_counting_add_combo', name: 'Счёт: посчитай и сложи', groups: [group] };
}

function countThenSubtractTask(seed: number): Omit<Task, 'id'> {
  const groupB = 2 + (seed % 6);
  const groupA = groupB + 1 + ((seed * 3 + 1) % 6);
  return {
    typeId: 'count_then_subtract',
    text: 'Посчитай кружки в первой группе, посчитай во второй, вычти — на сколько первая группа больше?',
    params: { groupA, groupB },
    correctAnswer: groupA - groupB,
  };
}

function buildCountSubtractTopic(): TopicSpec {
  const group = buildGroup(
    'counting_subtract_combo',
    'Посчитай и вычти',
    Array.from({ length: 10 }, (_, i) => countThenSubtractTask(i * 3 + 2)),
  );
  return { id: 'top_counting_subtract_combo', name: 'Счёт: посчитай и вычти', groups: [group] };
}

// ─── Время | измерение (чтение часов) ───────────────────────────────────

function clockTask(hours: number, minutes: 0 | 30, salt: number): Omit<Task, 'id'> {
  const correct = `${hours}:${minutes === 0 ? '00' : '30'}`;
  const decoyPool = ['1:00', '2:00', '3:00', '4:00', '5:00', '6:00', '7:00', '8:00', '9:00', '10:00', '11:00', '12:00', '1:30', '4:30', '7:30', '10:30'].filter(
    (t) => t !== correct,
  );
  const d1Idx = contentHash('e4-clock-d1-v2', [salt]) % decoyPool.length;
  const d1 = decoyPool[d1Idx];
  const rest = decoyPool.filter((v) => v !== d1);
  const d2 = rest[contentHash('e4-clock-d2-v2', [salt]) % rest.length];
  const posShift = contentHash('e4-clock-pos-v2', [salt]);
  return {
    typeId: 'clock_reading',
    text: 'Сколько времени показывают часы?',
    params: { hours, minutes },
    correctAnswer: correct,
    choices: rotate([correct, d1, d2], posShift),
  };
}

function buildClockTopic(): TopicSpec {
  const configs: [number, 0 | 30][] = [
    [3, 0], [7, 0], [12, 0], [5, 30], [9, 0], [1, 30], [6, 0], [10, 30], [4, 0], [8, 30],
  ];
  const group = buildGroup(
    'time_clock',
    'Который час',
    configs.map(([h, m], i) => clockTask(h, m, i)),
  );
  return { id: 'top_time_clock', name: 'Время: который час', groups: [group] };
}

// ─── Масса | измерение (шкала весов) ────────────────────────────────────

function massMeasurementTask(value: number, salt: number): Omit<Task, 'id'> {
  const decoyPool = Array.from({ length: 10 }, (_, i) => i + 1).filter((v) => v !== value);
  const d1Idx = contentHash('e4-massmeasure-d1', [salt]) % decoyPool.length;
  const d1 = decoyPool[d1Idx];
  const rest = decoyPool.filter((v) => v !== d1);
  const d2 = rest[contentHash('e4-massmeasure-d2', [salt]) % rest.length];
  const posShift = contentHash('e4-massmeasure-pos', [salt]);
  return {
    typeId: 'mass_measurement',
    text: 'Сколько килограммов показывают весы?',
    params: { value },
    correctAnswer: String(value),
    choices: rotate([String(value), String(d1), String(d2)], posShift),
  };
}

function buildMassMeasurementTopic(): TopicSpec {
  const group = buildGroup(
    'measure_mass_scale',
    'Измерение массы',
    Array.from({ length: 10 }, (_, i) => massMeasurementTask(i + 1, i)),
  );
  return { id: 'top_measure_mass_scale', name: 'Масса: измерение по весам', groups: [group] };
}

// ─── Углы | прямой угол ──────────────────────────────────────────────────

// Пул неверных углов сознательно перемешивает острые/тупые между собой на
// каждом задании (иногда оба острые, иногда оба тупые, иногда по одному) —
// иначе прямой угол всегда оказывался бы «средним по размеру» из трёх, и
// задание решалось бы визуальным сравнением величины, не знанием, что
// такое 90°.
const ANGLE_DECOY_POOL = [30, 45, 60, 75, 105, 120, 135, 150, 165];

function rightAngleTask(salt: number): Omit<Task, 'id'> {
  const d1Idx = contentHash('e4-angle-d1', [salt]) % ANGLE_DECOY_POOL.length;
  const d1 = ANGLE_DECOY_POOL[d1Idx];
  const restPool = ANGLE_DECOY_POOL.filter((v) => v !== d1);
  const d2 = restPool[contentHash('e4-angle-d2', [salt]) % restPool.length];
  const posShift = contentHash('e4-angle-pos', [salt]);
  const angles = rotate([90, d1, d2], posShift);
  const correctLabel = ['А', 'Б', 'В'][angles.indexOf(90)];
  return {
    typeId: 'right_angle_recognition',
    text: 'Какой из трёх углов — прямой?',
    params: { angles },
    correctAnswer: correctLabel,
    choices: ['А', 'Б', 'В'],
  };
}

function buildRightAngleTopic(): TopicSpec {
  const group = buildGroup(
    'geometry_angle',
    'Прямой угол',
    Array.from({ length: 10 }, (_, i) => rightAngleTask(i)),
  );
  return { id: 'top_geometry_angle', name: 'Углы: прямой угол', groups: [group] };
}

// ─── Плоские фигуры | названия и свойства ───────────────────────────────

const SHAPE_NAMES: Record<string, string> = {
  circle: 'Круг',
  square: 'Квадрат',
  triangle: 'Треугольник',
  rectangle: 'Прямоугольник',
  pentagon: 'Пятиугольник',
  hexagon: 'Шестиугольник',
};
const SHAPE_SIDES: Record<string, number> = {
  circle: 0,
  square: 4,
  triangle: 3,
  rectangle: 4,
  pentagon: 5,
  hexagon: 6,
};
function shapeNamingTask(shapeId: string, salt: number): Omit<Task, 'id'> {
  const correct = SHAPE_NAMES[shapeId];
  const decoyPool = SHAPE_IDS.filter((s) => s !== shapeId).map((s) => SHAPE_NAMES[s]);
  const d1Idx = contentHash('e4-shapename-d1', [salt]) % decoyPool.length;
  const d1 = decoyPool[d1Idx];
  const rest = decoyPool.filter((v) => v !== d1);
  const d2 = rest[contentHash('e4-shapename-d2', [salt]) % rest.length];
  const posShift = contentHash('e4-shapename-pos', [salt]);
  return {
    typeId: 'shape_naming',
    text: 'Как называется эта фигура?',
    params: { shape: SHAPE_IDS.indexOf(shapeId as (typeof SHAPE_IDS)[number]) },
    correctAnswer: correct,
    choices: rotate([correct, d1, d2], posShift),
  };
}

function buildShapeNamingTopic(): TopicSpec {
  const group = buildGroup(
    'geometry_shape_name',
    'Названия фигур',
    SHAPE_IDS.map((s, i) => shapeNamingTask(s, i)),
  );
  return { id: 'top_geometry_shape_name', name: 'Плоские фигуры: названия', groups: [group] };
}

function shapePropertiesTask(shapeId: string, salt: number): Omit<Task, 'id'> {
  const sides = SHAPE_SIDES[shapeId];
  const decoyPool = [3, 4, 5, 6].filter((n) => n !== sides);
  const d1Idx = contentHash('e4-shapeprop-d1', [salt]) % decoyPool.length;
  const d1 = decoyPool[d1Idx];
  const rest = decoyPool.filter((v) => v !== d1);
  const d2 = rest[contentHash('e4-shapeprop-d2', [salt]) % rest.length];
  const posShift = contentHash('e4-shapeprop-pos', [salt]);
  return {
    typeId: 'shape_properties',
    text: `Сколько сторон у фигуры «${SHAPE_NAMES[shapeId]}»?`,
    params: { shape: SHAPE_IDS.indexOf(shapeId as (typeof SHAPE_IDS)[number]) },
    correctAnswer: String(sides),
    choices: rotate([String(sides), String(d1), String(d2)], posShift),
  };
}

function buildShapePropertiesTopic(): TopicSpec {
  const polygons = SHAPE_IDS.filter((s) => s !== 'circle');
  const group = buildGroup(
    'geometry_shape_properties',
    'Свойства фигур',
    polygons.map((s, i) => shapePropertiesTask(s, i)),
  );
  return { id: 'top_geometry_shape_properties', name: 'Плоские фигуры: свойства', groups: [group] };
}

// ─── Объёмные тела | названия и свойства ────────────────────────────────

const SOLID_NAMES: Record<string, string> = {
  cube: 'Куб',
  sphere: 'Шар',
  cone: 'Конус',
  cylinder: 'Цилиндр',
  pyramid: 'Пирамида',
};
const SOLID_FACES: Record<string, number> = {
  cube: 6,
  sphere: 0,
  cone: 1,
  cylinder: 2,
  pyramid: 5,
};
function solidNamingTask(solidId: string, salt: number): Omit<Task, 'id'> {
  const correct = SOLID_NAMES[solidId];
  const decoyPool = SOLID_IDS.filter((s) => s !== solidId).map((s) => SOLID_NAMES[s]);
  const d1Idx = contentHash('e4-solidname-d1', [salt]) % decoyPool.length;
  const d1 = decoyPool[d1Idx];
  const rest = decoyPool.filter((v) => v !== d1);
  const d2 = rest[contentHash('e4-solidname-d2', [salt]) % rest.length];
  const posShift = contentHash('e4-solidname-pos', [salt]);
  return {
    typeId: 'solid_naming',
    text: 'Как называется это тело?',
    params: { solid: SOLID_IDS.indexOf(solidId as (typeof SOLID_IDS)[number]) },
    correctAnswer: correct,
    choices: rotate([correct, d1, d2], posShift),
  };
}

function buildSolidNamingTopic(): TopicSpec {
  const group = buildGroup(
    'geometry_solid_name',
    'Названия объёмных тел',
    SOLID_IDS.map((s, i) => solidNamingTask(s, i)),
  );
  return { id: 'top_geometry_solid_name', name: 'Объёмные тела: названия', groups: [group] };
}

function solidPropertiesTask(solidId: string, salt: number): Omit<Task, 'id'> {
  const faces = SOLID_FACES[solidId];
  const decoyPool = [0, 1, 2, 5, 6].filter((n) => n !== faces);
  const d1Idx = contentHash('e4-solidprop-d1', [salt]) % decoyPool.length;
  const d1 = decoyPool[d1Idx];
  const rest = decoyPool.filter((v) => v !== d1);
  const d2 = rest[contentHash('e4-solidprop-d2', [salt]) % rest.length];
  const posShift = contentHash('e4-solidprop-pos', [salt]);
  return {
    typeId: 'solid_properties',
    text: `Сколько плоских граней у тела «${SOLID_NAMES[solidId]}»?`,
    params: { solid: SOLID_IDS.indexOf(solidId as (typeof SOLID_IDS)[number]) },
    correctAnswer: String(faces),
    choices: rotate([String(faces), String(d1), String(d2)], posShift),
  };
}

function buildSolidPropertiesTopic(): TopicSpec {
  const group = buildGroup(
    'geometry_solid_properties',
    'Свойства объёмных тел',
    SOLID_IDS.map((s, i) => solidPropertiesTask(s, i)),
  );
  return { id: 'top_geometry_solid_properties', name: 'Объёмные тела: свойства', groups: [group] };
}

// ─── Пространственные представления | расположение ──────────────────────

const POSITION_LABELS: Record<string, string> = {
  left: 'Слева',
  right: 'Справа',
  above: 'Сверху',
  below: 'Снизу',
};
function spatialPositionTask(relation: string, salt: number): Omit<Task, 'id'> {
  const correct = POSITION_LABELS[relation];
  const decoyPool = POSITION_RELATION_IDS.filter((p) => p !== relation).map((p) => POSITION_LABELS[p]);
  const d1Idx = contentHash('e4-position-d1', [salt]) % decoyPool.length;
  const d1 = decoyPool[d1Idx];
  const rest = decoyPool.filter((v) => v !== d1);
  const d2 = rest[contentHash('e4-position-d2', [salt]) % rest.length];
  const posShift = contentHash('e4-position-pos', [salt]);
  return {
    typeId: 'spatial_position',
    text: 'Где находится мяч относительно коробки?',
    params: { relation: POSITION_RELATION_IDS.indexOf(relation as (typeof POSITION_RELATION_IDS)[number]) },
    correctAnswer: correct,
    choices: rotate([correct, d1, d2], posShift),
  };
}

function buildSpatialPositionTopic(): TopicSpec {
  const group = buildGroup(
    'space_position',
    'Где находится',
    Array.from({ length: 10 }, (_, i) => spatialPositionTask(POSITION_RELATION_IDS[i % POSITION_RELATION_IDS.length], i)),
  );
  return { id: 'top_space_position', name: 'Пространство: где находится', groups: [group] };
}

// ─── Пространственные представления | направление ───────────────────────

const DIRECTION_LABELS: Record<string, string> = {
  up: 'Вверх',
  down: 'Вниз',
  left: 'Влево',
  right: 'Вправо',
};

function spatialDirectionTask(direction: string, salt: number): Omit<Task, 'id'> {
  const correct = DIRECTION_LABELS[direction];
  const decoyPool = DIRECTION_IDS.filter((d) => d !== direction).map((d) => DIRECTION_LABELS[d]);
  const d1Idx = contentHash('e4-direction-d1', [salt]) % decoyPool.length;
  const d1 = decoyPool[d1Idx];
  const rest = decoyPool.filter((v) => v !== d1);
  const d2 = rest[contentHash('e4-direction-d2', [salt]) % rest.length];
  const posShift = contentHash('e4-direction-pos', [salt]);
  return {
    typeId: 'spatial_direction',
    text: 'Куда указывает стрелка?',
    params: { direction: DIRECTION_IDS.indexOf(direction as (typeof DIRECTION_IDS)[number]) },
    correctAnswer: correct,
    choices: rotate([correct, d1, d2], posShift),
  };
}

function buildSpatialDirectionTopic(): TopicSpec {
  const group = buildGroup(
    'space_direction',
    'Куда указывает стрелка',
    Array.from({ length: 10 }, (_, i) => spatialDirectionTask(DIRECTION_IDS[i % DIRECTION_IDS.length], i)),
  );
  return { id: 'top_space_direction', name: 'Пространство: куда движется', groups: [group] };
}

// ─── Пространственные представления | упорядочение ───────────────────────
// Три подписанные позиции («Первая»/«Вторая»/«Третья») со случайными
// размерами — задание про порядок ПО ЗРИТЕЛЬНОМУ признаку (размер), а не
// про числа (уже покрыто существующим number_ordering).

const POSITION_TAGS = ['Первая', 'Вторая', 'Третья'];

function spatialOrderingTask(sizes: [number, number, number], salt: number): Omit<Task, 'id'> {
  const ascending = contentHash('e4-spord-dir', [salt]) % 2 === 0;
  const indices = [0, 1, 2];
  const sortedIndices = [...indices].sort((a, b) => (ascending ? sizes[a] - sizes[b] : sizes[b] - sizes[a]));
  const correct = sortedIndices.map((i) => POSITION_TAGS[i]).join(', ');
  const decoy1 = [...sortedIndices].reverse().map((i) => POSITION_TAGS[i]).join(', ');
  // Третий вариант — свап двух последних элементов правильного порядка,
  // отличный и от correct, и от полного разворота (decoy1).
  const swapped = [...sortedIndices];
  [swapped[1], swapped[2]] = [swapped[2], swapped[1]];
  const decoy2 = swapped.map((i) => POSITION_TAGS[i]).join(', ');
  const posShift = contentHash('e4-spord-pos', [salt]);
  return {
    typeId: 'spatial_ordering',
    text: ascending
      ? 'Какой порядок правильный — от самой маленькой фигуры к самой большой?'
      : 'Какой порядок правильный — от самой большой фигуры к самой маленькой?',
    params: { sizes },
    correctAnswer: correct,
    choices: rotate([correct, decoy1, decoy2], posShift),
  };
}

function buildSpatialOrderingTopic(): TopicSpec {
  const sizeSets: [number, number, number][] = [
    [20, 40, 60], [60, 20, 40], [30, 70, 50], [50, 30, 70], [25, 55, 40],
    [45, 25, 65], [35, 65, 50], [55, 35, 20], [40, 60, 25], [65, 45, 30],
  ];
  const group = buildGroup(
    'space_ordering',
    'Разложи по порядку',
    sizeSets.map((sizes, i) => spatialOrderingTask(sizes, i)),
  );
  return { id: 'top_space_ordering', name: 'Пространство: по порядку', groups: [group] };
}

// ─── Схемы и карты | координаты ──────────────────────────────────────────

const GRID_COLS = ['А', 'Б', 'В', 'Г', 'Д'];

function gridCoordinatesTask(col: number, row: number, salt: number): Omit<Task, 'id'> {
  const correct = `${GRID_COLS[col]}${row + 1}`;
  const decoyPool: string[] = [];
  for (let c = 0; c < 5; c++) {
    for (let r = 0; r < 5; r++) {
      const label = `${GRID_COLS[c]}${r + 1}`;
      if (label !== correct) decoyPool.push(label);
    }
  }
  const d1Idx = contentHash('e4-grid-d1', [salt]) % decoyPool.length;
  const d1 = decoyPool[d1Idx];
  const rest = decoyPool.filter((v) => v !== d1);
  const d2 = rest[contentHash('e4-grid-d2', [salt]) % rest.length];
  const posShift = contentHash('e4-grid-pos', [salt]);
  return {
    typeId: 'grid_coordinates',
    text: 'Какие координаты у отмеченной клетки?',
    params: { col, row },
    correctAnswer: correct,
    choices: rotate([correct, d1, d2], posShift),
  };
}

function buildGridCoordinatesTopic(): TopicSpec {
  const cells: [number, number][] = [
    [0, 0], [4, 4], [2, 2], [1, 3], [3, 1], [0, 4], [4, 0], [2, 0], [0, 2], [3, 3],
  ];
  const group = buildGroup(
    'space_coordinates',
    'Координаты на сетке',
    cells.map(([c, r], i) => gridCoordinatesTask(c, r, i)),
  );
  return { id: 'top_space_coordinates', name: 'Схемы и карты: координаты', groups: [group] };
}

// ─── Сборка ─────────────────────────────────────────────────────────────

export const FR022_GROUP2_TOPICS: TopicSpec[] = [
  buildCountAddTopic(),
  buildCountSubtractTopic(),
  buildClockTopic(),
  buildMassMeasurementTopic(),
  buildRightAngleTopic(),
  buildShapeNamingTopic(),
  buildShapePropertiesTopic(),
  buildSolidNamingTopic(),
  buildSolidPropertiesTopic(),
  buildSpatialPositionTopic(),
  buildSpatialDirectionTopic(),
  buildSpatialOrderingTopic(),
  buildGridCoordinatesTopic(),
];

export function countFR022Group2Tasks(): number {
  return FR022_GROUP2_TOPICS.reduce(
    (sum, topic) => sum + topic.groups.reduce((s, g) => s + g.tasks.length, 0),
    0,
  );
}

const ARITHMETIC_SECTION_ID = 'sec_arithmetic';

export function mergeIntoContent(content: MathMachineContent): MathMachineContent {
  return mergeWaveIntoContent(content, FR022_GROUP2_TOPICS, ARITHMETIC_SECTION_ID);
}
