// packages/player/src/periodictable/explorationAchievements.ts
// Достижения "трекера исследования" считаются ЧИСТО из данных + множества
// изученных atomicNumber — никакого нового контента на 118 элементов не
// требуется (в отличие от, например, исторических фактов), поэтому это
// не тот же класс риска, что расширение справочника новыми полями.

import type { PeriodicElement } from './model/schema.ts';

export interface Achievement {
  id: string;
  label: string;
  total: number;
  exploredCount: number;
  completed: boolean;
}

interface AchievementDef {
  id: string;
  label: string;
  matches: (el: PeriodicElement) => boolean;
}

const ACHIEVEMENT_DEFS: AchievementDef[] = [
  { id: 'class-metal', label: 'Все металлы', matches: (el) => el.elementClass === 'metal' },
  { id: 'class-metalloid', label: 'Все металлоиды', matches: (el) => el.elementClass === 'metalloid' },
  { id: 'class-nonmetal', label: 'Все неметаллы', matches: (el) => el.elementClass === 'nonmetal' },
  { id: 'electron-s', label: 'Все s-элементы', matches: (el) => el.electronType === 's' },
  { id: 'electron-p', label: 'Все p-элементы', matches: (el) => el.electronType === 'p' },
  { id: 'electron-d', label: 'Все d-элементы', matches: (el) => el.electronType === 'd' },
  { id: 'electron-f', label: 'Все f-элементы', matches: (el) => el.electronType === 'f' },
];

export function computeAchievements(elements: PeriodicElement[], explored: Set<number>): Achievement[] {
  return ACHIEVEMENT_DEFS.map((def) => {
    const group = elements.filter(def.matches);
    const exploredCount = group.filter((el) => explored.has(el.atomicNumber)).length;
    return {
      id: def.id,
      label: def.label,
      total: group.length,
      exploredCount,
      completed: group.length > 0 && exploredCount === group.length,
    };
  });
}
