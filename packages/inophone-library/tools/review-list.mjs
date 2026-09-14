// packages/inophone-library/tools/review-list.mjs
// Список слов, требующих проверки носителем языка.
//
// ЗАЧЕМ ЭТО ОТДЕЛЬНЫМ ДОКУМЕНТОМ. Башкирская часть словаря собрана по
// доступным источникам и НЕ ВЫВЕРЕНА человеком, знающим язык. В учебном
// пособии это существеннее, чем пропуск: пропущенное слово ребёнок не выучит,
// а неверное — выучит неверно, и переучивать будет труднее, чем учить.
//
// Решение пользователя от 14.09.2026: слова пишутся, но помечаются, и список
// идёт в документы приёмки. Пока он не пройден носителем, соответствие ТЗ по
// башкирскому языку считается ЗАЯВЛЕННЫМ, а не подтверждённым.
//
// Отдельной строкой помечены слова, где перевод — заимствование, совпадающее с
// русским («лампа», «диван», «касса»). Это не ошибка сама по себе: в башкирском
// они действительно заимствованы. Но именно там вероятнее всего, что источник
// просто не дал перевода, а мы приняли русское слово за башкирское.
//
// Запуск: node tools/review-list.mjs > ../../docs/inophone-bashkir-review.md

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import home from './catalogue/home.mjs';
import city from './catalogue/city.mjs';
import nature from './catalogue/nature.mjs';
import person from './catalogue/person.mjs';
import activities from './catalogue/activities.mjs';
import holidays from './catalogue/holidays.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const { inophone } = createRequire(import.meta.url)(path.resolve(ROOT, '../shared/dist/index.js'));

const THEMES = [home, city, nature, person, activities, holidays];

/** Совпадает ли башкирское написание с русским с точностью до регистра */
function sameAsRussian(ru, ba) {
  return ru.toLowerCase().replace(/ё/g, 'е') === ba.toLowerCase().replace(/ё/g, 'е');
}

const rows = [];
let suspicious = 0;
for (const theme of THEMES) {
  for (const scene of theme.scenes) {
    for (const w of scene.words) {
      const flag = sameAsRussian(w.ru, w.ba);
      if (flag) suspicious += 1;
      rows.push({ theme: theme.titles.ru, scene: scene.titles.ru, ...w, flag });
    }
  }
}

const out = [];
out.push('# «Инофон»: башкирский словарь на проверку носителем');
out.push('');
out.push('Документ приёмки. Пока он не пройден человеком, знающим башкирский язык,');
out.push('соответствие ТЗ по этому языку считается **заявленным, а не подтверждённым**.');
out.push('');
out.push(`Всего слов: **${rows.length}**. Из них совпадают с русским написанием: **${suspicious}**`);
out.push('— это заимствования, и сами по себе они не ошибка, но именно там вероятнее');
out.push('всего, что источник не дал перевода, а русское слово было принято за башкирское.');
out.push('');
out.push('Что нужно от проверяющего: против каждой строки поставить «верно» либо');
out.push('написать правильный вариант. Исправления вносятся в');
out.push('`packages/inophone-library/tools/catalogue/*.mjs`, после чего пересобираются');
out.push('пакет (`npm run build`) и озвучка (`tools/generate-espeak.mjs`).');
out.push('');
out.push('Звук башкирских слов синтезирован eSpeak NG (голос `ba`). Он разборчив, но');
out.push('это синтез, а не диктор: произношение тоже стоит послушать.');
out.push('');

let currentTheme = '';
let currentScene = '';
for (const r of rows) {
  if (r.theme !== currentTheme) {
    out.push('');
    out.push(`## Тема «${r.theme}»`);
    currentTheme = r.theme;
    currentScene = '';
  }
  if (r.scene !== currentScene) {
    out.push('');
    out.push(`### Сцена «${r.scene}»`);
    out.push('');
    out.push('| Идентификатор | Русский | Башкирский | Совпадает с русским |');
    out.push('|---|---|---|---|');
    currentScene = r.scene;
  }
  out.push(`| \`${r.id}\` | ${r.ru} | **${r.ba}** | ${r.flag ? 'да — проверить в первую очередь' : ''} |`);
}

out.push('');
console.log(out.join('\n'));

// Сводка уходит в stderr, чтобы не попасть в документ
console.error(`строк ${rows.length}, совпадающих с русским ${suspicious}`);
