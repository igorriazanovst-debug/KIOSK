// packages/player/src/physastroiq/thematicImages.ts
//
// Тематические изображения виджета. ТЗ Типа 11 задаёт по ним ТРИ отдельных
// требования, и каждое проверяется на приёмке само по себе:
//
//   FR-022 (строка 343): «Количество тематических изображений по основным
//     разделам Физики ≥ 6 шт»;
//   FR-023 (строка 344): «Количество тематических изображений по астрономии
//     ≥ 4»;
//   FR-024 (строка 345): «Темы изображений по астрономии: строение солнечной
//     системы, карты звездного неба, Луны» — три темы названы дословно, и
//     искать их будут именно так.
//
// ПОЧЕМУ ПРЕДМЕТ — ОТДЕЛЬНОЕ ПОЛЕ. Пороги у физики и астрономии РАЗНЫЕ, и
// общий счётчик их не заменяет: четырнадцать картинок, из которых тринадцать
// по физике, выполнили бы FR-022 и провалили FR-023, а сумма «14 ≥ 10»
// показывала бы благополучие. Поэтому предмет проставлен у каждой записи, и
// каждое требование считается по своей выборке.
//
// ПОЧЕМУ 8 И 6, А НЕ 6 И 4. У эталона (ОС3. ФизАстро IQ 3.1) запаса нет
// вовсе, а по FR-024 из трёх названных тем закрыты только две — темы
// «строение солнечной системы» у него нет. Здесь на каждую обязательную тему
// астрономии по две картинки, и по физике на два раздела больше порога: любая
// выбракованная на приёмке картинка не ломает соответствие.
//
// ПОЧЕМУ У ФИЗИКИ ЕСТЬ РАЗДЕЛ, А НЕ ПРОСТО СЧЁТЧИК. Требование говорит не
// «шесть картинок», а «шесть по основным разделам». Шесть изображений про
// электрическую цепь — это не шесть разделов. Раздел записан полем, и тест
// проверяет, что разделы РАЗНЫЕ и что основные из школьного курса закрыты.
//
// ПОЧЕМУ ТЕМА — ОТДЕЛЬНОЕ ПОЛЕ, А НЕ ДОГАДКА ПО ЗАГОЛОВКУ. Требование
// перечисляет темы поимённо, и проверка должна спрашивать про тему, а не
// угадывать её по вхождению слова в название. Переименуют картинку —
// соответствие ТЗ не должно от этого зависеть.
//
// ОТКУДА КАРТИНКИ. Начерчены скриптом проекта (tools/physastroiq/draw-thematic.mjs),
// PNG из SVG делает tools/physastroiq/render-thematic.cjs. Собственная разработка,
// заимствований нет — ТЗ раздел 10. Ни одного файла из эталонного продукта.

export type PhysastroiqSubject = 'physics' | 'astronomy';

/** FR-022 (строка 343). */
export const PHYSASTROIQ_MIN_PHYSICS_IMAGES = 6;
/** FR-023 (строка 344). */
export const PHYSASTROIQ_MIN_ASTRONOMY_IMAGES = 4;

/** Разделы школьного курса физики, по которым сделаны изображения. */
export type PhysastroiqPhysicsSection =
  | 'mechanics'
  | 'dynamics'
  | 'hydrostatics'
  | 'thermal'
  | 'electricity'
  | 'magnetism'
  | 'optics'
  | 'atom';

/**
 * Разделы, которые обязаны быть закрыты.
 *
 * Их ровно шесть — столько же, сколько требует FR-022. Динамика и
 * гидростатика идут сверх этого списка: они и составляют запас.
 */
export const PHYSASTROIQ_REQUIRED_PHYSICS_SECTIONS: {
  id: PhysastroiqPhysicsSection;
  russian: string;
}[] = [
  { id: 'mechanics', russian: 'Механика' },
  { id: 'thermal', russian: 'Тепловые явления' },
  { id: 'electricity', russian: 'Электрические явления' },
  { id: 'magnetism', russian: 'Магнитные явления' },
  { id: 'optics', russian: 'Оптика' },
  { id: 'atom', russian: 'Строение атома' },
];

