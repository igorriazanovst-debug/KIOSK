// Этап 3 (2026-09-09) — Группа 1 покрытия FR-022 ТЗ: виды тем за пределами
// арифметики (величины/время/сравнение дробей), найденные при сверке кода
// с полным текстом ТЗ_06_Матемашка.docx — см. Тип6_бэклог.md, Эпик 30.
// Ранний проектный документ (mathmachine-content-pipeline-design.md,
// 2026-09-08) процитировал FR-022 не полностью — список видов тем в ТЗ
// продолжается за пределами арифметики (время/масса/объём/пространство/
// фигуры/тела/вращение/углы/симметрия/карты), эта ошибка транслировалась
// по всем последующим спекам и трассировочной матрице.
//
// Группа 1 — категории, которые ложатся на существующий движок «как
// есть» (choice-режим ответа, простой визуал или чисто текстовый вопрос):
// длина|сравнение (переиспользует существующий typeId compare_length,
// который был в движке, но ни разу не использован в реальном контенте
// каталога), масса|сравнение, объём|сравнение, время|дни недели,
// время|времена года, время|события, масса и объём|оценка,
// дроби|оценки.
//
// Качественные категории (время/события/оценки) не имеют естественного
// числового пространства параметров — контент авторский (см. решение
// пайплайна волн, разд. 1: «авторски — только структура»), а не
// процедурно генерируемый; contentHash используется только для порядка
// вариантов ответа (позиционная защита), не для самих фактов.

import type { Task } from '@kiosk/shared';
import type { MathMachineContent } from '@kiosk/shared';
import { buildGroup, rotate, contentHash, mergeWaveIntoContent, type TopicSpec } from './generatorShared.ts';

// ─── Длина | сравнение (переиспользует compare_length) ──────────────────

function compareLengthTask(seed: number): Omit<Task, 'id'> {
  const a = 2 + (seed % 9);
  const b = 2 + ((seed * 7 + 3) % 9);
  if (a === b) return compareLengthTask(seed + 1);
  const swap = contentHash('g1-length-swap-v0', [a, b]) % 2 === 0;
  const leftLength = swap ? b : a;
  const rightLength = swap ? a : b;
  const correctAnswer = leftLength > rightLength ? 'Первый' : 'Второй';
  const posShift = contentHash('g1-length-pos-v0', [leftLength, rightLength]);
  return {
    typeId: 'compare_length',
    text: 'Какой отрезок длиннее — первый или второй?',
    params: { leftLength, rightLength },
    correctAnswer,
    choices: rotate(['Первый', 'Второй'], posShift),
  };
}

function buildLengthTopic(): TopicSpec {
  const group = buildGroup(
    'measure_length',
    'Сравнение длин',
    Array.from({ length: 10 }, (_, i) => compareLengthTask(i * 3 + 1)),
  );
  return { id: 'top_measure_length', name: 'Длина: что длиннее', groups: [group] };
}

// ─── Масса | сравнение ────────────────────────────────────────────────

const MASS_PAIRS: [string, number, string, number][] = [
  ['Слон', 5000, 'Мышь', 0.02],
  ['Арбуз', 6, 'Виноградинка', 0.005],
  ['Грузовик', 8000, 'Велосипед', 12],
  ['Кит', 100000, 'Рыбка', 0.1],
  ['Кирпич', 3, 'Перо', 0.001],
  ['Медведь', 300, 'Кошка', 4],
  ['Диван', 40, 'Подушка', 0.5],
  ['Холодильник', 70, 'Кружка', 0.3],
  ['Лошадь', 500, 'Кролик', 2],
  ['Бревно', 50, 'Карандаш', 0.01],
];

// Найдено при независимом ревью (2026-09-09): нарицательные
// существительные внутри предложения писались с заглавной буквы
// («Что тяжелее: Слон или Мышь?») — реальная орфографическая ошибка,
// не просто стиль. В тексте вопроса — строчными; choices (подписи
// кнопок) остаются капитализированными — это отдельная, самостоятельно
// оправданная UI-конвенция (как и в других группах приложения), а не
// продолжение предложения.
function lowerFirst(s: string): string {
  return s.length > 0 ? s[0].toLowerCase() + s.slice(1) : s;
}

