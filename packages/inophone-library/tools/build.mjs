// packages/inophone-library/tools/build.mjs
// Сборка пакета контента «Инофон» из каталога.
//
// СОБИРАЕТ, НО НЕ РИСУЕТ. Иллюстрации понятий делаются отдельным конвейером и
// кладутся в assets/img/concepts/<id>.svg. Сборка ставит ЗАГЛУШКУ только туда,
// где рисунка ещё нет, и узнаёт заглушку ПО СОДЕРЖИМОМУ, а не по имени файла:
// иначе первая же настоящая иллюстрация была бы затёрта следующей сборкой.
// Ровно этот приём взят из Типа 2 (words-library/tools/build.mjs).
//
// ПОДЛОЖКА СЦЕНЫ СОБИРАЕТСЯ ИЗ ТЕХ ЖЕ КООРДИНАТ, что и контуры хотспотов.
// Заданные порознь, они разъезжаются при первой правке, и обнаруживается это
// тем, что ребёнок попадает пальцем в кровать, а программа засчитывает окно.
//
// СИРОТЫ ВЫЧИЩАЮТСЯ СИММЕТРИЧНО — и картинки, и звук. Файл понятия, которого
// больше нет в каталоге, это не безобидный лишний вес: проверка комплектности
// назовёт его лишним, и на приёмке придётся объяснять, откуда он взялся.
//
// Запуск: node tools/build.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import { layoutScene, VIEW } from './layout.mjs';
import home from './catalogue/home.mjs';
import city from './catalogue/city.mjs';
import nature from './catalogue/nature.mjs';
import person from './catalogue/person.mjs';
import activities from './catalogue/activities.mjs';
import shopping from './catalogue/shopping.mjs';
import holidays from './catalogue/holidays.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ASSETS = path.join(ROOT, 'assets');

// Каталоги ресурсов берутся ИЗ ДОМЕНА, а не переписываются здесь. В Типе 2
// вторая копия пути стоила того, что вычистка сирот искала их не в том
// каталоге и молча не находила ничего
const sharedPath = path.resolve(ROOT, '../shared/dist/index.js');
if (!fs.existsSync(sharedPath)) {
  console.error(`Не найден собранный @kiosk/shared: ${sharedPath}
Соберите: cd packages/shared && npm run build`);
  process.exit(1);
}
const { inophone } = createRequire(import.meta.url)(sharedPath);
const { SCENE_IMAGE_DIR, CONCEPT_IMAGE_DIR, AUDIO_DIR, LANGUAGE_CODES } = inophone;

// Порядок — как в перечне ТЗ строки 97: квартира, город, покупки, человек,
// затем остальные
const THEMES = [home, city, shopping, person, nature, activities, holidays];

/** Признак заглушки — В СОДЕРЖИМОМ файла, а не в его имени */
const PLACEHOLDER_MARK = 'заглушка';

// ─── сбор каталога ─────────────────────────────────────────────────────────

const concepts = [];
const scenes = [];
const themes = [];
const seenId = new Map();
const seenRu = new Map();
const problems = [];

for (const theme of THEMES) {
  themes.push({ id: theme.id, titles: theme.titles, sceneIds: theme.scenes.map((s) => s.id) });

  for (const scene of theme.scenes) {
    for (const w of scene.words) {
      if (seenId.has(w.id)) {
        problems.push(`понятие ${w.id} встречается дважды: ${seenId.get(w.id)} и ${scene.id}`);
        continue;
      }
      seenId.set(w.id, scene.id);

      // Одинаковое русское написание у двух понятий — не ошибка формата, но в
      // словаре две неотличимые строки, и в задании ученик не понимает, какую
      // из них ищут
      if (seenRu.has(w.ru)) {
        problems.push(`русское «${w.ru}» у двух понятий: ${seenRu.get(w.ru)} и ${w.id}`);
      } else {
        seenRu.set(w.ru, w.id);
      }

      const missing = LANGUAGE_CODES.filter((c) => !w[c] || !String(w[c]).trim());
      if (missing.length > 0) {
        problems.push(`у понятия ${w.id} нет написания: ${missing.join(', ')}`);
        continue;
      }

      concepts.push({
        id: w.id,
        hasPicture: true,
        translations: Object.fromEntries(
          LANGUAGE_CODES.map((code) => [code, { text: String(w[code]), hasAudio: false }])
        ),
      });
    }

    const ids = scene.words.map((w) => w.id);
    const placed = layoutScene(scene.id, ids);
    scenes.push({
      id: scene.id,
      titles: scene.titles,
      viewBox: { ...VIEW },
      hotspots: placed.map((p) => ({ conceptId: p.id, points: p.points })),
      _placed: placed,
      _theme: theme.id,
    });
  }
}