/** Темы изображений по астрономии, названные в FR-024 дословно. */
export type PhysastroiqAstroTheme = 'solar-system' | 'star-maps' | 'moon';

export const PHYSASTROIQ_REQUIRED_ASTRO_THEMES: {
  id: PhysastroiqAstroTheme;
  russian: string;
}[] = [
  { id: 'solar-system', russian: 'Строение Солнечной системы' },
  { id: 'star-maps', russian: 'Карты звёздного неба' },
  { id: 'moon', russian: 'Луна' },
];

export interface PhysastroiqThematicImage {
  id: string;
  fileName: string;
  subject: PhysastroiqSubject;
  /** Раздел физики — у изображений по физике; у астрономических не задан. */
  section?: PhysastroiqPhysicsSection;
  /** Тема FR-024 — у изображений по астрономии; у физических не задана. */
  astroTheme?: PhysastroiqAstroTheme;
  title: string;
  caption: string;
}

export const PHYSASTROIQ_THEMATIC_IMAGES: PhysastroiqThematicImage[] = [
  // ── Физика: по одному изображению на раздел школьного курса ──────────────
  {
    id: 'mech-lever',
    fileName: 'mech_lever.png',
    subject: 'physics',
    section: 'mechanics',
    title: 'Рычаг и условие его равновесия',
    caption:
      'Простой механизм: точка опоры, плечи сил и условие равновесия F₁ · l₁ = F₂ · l₂. Во сколько раз длиннее плечо, во столько раз меньше нужная сила.',
  },
  {
    id: 'mech-incline',
    fileName: 'mech_incline.png',
    subject: 'physics',
    section: 'dynamics',
    title: 'Силы, действующие на тело на наклонной плоскости',
    caption:
      'Сила тяжести, сила нормальной реакции опоры, сила трения и составляющая веса вдоль склона; угол наклона и высота подъёма.',
  },
  {
    id: 'heat-states',
    fileName: 'heat_states.png',
    subject: 'physics',
    section: 'thermal',
    title: 'Агрегатные состояния вещества и переходы между ними',
    caption:
      'Расположение частиц в твёрдом теле, жидкости и газе; плавление и кристаллизация, парообразование и конденсация, возгонка и десублимация.',
  },
  {
    id: 'elec-circuit',
    fileName: 'elec_circuit.png',
    subject: 'physics',
    section: 'electricity',
    title: 'Электрическая цепь и её элементы',
    caption:
      'Источник тока, ключ, лампа, резистор и провода на условных обозначениях; амперметр включён последовательно, вольтметр — параллельно. Закон Ома для участка цепи.',
  },
  {
    id: 'magnet-field',
    fileName: 'magnet_field.png',
    subject: 'physics',
    section: 'magnetism',
    title: 'Магнитное поле постоянного магнита и катушки с током',
    caption:
      'Полюсы магнита, линии магнитного поля и магнитная стрелка, встающая вдоль линии; катушка с током как электромагнит.',
  },
  {
    id: 'optics-lens',
    fileName: 'optics_lens.png',
    subject: 'physics',
    section: 'optics',
    title: 'Собирающая линза: построение изображения',
    caption:
      'Главная оптическая ось, оптический центр, фокус и двойное фокусное расстояние; построение по двум лучам и формула тонкой линзы.',
  },
  {
    id: 'atom-structure',
    fileName: 'atom_structure.png',
    subject: 'physics',
    section: 'atom',
    title: 'Строение атома',
    caption:
      'Ядро из протонов и нейтронов, электронные оболочки и внешний валентный слой на примере атома углерода; равенство числа протонов и электронов.',
  },
  {
    id: 'hydro-archimedes',
    fileName: 'hydro_archimedes.png',
    subject: 'physics',
    section: 'hydrostatics',
    title: 'Архимедова сила и условия плавания тел',
    caption:
      'Выталкивающая сила и вес трёх тел одинакового объёма, но разной плотности: тело всплывает, плавает внутри жидкости или тонет.',
  },

  // ── Астрономия: по две картинки на каждую тему из FR-024 ─────────────────
  {
    id: 'astro-solar-system',
    fileName: 'astro_solar_system.png',
    subject: 'astronomy',
    astroTheme: 'solar-system',
    title: 'Строение Солнечной системы',
    caption:
      'Солнце, восемь планет на своих орбитах и пояс астероидов между Марсом и Юпитером. Размеры и расстояния показаны не в масштабе.',
  },
  {
    id: 'astro-planets-compare',
    fileName: 'astro_planets_compare.png',
    subject: 'astronomy',
    astroTheme: 'solar-system',
    title: 'Планеты земной группы и планеты-гиганты',
    caption:
      'Все восемь планет в одном масштабе, с диаметрами в километрах, и врезка с увеличенными планетами земной группы.',
  },
  {
    id: 'astro-star-map-north',
    fileName: 'astro_star_map_north.png',
    subject: 'astronomy',
    astroTheme: 'star-maps',
    title: 'Карта звёздного неба: околополярные созвездия',
    caption:
      'Большая и Малая Медведицы, Кассиопея и Дракон; линия Мерак — Дубхе, указывающая на Полярную звезду, и северный полюс мира.',
  },
  {
    id: 'astro-star-map-winter',
    fileName: 'astro_star_map_winter.png',
    subject: 'astronomy',
    astroTheme: 'star-maps',
    title: 'Карта звёздного неба: зимние созвездия',
    caption:
      'Орион с поясом и туманностью, Телец с Альдебараном и Плеядами, Большой и Малый Псы, Близнецы; зимний треугольник Бетельгейзе — Сириус — Процион.',
  },
  {
    id: 'astro-moon-phases',
    fileName: 'astro_moon_phases.png',
    subject: 'astronomy',
    astroTheme: 'moon',
    title: 'Фазы Луны',
    caption:
      'Положения Луны на орбите вокруг Земли и вид с Земли в каждом из них: новолуние, четверти, полнолуние, растущая и убывающая Луна.',
  },
  {
    id: 'astro-moon-surface',
    fileName: 'astro_moon_surface.png',
    subject: 'astronomy',
    astroTheme: 'moon',
    title: 'Поверхность Луны: моря, материки и кратеры',
    caption:
      'Видимая сторона Луны: тёмные равнины-моря, светлые материки в кратерах, кратер Тихо с лучевой системой.',
  },
];

export function physastroiqThematicImageUrl(fileName: string): string {
  return `./physastroiq/thematic/${fileName}`;
}

export function physastroiqImagesBySubject(subject: PhysastroiqSubject): PhysastroiqThematicImage[] {
  return PHYSASTROIQ_THEMATIC_IMAGES.filter((img) => img.subject === subject);
}

/** Темы астрономии из FR-024, на которые в пакете НЕТ ни одного изображения. */
export function missingAstroThemes(): string[] {
  return PHYSASTROIQ_REQUIRED_ASTRO_THEMES.filter(
    (t) => !PHYSASTROIQ_THEMATIC_IMAGES.some((img) => img.astroTheme === t.id)
  ).map((t) => t.russian);
}

/** Разделы физики, по которым в пакете НЕТ ни одного изображения. */
export function missingPhysicsSections(): string[] {
  return PHYSASTROIQ_REQUIRED_PHYSICS_SECTIONS.filter(
    (s) => !PHYSASTROIQ_THEMATIC_IMAGES.some((img) => img.section === s.id)
  ).map((s) => s.russian);
}