function compareMassTask(pair: [string, number, string, number], salt: number): Omit<Task, 'id'> {
  const [nameA, massA, nameB, massB] = pair;
  const posShift = contentHash('g1-mass-pos', [salt]);
  const swap = posShift % 2 === 0;
  const leftName = swap ? nameB : nameA;
  const rightName = swap ? nameA : nameB;
  const leftMass = swap ? massB : massA;
  const rightMass = swap ? massA : massB;
  const correct = massA > massB ? nameA : nameB;
  return {
    typeId: 'compare_mass',
    text: `Что тяжелее: ${lowerFirst(leftName)} или ${lowerFirst(rightName)}?`,
    params: { leftMass, rightMass },
    correctAnswer: correct,
    choices: [leftName, rightName],
  };
}

function buildMassTopic(): TopicSpec {
  const group = buildGroup(
    'measure_mass',
    'Сравнение массы',
    MASS_PAIRS.map((pair, i) => compareMassTask(pair, i)),
  );
  return { id: 'top_measure_mass', name: 'Масса: что тяжелее', groups: [group] };
}

// ─── Объём | сравнение ────────────────────────────────────────────────

// Напёрсток/пробирка/цистерна заменены при независимом ревью (2026-09-09)
// на более знакомые ребёнку 4-9 лет слова (чашка/маленький стакан/бак).
const VOLUME_PAIRS: [string, number, string, number][] = [
  ['Бассейн', 50000, 'Стакан', 0.25],
  ['Ванна', 150, 'Чайная ложка', 0.005],
  ['Бочка', 200, 'Чашка', 0.002],
  ['Озеро', 1000000, 'Лужа', 2],
  ['Ведро', 10, 'Кружка', 0.3],
  ['Аквариум', 60, 'Маленький стакан', 0.02],
  ['Бак для воды', 5000, 'Бутылка', 1.5],
  ['Кастрюля', 5, 'Столовая ложка', 0.015],
  ['Море', 10000000, 'Ведро', 10],
  ['Кувшин', 2, 'Флакон', 0.1],
];

function compareVolumeTask(pair: [string, number, string, number], salt: number): Omit<Task, 'id'> {
  const [nameA, volA, nameB, volB] = pair;
  const posShift = contentHash('g1-volume-pos', [salt]);
  const swap = posShift % 2 === 0;
  const leftName = swap ? nameB : nameA;
  const rightName = swap ? nameA : nameB;
  const leftVolume = swap ? volB : volA;
  const rightVolume = swap ? volA : volB;
  const correct = volA > volB ? nameA : nameB;
  return {
    typeId: 'compare_volume',
    // Именительный падеж без предлога — "в ванна"/"в бочка" грамматически
    // неверно (нужен винительный: "в ванну"/"в бочку"), а склонять по
    // родам для произвольного набора существительных ненадёжно.
    text: `Что вмещает больше воды: ${lowerFirst(leftName)} или ${lowerFirst(rightName)}?`,
    params: { leftVolume, rightVolume },
    correctAnswer: correct,
    choices: [leftName, rightName],
  };
}

function buildVolumeTopic(): TopicSpec {
  const group = buildGroup(
    'measure_volume',
    'Сравнение объёма',
    VOLUME_PAIRS.map((pair, i) => compareVolumeTask(pair, i)),
  );
  return { id: 'top_measure_volume', name: 'Объём: куда больше поместится', groups: [group] };
}

// ─── Время | дни недели ────────────────────────────────────────────────

const WEEKDAYS_CAP = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

