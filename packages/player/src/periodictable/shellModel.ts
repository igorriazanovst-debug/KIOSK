// packages/player/src/periodictable/shellModel.ts
// Подсчёт электронов по ГЛАВНОМУ квантовому числу n (электронная "оболочка"
// K/L/M/N/...), а не по подоболочкам s/p/d/f — простая, наглядная модель
// атома (кольца-оболочки), которую источник (zperiod.app, открытый код:
// github.com/zhilips/zperiod, js/modules/threeRenderer.js) использует для
// показа атома при обычном просмотре элемента — TorusGeometry-кольца на
// радиусах по номеру оболочки, БЕЗ форм орбиталей. Прежний подход этого
// проекта (лепестковые s/p/d/f-формы, orbitalGeometry.ts, теперь удалён)
// был математически корректен (см. историю), но пользователь отметил, что
// источник читается понятнее именно ПОТОМУ, что проще — кольцо с
// электронами не требует знания квантовой химии, чтобы понять, на что
// смотришь.
//
// Переиспользует parseElectronConfiguration (orbitalModel.ts) — тот же
// разбор строки на токены "2s2" и т.п., просто применяется дважды: один
// раз к остову инертного газа (через готовую справочную строку ниже),
// один раз к самому элементу — и суммируется по n.

import { parseElectronConfiguration } from './orbitalModel.ts';

export interface ShellOccupancy {
  n: number;
  electronCount: number;
}

// Полные (не сокращённые) электронные конфигурации благородных газов —
// общеизвестный, неизменный научный факт (не предмет интерпретации, в
// отличие от аномалий заполнения у отдельных элементов вроде Cr/Cu) —
// безопасно использовать как справочную константу.
const NOBLE_GAS_FULL_CONFIG: Record<string, string> = {
  He: '1s2',
  Ne: '1s2 2s2 2p6',
  Ar: '1s2 2s2 2p6 3s2 3p6',
  Kr: '1s2 2s2 2p6 3s2 3p6 3d10 4s2 4p6',
  Xe: '1s2 2s2 2p6 3s2 3p6 3d10 4s2 4p6 4d10 5s2 5p6',
  Rn: '1s2 2s2 2p6 3s2 3p6 3d10 4s2 4p6 4d10 4f14 5s2 5p6 5d10 6s2 6p6',
};

/**
 * Считает суммарное число электронов на каждой оболочке (по n) для полной
 * электронной конфигурации элемента — включая остов (в отличие от
 * orbitalModel.parseElectronConfiguration, которая намеренно показывает
 * только валентные подоболочки).
 */
export function computeShellOccupancy(electronConfiguration: string): ShellOccupancy[] {
  const parsed = parseElectronConfiguration(electronConfiguration);
  const counts = new Map<number, number>();

  function addGroups(groups: { n: number; electronCount: number }[]): void {
    for (const g of groups) {
      counts.set(g.n, (counts.get(g.n) ?? 0) + g.electronCount);
    }
  }

  if (parsed.coreLabel) {
    const coreConfig = NOBLE_GAS_FULL_CONFIG[parsed.coreLabel];
    if (coreConfig) {
      addGroups(parseElectronConfiguration(coreConfig).valenceGroups);
    }
  }
  addGroups(parsed.valenceGroups);

  return [...counts.entries()]
    .map(([n, electronCount]) => ({ n, electronCount }))
    .sort((a, b) => a.n - b.n);
}
