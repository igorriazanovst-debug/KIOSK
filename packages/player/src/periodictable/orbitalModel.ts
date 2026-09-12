// packages/player/src/periodictable/orbitalModel.ts
// Парсинг уже готовой, научно выверенной строки electronConfiguration
// (например "[Xe] 4f7 5d1 6s2") в структуру для 3D-визуализации орбиталей.
// Ничего не ВЫЧИСЛЯЕТ по номеру элемента (порядок заполнения, исключения
// вроде Cr/Cu/Pd/La) — вся химия уже корректно зафиксирована в данных
// (см. elements.json), парсер только читает готовую строку. Это
// сознательное решение: пересчитывать заполнение орбиталей заново — риск
// разойтись с уже провере нными 18 характеристиками того же элемента.

export type Subshell = 's' | 'p' | 'd' | 'f';

export interface OrbitalGroup {
  n: number;
  subshell: Subshell;
  electronCount: number;
}

export interface ParsedElectronConfiguration {
  // Метка инертного газа-остова ("Xe" и т.п.) — сами электроны остова НЕ
  // разворачиваются в отдельные подоболочки и не визуализируются по
  // отдельности (см. ADR в комментарии ниже), только валентные группы.
  coreLabel: string | null;
  valenceGroups: OrbitalGroup[];
}

const SUBSHELL_TOKEN_RE = /^(\d+)([spdf])(\d+)$/;
const CORE_PREFIX_RE = /^\[(\w+)\]\s*/;
// Годится для срезки ЛЮБОЙ хвостовой сноски в круглых скобках (например
// "(расчётная)" у сверхтяжёлых 109-118) — с квадратными скобками остова
// не конфликтует, это разные символы.
const TRAILING_ANNOTATION_RE = /\s*\([^)]*\)\s*$/;

/**
 * Разбирает строку вида "[Xe] 4f7 5d1 6s2" или "1s1" (без остова — H/He).
 *
 * Почему рисуем только то, что явно перечислено ПОСЛЕ остова (или всю
 * строку для H/He), а не разворачиваем остов в полный список подоболочек:
 * компактная запись электронной конфигурации в химии существует именно
 * для того, чтобы отделить «ядро, электронно неинтересное» от «валентные
 * электроны, которые определяют химию элемента» — та же граница, что уже
 * проведена в исходных данных, а не придуманная заново для визуализации.
 * Для тяжёлых элементов (Og: 4 валентные группы) это также держит сцену
 * читаемой — полное разворачивание дало бы неотрисовываемую кашу орбиталей
 * без дополнительной пользы для музейного экспоната.
 */
export function parseElectronConfiguration(raw: string): ParsedElectronConfiguration {
  const withoutAnnotation = raw.replace(TRAILING_ANNOTATION_RE, '').trim();
  const coreMatch = withoutAnnotation.match(CORE_PREFIX_RE);
  const coreLabel = coreMatch ? coreMatch[1] : null;
  const remainder = coreMatch ? withoutAnnotation.slice(coreMatch[0].length) : withoutAnnotation;

  const valenceGroups: OrbitalGroup[] = [];
  for (const token of remainder.split(/\s+/).filter(Boolean)) {
    const m = token.match(SUBSHELL_TOKEN_RE);
    if (!m) continue; // неизвестный токен — пропускаем, не рушим весь разбор ради одной визуализации
    valenceGroups.push({ n: Number(m[1]), subshell: m[2] as Subshell, electronCount: Number(m[3]) });
  }

  return { coreLabel, valenceGroups };
}
