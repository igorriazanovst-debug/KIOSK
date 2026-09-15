// packages/player/src/bioiq/thematicImages.ts
//
// FR-020 ТЗ (строка 259): «Продукт должен содержать методические
// материалы в виде готовой игры-викторины и не менее 4-х тематических
// изображений по химии, содержащих как минимум: таблицу менделеева,
// химические эксперименты, строение атома». Это отдельные СОДЕРЖАТЕЛЬНЫЕ
// иллюстрации (не абстрактные текстовые сетки игрового поля из
// content/bioiqRealContent.json — те решают другую задачу, кликабельные
// зоны ответов) — найдено пропущенным при сверке с ТЗ 2026-09-15, до
// этого файла в продукте не было НИ ОДНОГО тематического изображения в
// этом смысле.

export interface BioiqThematicImage {
  id: string;
  fileName: string;
  title: string;
  caption: string;
}

export const BIOIQ_THEMATIC_IMAGES: BioiqThematicImage[] = [
  {
    id: 'periodic-table',
    fileName: 'periodic_table.png',
    title: 'Периодическая таблица химических элементов',
    caption: 'Все 118 элементов, сгруппированные по периодам и группам, с атомными номерами.',
  },
  {
    id: 'atom-structure',
    fileName: 'atom_structure.png',
    title: 'Строение атома',
    caption: 'Ядро (протоны и нейтроны) и электроны на электронных оболочках вокруг него.',
  },
  {
    id: 'experiment',
    fileName: 'experiment.png',
    title: 'Химический эксперимент',
    caption: 'Лабораторное оборудование: пробирка над горелкой, колба с раствором.',
  },
  {
    id: 'molecule',
    fileName: 'molecule.png',
    title: 'Химическое соединение: молекула воды',
    caption: 'Два атома водорода, соединённые с атомом кислорода ковалентной связью.',
  },
];

export function bioiqThematicImageUrl(fileName: string): string {
  return `./bioiq/thematic/${fileName}`;
}
