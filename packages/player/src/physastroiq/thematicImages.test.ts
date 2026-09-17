// packages/player/src/physastroiq/thematicImages.test.ts
//
// FR-022 (≥ 6 изображений по основным разделам физики, строка 343), FR-023
// (≥ 4 по астрономии, строка 344) и FR-024 (темы по астрономии: строение
// солнечной системы, карты звёздного неба, Луна; строка 345) ТЗ 11.
//
// Все три требования количественные и перечислительные — на приёмке их
// проверяют пересчётом, поэтому они под тестом. Считаются они РАЗДЕЛЬНО:
// сумма «всего картинок хватает» ни одно из них не подтверждает.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PHYSASTROIQ_THEMATIC_IMAGES,
  PHYSASTROIQ_MIN_PHYSICS_IMAGES,
  PHYSASTROIQ_MIN_ASTRONOMY_IMAGES,
  PHYSASTROIQ_REQUIRED_PHYSICS_SECTIONS,
  PHYSASTROIQ_REQUIRED_ASTRO_THEMES,
  physastroiqThematicImageUrl,
  physastroiqImagesBySubject,
  missingAstroThemes,
  missingPhysicsSections,
} from './thematicImages.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(HERE, '..', '..', 'public', 'physastroiq', 'thematic');

test('FR-022: изображений по физике не меньше шести', () => {
  const n = physastroiqImagesBySubject('physics').length;
  assert.ok(n >= PHYSASTROIQ_MIN_PHYSICS_IMAGES, `по физике ${n}, нужно ${PHYSASTROIQ_MIN_PHYSICS_IMAGES}`);
});

test('FR-023: изображений по астрономии не меньше четырёх', () => {
  const n = physastroiqImagesBySubject('astronomy').length;
  assert.ok(
    n >= PHYSASTROIQ_MIN_ASTRONOMY_IMAGES,
    `по астрономии ${n}, нужно ${PHYSASTROIQ_MIN_ASTRONOMY_IMAGES}`
  );
});

test('пороги FR-022 и FR-023 считаются по РАЗНЫМ выборкам, а не по общей сумме', () => {
  // Смысл теста: не дать закрыть оба требования перекосом. Четырнадцать
  // картинок, из которых тринадцать по физике, дают «всего много» — и при
  // этом проваливают FR-023. Проверка обязана ловить именно такой случай.
  const phys = physastroiqImagesBySubject('physics').length;
  const astro = physastroiqImagesBySubject('astronomy').length;
  assert.equal(phys + astro, PHYSASTROIQ_THEMATIC_IMAGES.length, 'есть запись без предмета');
  assert.ok(phys >= PHYSASTROIQ_MIN_PHYSICS_IMAGES && astro >= PHYSASTROIQ_MIN_ASTRONOMY_IMAGES);
});

test('FR-022: изображения покрывают РАЗНЫЕ разделы физики, а не один', () => {
  // «≥ 6 по основным разделам» — это не «≥ 6 картинок». Шесть изображений про
  // электрическую цепь требование не выполняют.
  const sections = physastroiqImagesBySubject('physics').map((i) => i.section);
  assert.ok(
    sections.every((s) => s !== undefined),
    'у изображения по физике не указан раздел'
  );
  assert.equal(new Set(sections).size, sections.length, 'два изображения относятся к одному разделу');
  assert.ok(new Set(sections).size >= PHYSASTROIQ_MIN_PHYSICS_IMAGES);
});

test('FR-022: основные разделы школьного курса закрыты поимённо', () => {
  assert.deepEqual(missingPhysicsSections(), []);
});

test('FR-024: каждая названная в ТЗ тема астрономии закрыта', () => {
  assert.deepEqual(missingAstroThemes(), []);
});

test('FR-024: у эталона нет «строения солнечной системы» — у нас есть', () => {
  // Разбор эталонного продукта показал, что из трёх названных тем там закрыты
  // две. Это именно та тема, которой не хватало, и терять её нельзя.
  const solar = PHYSASTROIQ_THEMATIC_IMAGES.filter((i) => i.astroTheme === 'solar-system');
  assert.ok(solar.length >= 1, 'нет ни одного изображения по строению Солнечной системы');
});

test('на каждую тему астрономии есть ЗАПАС — не меньше двух изображений', () => {
  // У эталона изображений ровно по порогу: любое выбракованное на приёмке
  // ломает соответствие. Этот тест не даёт нам прийти к тому же незаметно.
  for (const theme of PHYSASTROIQ_REQUIRED_ASTRO_THEMES) {
    const count = PHYSASTROIQ_THEMATIC_IMAGES.filter((i) => i.astroTheme === theme.id).length;
    assert.ok(count >= 2, `тема «${theme.russian}»: изображений ${count}, запаса нет`);
  }
});

