// packages/player/tools/physastroiq/build-content.mjs
//
// Собирает методическую викторину (FR-021) из двух источников:
//   structures.json — координаты структур, написанные рисовалкой карт;
//   questions.mjs   — банк вопросов, ссылающийся на структуры ПО ИМЕНИ.
//
// Ни одной координаты руками. Имя структуры, которого нет на карте, —
// ошибка сборки; вопрос с переписанной руками координатой указывал бы мимо
// органа и не сломал бы при этом ни сборку, ни тесты.
//
// Запуск: node tools/physastroiq/build-content.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BANK, LEVEL_RULES } from './questions.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', '..', 'src', 'physastroiq', 'content', 'physastroiqRealContent.json');

const structures = JSON.parse(fs.readFileSync(path.join(HERE, 'structures.json'), 'utf-8'));

const problems = [];
const questions = [];
const genericDecoyPoints = [];
const themes = [];
const levels = [];

for (const levelId of [1, 2, 3]) {
  const level = structures[String(levelId)];
  if (!level) {
    problems.push(`уровень ${levelId}: нет карты в structures.json`);
    continue;
  }
  const rules = LEVEL_RULES[levelId];
  levels.push({ id: levelId, label: rules.label });

  const byId = new Map(level.structures.map((s) => [s.id, s]));
  const used = new Set();

  BANK[levelId].forEach((q, i) => {
    const s = byId.get(q.structure);
    if (!s) {
      problems.push(`уровень ${levelId}, вопрос «${q.text.slice(0, 40)}»: на карте нет структуры «${q.structure}»`);
      return;
    }
    used.add(q.structure);
    if (!themes.includes(q.theme)) themes.push(q.theme);
    questions.push({
      id: `physastroiq-l${levelId}-q${i + 1}`,
      text: q.text,
      answer: q.answer,
      helpText: q.hint,
      x: s.x,
      y: s.y,
      width: s.width,
      height: s.height,
      decoyPoints: [],
      price: rules.price,
      timeSeconds: rules.timeSeconds,
      level: levelId,
      theme: q.theme,
      questionImage: null,
      answerImage: null,
      hintImage: null,
    });
  });

  // Структура, нарисованная на карте, но не спрошенная ни одним вопросом,
  // становится точкой без привязки: на поле она кликабельна, а правильным
  // ответом не бывает. Это ровно то, чего требует FR-013 вторым пунктом, и
  // заодно закрывает дыру «нарисовано, но нажать нельзя».
  for (const s of level.structures) {
    if (!used.has(s.id)) {
      genericDecoyPoints.push({ x: s.x, y: s.y, width: s.width, height: s.height, level: levelId });
    }
  }
  for (const d of level.decoys) {
    genericDecoyPoints.push({ x: d.x, y: d.y, width: d.width, height: d.height, level: levelId });
  }
}

if (problems.length) {
  console.error('Сборка не выполнена:');
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}

const quiz = {
  schemaVersion: 1,
  id: 'physastroiq-methodical',
  title: 'Биология',
  intro:
    'Викторина по биологии: строение клетки, органы растений и организм человека. ' +
    'Отвечайте, нажимая на нужную структуру прямо на изображении.',
  themes,
  passwordHash: null,
  images: {
    1: { fileName: structures['1'].fileName, width: structures['1'].width, height: structures['1'].height },
    2: { fileName: structures['2'].fileName, width: structures['2'].width, height: structures['2'].height },
    3: { fileName: structures['3'].fileName, width: structures['3'].width, height: structures['3'].height },
  },
  levels,
  questions,
  genericDecoyPoints,
};

fs.writeFileSync(OUT, JSON.stringify(quiz, null, 2) + '\n', 'utf-8');

// Небольшая викторина-образец для тестов редактора: по четыре вопроса на
// уровень, те же карты и те же точки без привязки.
//
// Она СОБИРАЕТСЯ ОТСЮДА, а не лежит отдельным файлом. У «ХимIQ» образцом была
// демо-сетка с химическими текстами на своей картинке demo_grid.png — то есть
// в поставку ехала химическая картинка, которую никто не открывал и потому не
// замечал. Собранный образец не может разойтись ни с картами, ни с предметом.
const DEMO_OUT = path.join(HERE, '..', '..', 'src', 'physastroiq', 'content', 'physastroiqDemoContent.json');
const demoQuestions = [1, 2, 3].flatMap((lvl) =>
  questions.filter((q) => q.level === lvl).slice(0, 4)
);
const demo = {
  ...quiz,
  id: 'physastroiq-demo',
  title: 'ФизАстроIQ (образец)',
  intro: 'Короткая викторина-образец: по четыре вопроса на каждый уровень.',
  themes: [...new Set(demoQuestions.map((q) => q.theme))],
  questions: demoQuestions,
};
fs.writeFileSync(DEMO_OUT, JSON.stringify(demo, null, 2) + '\n', 'utf-8');

const byLevel = (n) => questions.filter((q) => q.level === n).length;
const decoysOf = (n) => genericDecoyPoints.filter((d) => d.level === n).length;
console.log(`Викторина собрана: ${OUT}`);
console.log(`  вопросов: ${questions.length} (${byLevel(1)} / ${byLevel(2)} / ${byLevel(3)})`);
console.log(`  точек без привязки: ${genericDecoyPoints.length} (${decoysOf(1)} / ${decoysOf(2)} / ${decoysOf(3)})`);
console.log(`  тем: ${themes.length} — ${themes.join(', ')}`);
