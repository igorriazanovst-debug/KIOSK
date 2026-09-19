// packages/player/src/physastroiq/questionThemeImages.ts
//
// Изображение к каждому вопросу (FR-009, FR-016): нейтральная картинка по
// ТЕМЕ, общая на все вопросы темы. То же решение и по той же причине, что у
// «ХимIQ» и «БиоIQ» (bioiq/questionThemeImages.ts): персональная иллюстрация
// под ответ его выдаёт. Ответ здесь ищут на карте по виду объекта, поэтому на
// эмблемах нет ни одного объекта, который бывает ответом (см.
// tools/physastroiq/draw-question-themes.mjs).
//
// Тем восемнадцать: по девять у каждого предмета. Названия тем у физики и
// астрономии не пересекаются — за этим следит тест, иначе одна картинка
// молча обслуживала бы оба предмета.
//
// Путь — плоский относительный в public/, а не physastroiqmedia://: тот
// протокол смотрит в папку викторин учителя, а не в поставку.

const THEME_IMAGE_FILE: Record<string, string> = {
  // Физика
  'Электрическая цепь': 'phys-circuit.png',
  'Действия электрического тока': 'phys-current-effects.png',
  'Измерительные приборы': 'phys-measuring.png',
  'Простые механизмы': 'phys-machines.png',
  'Силы и равновесие': 'phys-forces.png',
  'Колебания': 'phys-oscillations.png',
  'Линзы и изображение': 'phys-lenses.png',
  'Отражение света': 'phys-reflection.png',
  'Преломление и дисперсия': 'phys-refraction.png',
  // Астрономия
  'Планеты': 'astro-planets.png',
  'Строение Солнечной системы': 'astro-solar-system.png',
  'Малые тела': 'astro-small-bodies.png',
  'Созвездия': 'astro-constellations.png',
  'Яркие звёзды': 'astro-bright-stars.png',
  'Ориентирование на небе': 'astro-orientation.png',
  'Земля и Луна': 'astro-earth-moon.png',
  'Фазы и затмения': 'astro-phases-eclipses.png',
  'Поверхность Луны': 'astro-moon-surface.png',
};

export const PHYSASTROIQ_QUESTION_THEMES: string[] = Object.keys(THEME_IMAGE_FILE);

export function questionThemeImageUrl(theme: string): string | null {
  const fileName = THEME_IMAGE_FILE[theme];
  return fileName ? `./physastroiq/questionThemes/${fileName}` : null;
}