test('по физике есть запас сверх порога FR-022', () => {
  const n = physastroiqImagesBySubject('physics').length;
  assert.ok(n > PHYSASTROIQ_MIN_PHYSICS_IMAGES, `по физике ровно по порогу: ${n}`);
});

test('предмет и его признаки не перепутаны местами', () => {
  // Раздел физики у астрономической картинки (и наоборот) прошёл бы пересчёт
  // по предмету, но сломал бы проверки FR-022 и FR-024 незаметным образом.
  for (const img of PHYSASTROIQ_THEMATIC_IMAGES) {
    if (img.subject === 'physics') {
      assert.ok(img.section, `«${img.title}»: физика без раздела`);
      assert.equal(img.astroTheme, undefined, `«${img.title}»: у физики проставлена тема астрономии`);
    } else {
      assert.ok(img.astroTheme, `«${img.title}»: астрономия без темы`);
      assert.equal(img.section, undefined, `«${img.title}»: у астрономии проставлен раздел физики`);
    }
  }
});

test('файл каждого изображения лежит в пакете и не пустой', () => {
  // Запись в списке без файла на диске — это пустая рамка на экране галереи,
  // причём проверка «в списке четырнадцать штук» такую подмену не замечает.
  for (const img of PHYSASTROIQ_THEMATIC_IMAGES) {
    const file = path.join(ASSETS, img.fileName);
    assert.ok(fs.existsSync(file), `нет файла ${img.fileName}`);
    assert.ok(fs.statSync(file).size > 12000, `файл ${img.fileName} подозрительно мал`);
  }
});

test('в каталоге нет картинок, которых нет в списке', () => {
  // Обратная проверка: осиротевший файл — это либо забытая замена, либо
  // остаток от «БиоIQ», который поедет в дистрибутив молча.
  const listed = new Set(PHYSASTROIQ_THEMATIC_IMAGES.map((i) => i.fileName));
  const onDisk = fs.readdirSync(ASSETS).filter((n) => n.endsWith('.png'));
  for (const name of onDisk) {
    assert.ok(listed.has(name), `файл ${name} лежит в пакете, но в списке его нет`);
  }
});

test('ни одной биологической или химической картинки от Типов 9 и 10 не осталось', () => {
  const titles = PHYSASTROIQ_THEMATIC_IMAGES.map((i) => `${i.title} ${i.caption}`)
    .join(' ')
    .toLowerCase();
  for (const word of ['хими', 'менделеев', 'валентност', 'биолог', 'клетк', 'органелл', 'растен']) {
    assert.ok(!titles.includes(word), `в описаниях осталось слово «${word}»`);
  }
  const names = PHYSASTROIQ_THEMATIC_IMAGES.map((i) => i.fileName).join(' ');
  for (const stem of ['cell_', 'plant_', 'organs_']) {
    assert.ok(!names.includes(stem), `в списке остался файл от прежнего предмета: ${stem}`);
  }
});

test('у каждого изображения непустые имя файла, заголовок и подпись', () => {
  for (const img of PHYSASTROIQ_THEMATIC_IMAGES) {
    assert.ok(img.fileName.length > 0);
    assert.ok(img.title.length > 0);
    assert.ok(img.caption.length > 0);
  }
});

test('идентификаторы и имена файлов уникальны', () => {
  const ids = PHYSASTROIQ_THEMATIC_IMAGES.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
  const files = PHYSASTROIQ_THEMATIC_IMAGES.map((i) => i.fileName);
  assert.equal(new Set(files).size, files.length);
});

test('physastroiqThematicImageUrl строит относительный путь внутри physastroiq/thematic', () => {
  assert.equal(
    physastroiqThematicImageUrl('astro_moon_phases.png'),
    './physastroiq/thematic/astro_moon_phases.png'
  );
});

test('перечень обязательных разделов физики совпадает с порогом FR-022', () => {
  // Если когда-нибудь порог поднимут, а список обязательных разделов оставят
  // прежним, проверка «основные разделы закрыты» станет слабее требования.
  assert.equal(PHYSASTROIQ_REQUIRED_PHYSICS_SECTIONS.length, PHYSASTROIQ_MIN_PHYSICS_IMAGES);
});
