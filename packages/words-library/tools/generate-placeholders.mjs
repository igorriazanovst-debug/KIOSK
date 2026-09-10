// packages/words-library/tools/generate-placeholders.mjs
// Генератор ЗАГЛУШЕЧНОГО контента для разработки виджета «Я знаю много слов».
//
// Это не поставочный контент и никогда им не станет: настоящие 270+
// иллюстраций рисует художник, озвучку пишут дикторы (ТЗ раздел 10 требует
// обеспечить законность всех материалов). Здесь — геометрические фигуры,
// нужные только чтобы игровой цикл можно было писать и проверять, не дожидаясь
// производства контента.
//
// Запуск:  node tools/generate-placeholders.mjs
// Результат: index.json + assets/img/words/*.svg + assets/img/themes/*.svg

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(ROOT, 'assets');

const THEMES = [
  {
    id: 'digits',
    title: 'Цифры',
    color: '#3f6fb5',
    words: [
      ['0000', 'Один', 0],
      ['0001', 'Два', 0],
      ['0002', 'Три', 0],
      ['0003', 'Четыре', 1],
      ['0004', 'Пять', 1],
    ],
  },
  {
    id: 'my_room',
    title: 'Моя комната',
    color: '#8a5a3b',
    words: [
      ['0100', 'Кровать', 0],
      ['0101', 'Стол', 0],
      ['0102', 'Стул', 1],
      ['0103', 'Лампа', 1],
      ['0104', 'Окно', 2],
    ],
  },
  {
    id: 'transport',
    title: 'Транспорт',
    color: '#2f7d6a',
    words: [
      ['0200', 'Автобус', 0],
      ['0201', 'Велосипед', 1],
      ['0202', 'Самолёт', 1],
      ['0203', 'Кораблик', 2],
      ['0204', 'Поезд', 2],
    ],
  },
  {
    id: 'food',
    title: 'Еда',
    color: '#b5643f',
    words: [
      ['0300', 'Яблоко', 0],
      ['0301', 'Хлеб', 0],
      ['0302', 'Молоко', 1],
      ['0303', 'Морковь', 1],
      ['0304', 'Сыр', 2],
    ],
  },
];

/** Разные силуэты, чтобы карточки отличались не только подписью */
const SHAPES = [
  (c) => `<circle cx="256" cy="228" r="120" fill="${c}"/>`,
  (c) => `<rect x="136" y="108" width="240" height="240" rx="24" fill="${c}"/>`,
  (c) => `<polygon points="256,96 392,348 120,348" fill="${c}"/>`,
  (c) => `<polygon points="256,92 300,204 420,204 324,274 360,388 256,318 152,388 188,274 92,204 212,204" fill="${c}"/>`,
  (c) => `<ellipse cx="256" cy="228" rx="150" ry="104" fill="${c}"/>`,
];

function wordSvg(name, color, shapeIndex) {
  const shape = SHAPES[shapeIndex % SHAPES.length](color);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="32" fill="#f4f1ea"/>
  ${shape}
  <text x="256" y="440" text-anchor="middle" font-family="system-ui, sans-serif" font-size="46" fill="#3a3a3a">${name}</text>
  <text x="256" y="480" text-anchor="middle" font-family="system-ui, sans-serif" font-size="22" fill="#9b9b9b">заглушка</text>
</svg>
`;
}

function themeSvg(title, color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 320" width="512" height="320">
  <rect width="512" height="320" rx="24" fill="${color}"/>
  <circle cx="96" cy="88" r="44" fill="#ffffff" opacity="0.22"/>
  <circle cx="430" cy="250" r="72" fill="#ffffff" opacity="0.14"/>
  <text x="256" y="176" text-anchor="middle" font-family="system-ui, sans-serif" font-size="44" fill="#ffffff">${title}</text>
  <text x="256" y="216" text-anchor="middle" font-family="system-ui, sans-serif" font-size="20" fill="#ffffff" opacity="0.7">заглушка</text>
</svg>
`;
}

fs.rmSync(ASSETS, { recursive: true, force: true });
fs.mkdirSync(path.join(ASSETS, 'img', 'words'), { recursive: true });
fs.mkdirSync(path.join(ASSETS, 'img', 'themes'), { recursive: true });

const words = [];
const themes = [];

for (const theme of THEMES) {
  fs.writeFileSync(
    path.join(ASSETS, 'img', 'themes', `${theme.id}.svg`),
    themeSvg(theme.title, theme.color),
    'utf8'
  );
  themes.push({ id: theme.id, title: theme.title, wordIds: theme.words.map(([id]) => id) });

  theme.words.forEach(([id, name, level], i) => {
    fs.writeFileSync(
      path.join(ASSETS, 'img', 'words', `${id}.svg`),
      wordSvg(name, theme.color, i),
      'utf8'
    );
    words.push({ id, name, themeId: theme.id, level });
  });
}

const library = {
  schemaVersion: 1,
  // Озвучка не записана — законное состояние пакета: картинки и звук
  // производятся разными людьми и в разные сроки.
  audioScheme: { voices: [], phrasesPerVoice: 0, neutral: false },
  themes,
  words,
};

fs.writeFileSync(path.join(ROOT, 'index.json'), JSON.stringify(library, null, 2) + '\n', 'utf8');

console.log(`Сгенерировано: ${themes.length} тем, ${words.length} слов`);
console.log(`index.json + ${words.length} иллюстраций + ${themes.length} обложек`);
