// packages/player/src/bioiq/thematicImages.ts
//
// FR-022 ТЗ 10 (строка 316): «количество тематических изображений по биологии
// ≥ 3 шт». FR-023 (строка 317): «темы изображений: внутренние органы,
// растения, клетки» — три темы названы дословно, и на приёмке их будут искать
// именно так.
//
// ПОЧЕМУ ШЕСТЬ, А НЕ ТРИ. У эталона (ОС3. Био IQ 3.1) изображений ровно три
// при требовании «не меньше трёх»: любое выбракованное на приёмке ломает
// соответствие. Здесь на каждую обязательную тему по две картинки — запас,
// как сделано в Типах 2, 3 и 4.
//
// ПОЧЕМУ ТЕМА — ОТДЕЛЬНОЕ ПОЛЕ, А НЕ ДОГАДКА ПО ЗАГОЛОВКУ. Требование
// перечисляет темы поимённо, и проверка должна спрашивать про тему, а не
// угадывать её по вхождению слова в название. Переименуют картинку —
// соответствие ТЗ не должно от этого зависеть.
//
// ОТКУДА КАРТИНКИ. Начерчены скриптом проекта (tools/bioiq/draw-thematic.mjs),
// PNG из SVG делает tools/bioiq/render-thematic.cjs. Собственная разработка,
// заимствований нет — ТЗ раздел 10. Ни одного файла из эталонного продукта.

/** Темы изображений, названные в FR-023 дословно. */
export type BioiqImageTheme = 'organs' | 'plants' | 'cells';

export const BIOIQ_REQUIRED_THEMES: { id: BioiqImageTheme; russian: string }[] = [
  { id: 'organs', russian: 'Внутренние органы' },
  { id: 'plants', russian: 'Растения' },
  { id: 'cells', russian: 'Клетки' },
];

export interface BioiqThematicImage {
  id: string;
  fileName: string;
  theme: BioiqImageTheme;
  title: string;
  caption: string;
}

export const BIOIQ_THEMATIC_IMAGES: BioiqThematicImage[] = [
  {
    id: 'organs-torso',
    fileName: 'organs_torso.png',
    theme: 'organs',
    title: 'Внутренние органы человека',
    caption:
      'Расположение органов грудной и брюшной полости: трахея, лёгкие, сердце, диафрагма, печень, желудок, селезёнка, поджелудочная железа, почки, кишечник, мочевой пузырь.',
  },
  {
    id: 'organs-heart',
    fileName: 'organs_heart.png',
    theme: 'organs',
    title: 'Строение сердца',
    caption:
      'Четыре камеры и крупные сосуды: предсердия и желудочки, клапаны между ними, аорта, лёгочный ствол, полые и лёгочные вены, межжелудочковая перегородка.',
  },
  {
    id: 'plant-structure',
    fileName: 'plant_structure.png',
    theme: 'plants',
    title: 'Строение цветкового растения',
    caption:
      'Органы растения целиком: корень главный и боковые, корневая шейка, стебель, листья, бутон, цветок и плод.',
  },
  {
    id: 'plant-flower',
    fileName: 'plant_flower.png',
    theme: 'plants',
    title: 'Строение цветка',
    caption:
      'Цветок в разрезе: цветоножка и цветоложе, чашелистики, лепестки, тычинки (нить и пыльник), пестик — рыльце, столбик, завязь с семязачатками.',
  },
  {
    id: 'cell-animal',
    fileName: 'cell_animal.png',
    theme: 'cells',
    title: 'Строение животной клетки',
    caption:
      'Мембрана, цитоплазма, ядро с ядрышком, митохондрии, эндоплазматическая сеть с рибосомами, аппарат Гольджи, лизосомы, клеточный центр.',
  },
  {
    id: 'cell-plant',
    fileName: 'cell_plant.png',
    theme: 'cells',
    title: 'Строение растительной клетки',
    caption:
      'Отличия от животной клетки: клеточная стенка поверх мембраны, крупная вакуоль с клеточным соком и хлоропласты.',
  },
];

export function bioiqThematicImageUrl(fileName: string): string {
  return `./bioiq/thematic/${fileName}`;
}

/** Темы FR-023, на которые в пакете НЕТ ни одного изображения. */
export function missingThematicThemes(): string[] {
  return BIOIQ_REQUIRED_THEMES.filter(
    (t) => !BIOIQ_THEMATIC_IMAGES.some((img) => img.theme === t.id)
  ).map((t) => t.russian);
}