function weekdayTask(dayIndex: number): Omit<Task, 'id'> {
  const nextIndex = (dayIndex + 1) % 7;
  const correct = WEEKDAYS_CAP[nextIndex];
  const decoyPool = WEEKDAYS_CAP.filter((_, i) => i !== nextIndex && i !== dayIndex);
  const d1Idx = contentHash('g1-weekday-d1', [dayIndex]) % decoyPool.length;
  const d1 = decoyPool[d1Idx];
  const rest = decoyPool.filter((v) => v !== d1);
  const d2 = rest[contentHash('g1-weekday-d2', [dayIndex]) % rest.length];
  const posShift = contentHash('g1-weekday-pos', [dayIndex]);
  return {
    typeId: 'weekday_order',
    // «Сегодня X. Какой день будет завтра?» — понятнее ребёнку, чем
    // формальное «после X», и не требует склонения по падежам.
    text: `Сегодня ${WEEKDAYS_CAP[dayIndex].toLowerCase()}. Какой день будет завтра?`,
    params: { dayIndex },
    correctAnswer: correct,
    choices: rotate([correct, d1, d2], posShift),
  };
}

function buildWeekdayTopic(): TopicSpec {
  const group = buildGroup(
    'time_weekday',
    'Дни недели по порядку',
    Array.from({ length: 7 }, (_, i) => weekdayTask(i)),
  );
  return { id: 'top_time_weekday', name: 'Время: дни недели', groups: [group] };
}

// ─── Время | времена года ──────────────────────────────────────────────

const SEASONS = ['Зима', 'Весна', 'Лето', 'Осень'];

function seasonTask(seasonIndex: number): Omit<Task, 'id'> {
  const nextIndex = (seasonIndex + 1) % 4;
  const correct = SEASONS[nextIndex];
  const decoyPool = SEASONS.filter((_, i) => i !== nextIndex && i !== seasonIndex);
  const posShift = contentHash('g1-season-pos', [seasonIndex]);
  return {
    typeId: 'season_order',
    // «Сейчас X. Какое время года будет следующим?» — тот же
    // конкретный, понятный ребёнку паттерн, что и в weekday_order.
    text: `Сейчас ${SEASONS[seasonIndex].toLowerCase()}. Какое время года будет следующим?`,
    params: { seasonIndex },
    correctAnswer: correct,
    choices: rotate([correct, ...decoyPool], posShift),
  };
}

function buildSeasonTopic(): TopicSpec {
  const group = buildGroup(
    'time_season',
    'Времена года по кругу',
    Array.from({ length: 4 }, (_, i) => seasonTask(i)),
  );
  return { id: 'top_time_season', name: 'Время: времена года', groups: [group] };
}

// ─── Время | события (что раньше/позже) ────────────────────────────────

// «Стройка дома»/«Новоселье» и «Посев»/«Урожай» заменены при независимом
// ревью (2026-09-09) — первое малознакомо детям 4-6 лет, второе почти
// дублирует смысл уже существующей пары «Посадка семени»/«Сбор урожая».
const EVENT_PAIRS: [string, string][] = [
  ['Восход солнца', 'Закат солнца'],
  ['Завтрак', 'Ужин'],
  ['Посадка семени', 'Сбор урожая'],
  ['Замес теста', 'Готовый пирог'],
  ['Утро', 'Вечер'],
  ['Детский сад', 'Школа'],
  ['Гусеница', 'Бабочка'],
  ['Яйцо', 'Птенец'],
  ['Дождь', 'Радуга'],
  ['Рассвет', 'Полдень'],
];

function eventTask(pair: [string, string], salt: number): Omit<Task, 'id'> {
  const [earlier, later] = pair;
  const posShift = contentHash('g1-event-pos', [salt]);
  const swap = posShift % 2 === 0;
  const left = swap ? later : earlier;
  const right = swap ? earlier : later;
  return {
    typeId: 'event_order',
    text: `Что бывает раньше: «${left}» или «${right}»?`,
    params: { pairIndex: salt },
    correctAnswer: earlier,
    choices: [left, right],
  };
}

function buildEventTopic(): TopicSpec {
  const group = buildGroup(
    'time_event',
    'Что было раньше',
    EVENT_PAIRS.map((pair, i) => eventTask(pair, i)),
  );
  return { id: 'top_time_event', name: 'Время: что было раньше', groups: [group] };
}

// ─── Масса и объём | оценка ─────────────────────────────────────────────

