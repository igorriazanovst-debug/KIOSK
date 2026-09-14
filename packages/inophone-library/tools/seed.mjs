// packages/inophone-library/tools/seed.mjs
// Сборка ЗАТРАВОЧНОГО пакета контента «Инофон»: одна тема, одна сцена,
// восемь понятий на шести языках.
//
// Зачем он нужен отдельно от настоящего контента (Фаза 4): цепочка «пакет →
// протокол inophonelib → разбор схемы → экран» должна проверяться живым
// запуском приложения, а не только сборкой. Без единого файла контента
// проверить нечего, а ждать трёхсот пятидесяти слов, чтобы узнать, что
// протокол не зарегистрирован, — заведомо дороже.
//
// ПОДЛОЖКА РИСУЕТСЯ ЗДЕСЬ ЖЕ, простыми фигурами, и контуры хотспотов берутся
// из тех же координат, что и фигуры. Это не экономия на художнике: если
// подложку и разметку задавать порознь, они разъезжаются при первой же правке,
// и обнаруживается это тем, что ребёнок попадает пальцем в кровать, а
// программа засчитывает окно.
//
// Запуск: node tools/seed.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ASSETS = path.join(ROOT, 'assets');

const VIEW = { width: 1280, height: 800 };

/** Прямоугольник → и фигура, и контур хотспота из одних координат */
const rect = (x, y, w, h) => ({
  x,
  y,
  w,
  h,
  points: `${x},${y} ${x + w},${y} ${x + w},${y + h} ${x},${y + h}`,
});

// Комната: пол, стена и восемь предметов. Координаты в системе viewBox сцены.
const OBJECTS = [
  { id: 'bed', box: rect(130, 430, 420, 250), fill: '#b5651d', accent: '#f2e3c8' },
  { id: 'window', box: rect(700, 140, 300, 220), fill: '#8ecae6', accent: '#ffffff' },
  { id: 'pillow', box: rect(160, 450, 150, 90), fill: '#f7f3e8', accent: '#d9d2c0' },
  { id: 'lamp', box: rect(1060, 300, 120, 200), fill: '#ffd166', accent: '#6b705c' },
  { id: 'chair', box: rect(600, 500, 150, 220), fill: '#8d6e4a', accent: '#6b5136' },
  { id: 'carpet', box: rect(330, 690, 560, 90), fill: '#9d4edd', accent: '#c77dff' },
  { id: 'door', box: rect(60, 170, 160, 420), fill: '#7f5539', accent: '#e6b800' },
  { id: 'wardrobe', box: rect(950, 420, 220, 300), fill: '#a67c52', accent: '#5c4326' },
];

/**
 * Словарь. Все шесть языков обязательны — схема отвергает пакет, где у языка
 * нет написания (ТЗ строка 95). `hasAudio: false` честно означает «звук ещё не
 * записан», и отчёт о комплектности назовёт это поимённо, по языкам.
 */
const WORDS = {
  bed:      { ru: 'кровать',  en: 'bed',      fr: 'lit',       de: 'Bett',     zh: '床',   ba: 'карауат' },
  window:   { ru: 'окно',     en: 'window',   fr: 'fenêtre',   de: 'Fenster',  zh: '窗户', ba: 'тәҙрә' },
  pillow:   { ru: 'подушка',  en: 'pillow',   fr: 'oreiller',  de: 'Kissen',   zh: '枕头', ba: 'мендәр' },
  lamp:     { ru: 'лампа',    en: 'lamp',     fr: 'lampe',     de: 'Lampe',    zh: '灯',   ba: 'лампа' },
  chair:    { ru: 'стул',     en: 'chair',    fr: 'chaise',    de: 'Stuhl',    zh: '椅子', ba: 'ултырғыс' },
  carpet:   { ru: 'ковёр',    en: 'carpet',   fr: 'tapis',     de: 'Teppich',  zh: '地毯', ba: 'келәм' },
  door:     { ru: 'дверь',    en: 'door',     fr: 'porte',     de: 'Tür',      zh: '门',   ba: 'ишек' },
  wardrobe: { ru: 'шкаф',     en: 'wardrobe', fr: 'armoire',   de: 'Schrank',  zh: '衣柜', ba: 'шкаф' },
};

const SCENE_TITLES = {
  ru: 'Спальня', en: 'Bedroom', fr: 'Chambre', de: 'Schlafzimmer', zh: '卧室', ba: 'Йоҡо бүлмәһе',
};
const THEME_TITLES = {
  ru: 'Дом', en: 'Home', fr: 'Maison', de: 'Zuhause', zh: '家', ba: 'Өй',
};

function sceneSvg() {
  const parts = [
    `<rect width="${VIEW.width}" height="${VIEW.height}" fill="#dfe7ef"/>`,
    `<rect y="620" width="${VIEW.width}" height="180" fill="#c9a227" opacity="0.35"/>`,
  ];
  for (const o of OBJECTS) {
    const { x, y, w, h } = o.box;
    parts.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${o.fill}" stroke="${o.accent}" stroke-width="6"/>`
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW.width} ${VIEW.height}" width="${VIEW.width}" height="${VIEW.height}">\n  ${parts.join('\n  ')}\n</svg>\n`;
}

function conceptSvg(o, title) {
  const { w, h } = o.box;
  const size = 320;
  const scale = Math.min((size * 0.7) / w, (size * 0.5) / h);
  const dw = Math.round(w * scale);
  const dh = Math.round(h * scale);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="24" fill="#ffffff"/>
  <rect x="${(size - dw) / 2}" y="${(size - dh) / 2 - 20}" width="${dw}" height="${dh}" rx="10" fill="${o.fill}" stroke="${o.accent}" stroke-width="5"/>
  <text x="${size / 2}" y="${size - 26}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="28" fill="#17222e">${title}</text>
</svg>
`;
}

function build() {
  fs.mkdirSync(path.join(ASSETS, 'img/scenes'), { recursive: true });
  fs.mkdirSync(path.join(ASSETS, 'img/concepts'), { recursive: true });

  fs.writeFileSync(path.join(ASSETS, 'img/scenes/bedroom.svg'), sceneSvg(), 'utf8');
  for (const o of OBJECTS) {
    fs.writeFileSync(
      path.join(ASSETS, `img/concepts/${o.id}.svg`),
      conceptSvg(o, WORDS[o.id].ru),
      'utf8'
    );
  }

  const concepts = OBJECTS.map((o) => ({
    id: o.id,
    hasPicture: true,
    translations: Object.fromEntries(
      Object.entries(WORDS[o.id]).map(([code, text]) => [code, { text, hasAudio: false }])
    ),
  }));

  const library = {
    schemaVersion: 1,
    themes: [{ id: 'home', titles: THEME_TITLES, sceneIds: ['bedroom'] }],
    scenes: [
      {
        id: 'bedroom',
        titles: SCENE_TITLES,
        viewBox: VIEW,
        hotspots: OBJECTS.map((o) => ({ conceptId: o.id, points: o.box.points })),
      },
    ],
    concepts,
  };

  fs.writeFileSync(path.join(ROOT, 'index.json'), JSON.stringify(library, null, 2) + '\n', 'utf8');
  console.log(
    `index.json: тем ${library.themes.length}, сцен ${library.scenes.length}, понятий ${concepts.length}`
  );
}

build();
