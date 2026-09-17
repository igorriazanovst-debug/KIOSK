// packages/player/src/bioiq/questionThemeImages.ts
//
// Изображение к каждому вопросу (FR-009, FR-016): нейтральная картинка по
// ТЕМЕ, общая на все вопросы темы. То же решение и по той же причине, что у
// «ХимIQ» (chimiq/questionThemeImages.ts): персональная иллюстрация под ответ
// его выдаёт. У «БиоIQ» ограничение жёстче — ответ ищут на схеме по форме,
// поэтому на картинках нет ни одной структуры, которая бывает ответом (см.
// tools/bioiq/draw-question-themes.mjs).
//
// Путь — плоский относительный в public/, а не bioiqmedia://: тот протокол
// смотрит в папку викторин учителя, а не в поставку.

const THEME_IMAGE_FILE: Record<string, string> = {
  'Строение клетки': 'cell-structure.png',
  'Органоиды': 'organelles.png',
  'Растительная и животная клетка': 'plant-vs-animal.png',
  'Органы растения': 'plant-organs.png',
  'Лист': 'leaf.png',
  'Цветок': 'flower.png',
  'Семя': 'seed.png',
  'Дыхательная система': 'respiratory.png',
  'Кровообращение': 'circulation.png',
  'Пищеварительная система': 'digestive.png',
  'Выделительная система': 'excretory.png',
};

export const BIOIQ_QUESTION_THEMES: string[] = Object.keys(THEME_IMAGE_FILE);

export function questionThemeImageUrl(theme: string): string | null {
  const fileName = THEME_IMAGE_FILE[theme];
  return fileName ? `./bioiq/questionThemes/${fileName}` : null;
}
