// packages/editor-web/src/chronoTemplates.ts
// Читает packages/chrono-templates/*.json на этапе СВОЕЙ сборки (относительный
// путь до соседнего пакета, без symlink/npm-зависимости — см.
// packages/chrono-templates/README.md). Файл на диске — недоверенный вход,
// как и любой JSON с границы системы: обязателен parseChronoProject(), а не
// прямой JSON.parse().
//
// import.meta.glob не поддерживает Vite alias в паттерне (сам паттерн строки
// разбирается отдельным плагином на этапе сборки, а не через resolve.alias) —
// поэтому путь здесь относительный, а не '@chrono-templates/...'.

import { parseChronoProject, type ChronoProject } from '@kiosk/shared';

const modules = import.meta.glob('../../chrono-templates/*.json', { eager: true, import: 'default' }) as Record<
  string,
  unknown
>;

export interface ChronoTemplate {
  fileName: string;
  project: ChronoProject;
}

// Битый шаблон валит сборку/dev-старт, а не пропускается молча — это и есть
// дешёвая проверка содержимого packages/chrono-templates при каждой сборке.
function loadTemplates(): ChronoTemplate[] {
  return Object.keys(modules)
    .sort()
    .map((path) => ({
      fileName: path.split('/').pop() ?? path,
      project: parseChronoProject(modules[path]),
    }));
}

export const CHRONO_TEMPLATES: ChronoTemplate[] = loadTemplates();
