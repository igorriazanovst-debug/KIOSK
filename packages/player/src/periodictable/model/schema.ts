// zod-схема данных виджета «Таблица Менделеева» (Тип 8) — единственная
// точка, через которую проходит справочный контент (118 элементов). Тот же
// принцип, что у mathmachine/rusiq model/schema.ts. Размещено в
// packages/player (не packages/shared) сознательно — см. Global Constraints
// плана: у packages/shared нет подключённого npm test.

import { z } from 'zod';

export const PERIODICTABLE_CONTENT_SCHEMA_VERSION = 1 as const;

export const ElementClassSchema = z.enum(['metal', 'metalloid', 'nonmetal']);
export type ElementClass = z.infer<typeof ElementClassSchema>;

export const ElectronTypeSchema = z.enum(['s', 'p', 'd', 'f']);
export type ElectronType = z.infer<typeof ElectronTypeSchema>;

export const OxideCharacterSchema = z.enum(['acidic', 'basic', 'amphoteric', 'none']);
export type OxideCharacter = z.infer<typeof OxideCharacterSchema>;

export const PeriodicElementSchema = z.object({
  atomicNumber: z.number().int().min(1).max(118),
  symbol: z.string().min(1).max(3),
  nameRu: z.string().min(1),
  nameLatin: z.string().min(1),
  atomicMass: z.number().positive(),

  period: z.number().int().min(1).max(7),
  // null ТОЛЬКО для лантаноидов/актиноидов, вынесенных в отдельную
  // строку-«подвал» (Ce..Lu = 58..71, Th..Lr = 90..103) — сам лантан (57) и
  // актиний (89) занимают место в основной сетке и обязаны иметь groupIupac
  // (проверяется в superRefine ниже).
  groupIupac: z.number().int().min(1).max(18).nullable(),
  isLanthanide: z.boolean(),
  isActinide: z.boolean(),

  // Классификация FR-006
  electronType: ElectronTypeSchema,
  elementClass: ElementClassSchema,
  oxideCharacter: OxideCharacterSchema,

  // Остальные характеристики FR-005 (18 всего, см. разд. 4 спеки)
  electronConfiguration: z.string().min(1),
  naturalOccurrence: z.string(),
  physicalStateNormal: z.string().min(1),
  crystalLattice: z.string(),
  allotropes: z.string(),
  stableIsotopes: z.string(),
  electrochemicalSeriesPosition: z.string().nullable(),
  density: z.number().nonnegative().nullable(),
  meltingPointK: z.number().nonnegative().nullable(),
  boilingPointK: z.number().nonnegative().nullable(),
  oxidationStates: z.string(),
  electronegativityPauling: z.number().nonnegative().nullable(),

  photo: z.object({ fileName: z.string().min(1) }).nullable(),
});
export type PeriodicElement = z.infer<typeof PeriodicElementSchema>;

function isFooterElement(el: PeriodicElement): boolean {
  return (el.isLanthanide && el.atomicNumber !== 57) || (el.isActinide && el.atomicNumber !== 89);
}

const PeriodicTableContentShapeSchema = z.object({
  schemaVersion: z.literal(PERIODICTABLE_CONTENT_SCHEMA_VERSION),
  elements: z.array(PeriodicElementSchema),
});

export const PeriodicTableContentSchema = PeriodicTableContentShapeSchema.superRefine((content, ctx) => {
  const seenNumbers = new Set<number>();
  content.elements.forEach((el, idx) => {
    if (seenNumbers.has(el.atomicNumber)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['elements', idx, 'atomicNumber'],
        message: `duplicate atomicNumber ${el.atomicNumber} (${el.symbol})`,
      });
    }
    seenNumbers.add(el.atomicNumber);

    if (!isFooterElement(el) && el.groupIupac === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['elements', idx, 'groupIupac'],
        message: `${el.symbol} (${el.atomicNumber}): groupIupac is required for a main-grid element`,
      });
    }
  });
});
export type PeriodicTableContent = z.infer<typeof PeriodicTableContentShapeSchema>;

export { isFooterElement };