if (problems.length > 0) {
  console.error('КАТАЛОГ НЕ СОБРАН:');
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}

// ─── что уже озвучено ──────────────────────────────────────────────────────

// `hasAudio` выводится ИЗ НАЛИЧИЯ ФАЙЛА, а не проставляется руками. Признак,
// который ведут отдельно от файлов, расходится с ними при первой же
// перегенерации, и приложение показывает кнопку звука над тишиной
for (const concept of concepts) {
  for (const code of LANGUAGE_CODES) {
    const file = path.join(ASSETS, inophone.conceptAudioPath(concept.id, code));
    concept.translations[code].hasAudio = fs.existsSync(file);
  }
}

// ─── фон сцены по теме ─────────────────────────────────────────────────────

/**
 * Фон — простая заливка «верх/низ», а не рисунок.
 *
 * Сцена держится на предметах: именно их ищет ученик. Подробный фон с
 * нарисованными вещами спорил бы с ними — ребёнок тыкал бы в нарисованный на
 * фоне шкаф, которого нет среди объектов, и получал «неверно» без объяснения.
 */
const THEME_BACKDROP = {
  home:       { sky: '#e7eef6', ground: '#d8c9a8', line: '#c4b391' },
  city:       { sky: '#dfe9f2', ground: '#c9c9c9', line: '#b0b0b0' },
  nature:     { sky: '#d9ecf7', ground: '#c2d8a4', line: '#a9c489' },
  person:     { sky: '#f0e9f2', ground: '#ddd2e0', line: '#c8bace' },
  activities: { sky: '#eceff2', ground: '#d5d9de', line: '#bcc2c9' },
  shopping:   { sky: '#eaf2ec', ground: '#d6e0d8', line: '#bcc9bf' },
  holidays:   { sky: '#f4ecf7', ground: '#e3d7e8', line: '#cbb9d2' },
};

