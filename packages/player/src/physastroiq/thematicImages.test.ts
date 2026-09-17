// packages/player/src/physastroiq/thematicImages.test.ts
// FR-022 (≥3 изображения) и FR-023 (темы: внутренние органы, растения,
// клетки) ТЗ 11. Оба требования количественные и перечислительные — их на
// приёмке проверяют пересчётом, поэтому они под тестом.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PHYSASTROIQ_THEMATIC_IMAGES,
  PHYSASTROIQ_REQUIRED_THEMES,
  physastroiqThematicImageUrl,
  missingThematicThemes,
} from './thematicImages.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(HERE, '..', '..', 'public', 'physastroiq', 'thematic');

test('FR-022: изображений не меньше трёх', () => {
  assert.ok(PHYSASTROIQ_THEMATIC_IMAGES.length >= 3, `в пакете ${PHYSASTROIQ_THEMATIC_IMAGES.length}`);
});

test('FR-023: каждая названная в ТЗ тема закрыта', () => {
  assert.deepEqual(missingThematicThemes(), []);
});

test('на каждую обязательную тему есть ЗАПАС — не меньше двух изображений', () => {
  // У эталона изображений ровно три при требовании «не меньше трёх»: любое
  // выбракованное на приёмке ломает соответствие. Этот тест не даёт нам
  // прийти к тому же положению незаметно.
  for (const theme of PHYSASTROIQ_REQUIRED_THEMES) {
    const count = PHYSASTROIQ_THEMATIC_IMAGES.filter((i) => i.theme === theme.id).length;
    assert.ok(count >= 2, `тема «${theme.russian}»: изображений ${count}, запаса нет`);
  }
});

test('файл каждого изображения лежит в пакете и не пустой', () => {
  // Запись в списке без файла на диске — это пустая рамка на экране галереи,
  // причём проверка «в списке шесть штук» такую подмену не замечает.
  for (const img of PHYSASTROIQ_THEMATIC_IMAGES) {
    const file = path.join(ASSETS, img.fileName);
    assert.ok(fs.existsSync(file), `нет файла ${img.fileName}`);
    assert.ok(fs.statSync(file).size > 12000, `файл ${img.fileName} подозрительно мал`);
  }
});

test('в каталоге нет картинок, которых нет в списке', () => {
  // Обратная проверка: осиротевший файл — это либо забытая замена, либо
  // остаток от «ХимIQ», который поедет в дистрибутив молча.
  const listed = new Set(PHYSASTROIQ_THEMATIC_IMAGES.map((i) => i.fileName));
  const onDisk = fs.readdirSync(ASSETS).filter((n) => n.endsWith('.png'));
  for (const name of onDisk) {
    assert.ok(listed.has(name), `файл ${name} лежит в пакете, но в списке его нет`);
  }
});

test('ни одной химической картинки от Типа 9 не осталось', () => {
  const titles = PHYSASTROIQ_THEMATIC_IMAGES.map((i) => `${i.title} ${i.caption}`).join(' ').toLowerCase();
  for (const word of ['хими', 'менделеев', 'молекул', 'валентн']) {
    assert.ok(!titles.includes(word), `в описаниях осталось слово «${word}»`);
  }
});

test('у каждого изображения непустые имя файла, заголовок и подпись', () => {
  for (const img of PHYSASTROIQ_THEMATIC_IMAGES) {
    assert.ok(img.fileName.length > 0);
    assert.ok(img.title.length > 0);
    assert.ok(img.caption.length > 0);
  }
});

test('идентификаторы уникальны', () => {
  const ids = PHYSASTROIQ_THEMATIC_IMAGES.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('physastroiqThematicImageUrl строит относительный путь внутри physastroiq/thematic', () => {
  assert.equal(physastroiqThematicImageUrl('cell_plant.png'), './physastroiq/thematic/cell_plant.png');
});
