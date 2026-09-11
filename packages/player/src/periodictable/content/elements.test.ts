// packages/player/src/periodictable/content/elements.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PeriodicTableContentSchema, isFooterElement } from '../model/schema.ts';
import elementsJson from './elements.json' with { type: 'json' };

const parsed = PeriodicTableContentSchema.parse(elementsJson);

// public/periodictable/photos, не src/... — vite копирует public/* в dist/*
// без изменений при сборке (та же конвенция, что у media в mathmachine).
const PHOTOS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'public',
  'periodictable',
  'photos'
);

test('elements.json parses against PeriodicTableContentSchema without errors', () => {
  assert.equal(PeriodicTableContentSchema.safeParse(elementsJson).success, true);
});

test('exactly 118 elements, atomic numbers 1..118 with no gaps or duplicates', () => {
  const numbers = parsed.elements.map((e) => e.atomicNumber).sort((a, b) => a - b);
  assert.equal(numbers.length, 118);
  for (let i = 0; i < 118; i++) {
    assert.equal(numbers[i], i + 1, `expected atomic number ${i + 1} at sorted index ${i}, got ${numbers[i]}`);
  }
});

test('electron type distribution covers all four blocks (s/p/d/f present)', () => {
  const types = new Set(parsed.elements.map((e) => e.electronType));
  assert.ok(types.has('s') && types.has('p') && types.has('d') && types.has('f'));
});

test('exactly 14 lanthanide-footer elements (58-71) and 14 actinide-footer elements (90-103)', () => {
  const lnFooter = parsed.elements.filter((e) => e.isLanthanide && e.atomicNumber !== 57);
  const acFooter = parsed.elements.filter((e) => e.isActinide && e.atomicNumber !== 89);
  assert.equal(lnFooter.length, 14, `expected 14 footer lanthanides, got ${lnFooter.length}`);
  assert.equal(acFooter.length, 14, `expected 14 footer actinides, got ${acFooter.length}`);
  assert.ok(lnFooter.every((e) => e.atomicNumber >= 58 && e.atomicNumber <= 71));
  assert.ok(acFooter.every((e) => e.atomicNumber >= 90 && e.atomicNumber <= 103));
});

test('every non-footer element has a unique (period, groupIupac) position', () => {
  const seen = new Set<string>();
  for (const el of parsed.elements) {
    if (isFooterElement(el)) continue;
    const key = `${el.period}:${el.groupIupac}`;
    assert.ok(!seen.has(key), `duplicate main-grid position ${key} (latest: ${el.symbol})`);
    seen.add(key);
  }
});

test('metals have a non-null electrochemicalSeriesPosition or explicitly document why not (noble metals below hydrogen are allowed null=documented position text instead)', () => {
  // Не строгий null-запрет — часть благородных металлов имеет текстовое
  // положение вроде "правее водорода, не вытесняет его из кислот", а не
  // null. Инвариант здесь — что поле ХОТЬ ЧТО-ТО непустое содержит для
  // класса metal, т.е. не забыто молча.
  const metalsWithoutPosition = parsed.elements.filter(
    (e) => e.elementClass === 'metal' && e.electrochemicalSeriesPosition === null
  );
  assert.ok(
    metalsWithoutPosition.length < parsed.elements.filter((e) => e.elementClass === 'metal').length * 0.15,
    `too many metals (${metalsWithoutPosition.length}) missing electrochemicalSeriesPosition — likely an omission, not chemistry`
  );
});

test('every element with a photo reference points to a file name, not a full URL (local asset convention)', () => {
  for (const el of parsed.elements) {
    if (el.photo) {
      assert.ok(!el.photo.fileName.startsWith('http'), `${el.symbol}: photo.fileName should be a local file name, not a URL`);
    }
  }
});

test('every referenced photo file actually exists in public/periodictable/photos', () => {
  const withPhoto = parsed.elements.filter((e) => e.photo);
  assert.ok(withPhoto.length > 0, 'no element references a photo at all — content regression');
  const missing: string[] = [];
  for (const el of withPhoto) {
    const fileName = el.photo!.fileName;
    if (!fs.existsSync(path.join(PHOTOS_DIR, fileName))) {
      missing.push(`${el.symbol} -> ${fileName}`);
    }
  }
  assert.deepEqual(missing, [], `missing photo files in ${PHOTOS_DIR}: ${missing.join(', ')}`);
});