// Индексы 3 и 4 заменены при независимом ревью (2026-09-09) — были
// целиком про воду/жидкости ("ведро воды"/"океан"/"капля"), хотя вопрос
// спрашивает про "предметы" (дискретные объекты, не объём жидкости).
const ESTIMATE_ITEMS: [string, string, string, string][] = [
  ['яблоко', 'слон', 'перо', 'грузовик'],
  ['книга', 'дом', 'песчинка', 'корабль'],
  ['котёнок', 'кит', 'муравей', 'самолёт'],
  ['ведро', 'гора', 'пуговица', 'здание'],
  ['подушка', 'дом', 'скрепка', 'поезд'],
  ['рюкзак', 'гора', 'снежинка', 'айсберг'],
  ['мяч', 'планета', 'зёрнышко', 'астероид'],
  ['телефон', 'машина', 'пылинка', 'поезд'],
];

function estimateTask(items: [string, string, string, string], salt: number): Omit<Task, 'id'> {
  const [correct, big, tiny, huge] = items;
  const posShift = contentHash('g1-estimate-pos', [salt]);
  return {
    typeId: 'estimate_mass_volume',
    text: 'Какой из этих предметов ближе всего по размеру к обычной коробке из-под обуви?',
    params: { pairIndex: salt },
    correctAnswer: correct,
    choices: rotate([correct, big, tiny, huge], posShift),
  };
}

function buildEstimateTopic(): TopicSpec {
  const group = buildGroup(
    'measure_estimate',
    'Оцени размер на глаз',
    ESTIMATE_ITEMS.map((items, i) => estimateTask(items, i)),
  );
  return { id: 'top_measure_estimate', name: 'Величины: оцени на глаз', groups: [group] };
}

// ─── Дроби | оценки (сравнение дробей с одинаковым знаменателем) ─────────
// Топик назван с префиксом top_shares_*, чтобы естественно попасть в уже
// существующую категорию каталога «Доли целого» (topicCategories.ts) без
// правки самого файла категорий — тот же принцип, что byPrefix('shares')
// уже применяет ко всем top_shares_* темам.

function estimateFractionTask(denominator: number, numA: number, numB: number): Omit<Task, 'id'> {
  if (numA === numB) throw new Error(`estimateFractionTask: numerators equal for denominator ${denominator}`);
  const correctNum = Math.max(numA, numB);
  const correct = `${correctNum}/${denominator}`;
  const other = `${Math.min(numA, numB)}/${denominator}`;
  const posShift = contentHash('g1-fraction-pos', [denominator, numA, numB]);
  return {
    typeId: 'estimate_fraction',
    text: `Какая дробь больше: ${numA}/${denominator} или ${numB}/${denominator}?`,
    params: { denominator, numA, numB },
    correctAnswer: correct,
    choices: rotate([correct, other], posShift),
  };
}

function buildFractionCompareTopic(): TopicSpec {
  const pairs: [number, number, number][] = [
    [4, 1, 3], [4, 2, 3], [5, 1, 4], [5, 2, 3], [5, 3, 4],
    [6, 1, 5], [6, 2, 5], [8, 3, 5], [8, 1, 7], [10, 3, 7],
  ];
  const group = buildGroup(
    'shares_fraction_compare',
    'Сравнение дробей',
    pairs.map(([d, a, b]) => estimateFractionTask(d, a, b)),
  );
  return { id: 'top_shares_fraction_compare', name: 'Доли целого: сравнение дробей', groups: [group] };
}

// ─── Сборка ─────────────────────────────────────────────────────────────

export const FR022_GROUP1_TOPICS: TopicSpec[] = [
  buildLengthTopic(),
  buildMassTopic(),
  buildVolumeTopic(),
  buildWeekdayTopic(),
  buildSeasonTopic(),
  buildEventTopic(),
  buildEstimateTopic(),
  buildFractionCompareTopic(),
];

export function countFR022Group1Tasks(): number {
  return FR022_GROUP1_TOPICS.reduce(
    (sum, topic) => sum + topic.groups.reduce((s, g) => s + g.tasks.length, 0),
    0,
  );
}

const ARITHMETIC_SECTION_ID = 'sec_arithmetic';

export function mergeIntoContent(content: MathMachineContent): MathMachineContent {
  return mergeWaveIntoContent(content, FR022_GROUP1_TOPICS, ARITHMETIC_SECTION_ID);
}