function sceneSvg(scene) {
  const bg = THEME_BACKDROP[scene._theme];
  // Новая тема без фона роняла сборку на `undefined.sky` — сообщение, по
  // которому не видно, что именно забыли. Теперь видно
  if (!bg) throw new Error(`для темы ${scene._theme} не задан фон в THEME_BACKDROP`);
  const horizon = Math.round(VIEW.height * 0.62);
  const parts = [
    `<rect width="${VIEW.width}" height="${VIEW.height}" fill="${bg.sky}"/>`,
    `<rect y="${horizon}" width="${VIEW.width}" height="${VIEW.height - horizon}" fill="${bg.ground}"/>`,
    `<line x1="0" y1="${horizon}" x2="${VIEW.width}" y2="${horizon}" stroke="${bg.line}" stroke-width="3"/>`,
  ];
  for (const p of scene._placed) {
    // Ссылка ОТНОСИТЕЛЬНАЯ: подложка и иллюстрации лежат в одном пакете и
    // грузятся одной схемой протокола
    const href = `../concepts/${p.id}.svg`;
    parts.push(
      `<image href="${href}" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" preserveAspectRatio="xMidYMid meet"/>`
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW.width} ${VIEW.height}" width="${VIEW.width}" height="${VIEW.height}">\n  ${parts.join('\n  ')}\n</svg>\n`;
}

/** Заглушка понятия: рамка и подпись. Видно сразу, что рисунка ещё нет */
function placeholderSvg(concept) {
  const title = concept.translations.ru.text;
  const size = 320;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <!-- ${PLACEHOLDER_MARK}: иллюстрация ещё не нарисована -->
  <rect x="6" y="6" width="${size - 12}" height="${size - 12}" rx="20" fill="#ffffff" stroke="#c0442e" stroke-width="5" stroke-dasharray="14 10"/>
  <text x="${size / 2}" y="${size / 2 + 10}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="30" fill="#17222e">${title}</text>
  <text x="${size / 2}" y="${size / 2 + 50}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="20" fill="#c0442e">нет рисунка</text>
</svg>
`;
}

// ─── запись ────────────────────────────────────────────────────────────────

fs.mkdirSync(path.join(ASSETS, SCENE_IMAGE_DIR), { recursive: true });
fs.mkdirSync(path.join(ASSETS, CONCEPT_IMAGE_DIR), { recursive: true });

let placeholders = 0;
let drawn = 0;
for (const concept of concepts) {
  const file = path.join(ASSETS, inophone.conceptImagePath(concept.id));
  if (fs.existsSync(file)) {
    const body = fs.readFileSync(file, 'utf8');
    if (!body.includes(PLACEHOLDER_MARK)) {
      drawn += 1;
      continue;
    }
  }
  fs.writeFileSync(file, placeholderSvg(concept), 'utf8');
  placeholders += 1;
}

for (const scene of scenes) {
  fs.writeFileSync(path.join(ASSETS, inophone.sceneImagePath(scene.id)), sceneSvg(scene), 'utf8');
}

// Сироты: файлы понятий, которых больше нет в каталоге
const alive = new Set(concepts.map((c) => c.id));
let sweptImages = 0;
let sweptAudio = 0;

const conceptDir = path.join(ASSETS, CONCEPT_IMAGE_DIR);
for (const name of fs.readdirSync(conceptDir)) {
  if (!alive.has(path.basename(name, '.svg'))) {
    fs.unlinkSync(path.join(conceptDir, name));
    sweptImages += 1;
  }
}
const sceneAlive = new Set(scenes.map((s) => s.id));
const sceneDir = path.join(ASSETS, SCENE_IMAGE_DIR);
for (const name of fs.readdirSync(sceneDir)) {
  if (!sceneAlive.has(path.basename(name, '.svg'))) {
    fs.unlinkSync(path.join(sceneDir, name));
    sweptImages += 1;
  }
}
const audioRoot = path.join(ASSETS, AUDIO_DIR);
if (fs.existsSync(audioRoot)) {
  for (const code of fs.readdirSync(audioRoot)) {
    const dir = path.join(audioRoot, code);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!alive.has(path.basename(name, '.mp3'))) {
        fs.unlinkSync(path.join(dir, name));
        sweptAudio += 1;
      }
    }
  }
}

const library = {
  schemaVersion: 1,
  themes,
  scenes: scenes.map(({ _placed, _theme, ...rest }) => rest),
  concepts,
};

// Разбор СВОЕЙ ЖЕ сборки теми же правилами, что применит приложение: пакет, не
// прошедший схему, не должен доезжать до устройства
const parsed = inophone.parseInophoneLibrary(library);
const geometry = inophone.checkGeometry(parsed);
if (!geometry.ok) {
  console.error('РАЗМЕТКА НЕВЕРНА:');
  for (const p of geometry.ambiguous) console.error(`  ${p.sceneId}: ${p.a} и ${p.b} накладываются`);
  for (const p of geometry.outOfBounds) console.error(`  ${p.sceneId}: ${p.conceptId} за краем`);
  process.exit(1);
}

fs.writeFileSync(path.join(ROOT, 'index.json'), JSON.stringify(library, null, 2) + '\n', 'utf8');

const quotas = inophone.checkQuotas(parsed);
console.log(`тем ${themes.length}, сцен ${scenes.length}, понятий ${concepts.length}`);
console.log(`иллюстраций: нарисовано ${drawn}, заглушек ${placeholders}`);
console.log(`вычищено сирот: картинок ${sweptImages}, звука ${sweptAudio}`);
console.log(`разметка: наложений нет, всё внутри подложек`);
const row = (n, q) => `  ${q.ok ? 'есть' : 'НЕ ХВАТАЕТ'}  ${n}: ${q.have} из ${q.need} (запас ${q.spare})`;
console.log('Квоты ТЗ');
console.log(row('слов', quotas.words));
console.log(row('сцен', quotas.scenes));
console.log(row('тем', quotas.themes));
