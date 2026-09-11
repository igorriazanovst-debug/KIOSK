// packages/player/src/periodictable/tableLayout.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getCellPosition, formatGroupLabel } from './tableLayout.ts';
import { PeriodicTableContentSchema } from './model/schema.ts';
import elementsJson from './content/elements.json' with { type: 'json' };

const { elements } = PeriodicTableContentSchema.parse(elementsJson);

test('main-grid short-form positions have no collisions', () => {
  const seen = new Set<string>();
  for (const el of elements) {
    const pos = getCellPosition(el, 'short');
    if (pos.row === 9 || pos.row === 10) continue; // footer rows checked separately below
    const key = `${pos.row}:${pos.col}`;
    assert.ok(!seen.has(key), `short form collision at ${key} (${el.symbol})`);
    seen.add(key);
  }
});

test('main-grid iupac-form positions have no collisions', () => {
  const seen = new Set<string>();
  for (const el of elements) {
    const pos = getCellPosition(el, 'iupac');
    if (pos.row === 9 || pos.row === 10) continue;
    const key = `${pos.row}:${pos.col}`;
    assert.ok(!seen.has(key), `iupac form collision at ${key} (${el.symbol})`);
    seen.add(key);
  }
});

test('lanthanide footer row (9) has exactly 14 unique columns, both forms agree', () => {
  const lnFooter = elements.filter((e) => e.isLanthanide && e.atomicNumber !== 57);
  const shortCols = new Set(lnFooter.map((e) => getCellPosition(e, 'short').col));
  const iupacCols = new Set(lnFooter.map((e) => getCellPosition(e, 'iupac').col));
  assert.equal(shortCols.size, 14);
  assert.equal(iupacCols.size, 14);
  assert.deepEqual([...shortCols].sort(), [...iupacCols].sort());
});

test('actinide footer row (10) has exactly 14 unique columns', () => {
  const acFooter = elements.filter((e) => e.isActinide && e.atomicNumber !== 89);
  const cols = new Set(acFooter.map((e) => getCellPosition(e, 'short').col));
  assert.equal(cols.size, 14);
});

test('formatGroupLabel renders roman numerals for short form and plain numbers for iupac', () => {
  assert.equal(formatGroupLabel(1, 'iupac'), '1');
  assert.equal(formatGroupLabel(1, 'short'), 'I');
  assert.equal(formatGroupLabel(11, 'short'), 'I'); // Cu/Ag/Au — traditional IB folds into column I
  assert.equal(formatGroupLabel(18, 'short'), 'VIII'); // noble gases — traditional group VIII/0
});
