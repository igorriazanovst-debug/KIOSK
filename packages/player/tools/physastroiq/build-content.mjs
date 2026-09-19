// packages/player/tools/physastroiq/build-content.mjs
//
// Собирает встроенные викторины (FR-021, строка 342) из двух источников:
//   structures-<предмет>.json — координаты структур, написанные рисовалкой карт;
//   questions-<предмет>.mjs   — банк вопросов, ссылающийся на структуры ПО ИМЕНИ.
//
// Ни одной координаты руками. Имя структуры, которого нет на карте, — ошибка
// сборки; вопрос с переписанной руками координатой указывал бы мимо прибора и
// не сломал бы при этом ни сборку, ни тесты.
//
// ВИКТОРИН ДВЕ, ПО ЧИСЛУ ПРЕДМЕТОВ (FR-004, строка 325: «Предмет — физика,
// астрономия»). Одна общая викторина на два предмета означала бы, что игрок,
// выбравший астрономию, получает вопросы про электрическую цепь.
//
// Запуск: node tools/physastroiq/build-content.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as physicsBank from './questions-physics.mjs';
import * as astroBank from './questions-astro.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONTENT = path.join(HERE, '..', '..', 'src', 'physastroiq', 'content');

const SUBJECTS = [
  {
    id: 'physics',
    quizId: 'physastroiq-physics',
    title: 'Физика',
    intro:
      'Викторина по физике: электрическая цепь, простые механизмы, оптика. ' +
      'Отвечайте, нажимая на нужный прибор или деталь прямо на изображении.',
    bank: physicsBank,
    out: 'physastroiqPhysicsContent.json',
  },
  {
    id: 'astro',
    quizId: 'physastroiq-astronomy',
    title: 'Астрономия',
    intro:
      'Викторина по астрономии: Солнечная система, звёздное небо, Земля и Луна. ' +
      'Отвечайте, нажимая на нужный объект прямо на изображении.',
    bank: astroBank,
    out: 'physastroiqAstroContent.json',
  },
];

// Рисовалка отдаёт ЛЕВЫЙ ВЕРХНИЙ угол области, а схема викторины и игровое
// поле понимают x/y как ЦЕНТР. Без пересчёта каждая область на поле стояла бы
// выше и левее своего объекта на половину собственного размера (дефект,
// найденный у «БиоIQ» 18.09.2026 и унаследованный копией).
const centered = (box) => ({
  x: Math.round(box.x + box.width / 2),
  y: Math.round(box.y + box.height / 2),
  width: box.width,
  height: box.height,
});

const problems = [];

function buildSubject(subject) {
  const structures = JSON.parse(
    fs.readFileSync(path.join(HERE, `structures-${subject.id}.json`), 'utf-8')
  );
  const { BANK, LEVEL_RULES } = subject.bank;

  const questions = [];
  const genericDecoyPoints = [];
  const themes = [];
  const levels = [];

  for (const levelId of [1, 2, 3]) {
    const level = structures[String(levelId)];
    if (!level) {
      problems.push(`${subject.title}, уровень ${levelId}: нет карты в structures-${subject.id}.json`);
      continue;
    }
    const rules = LEVEL_RULES[levelId];
    levels.push({ id: levelId, label: rules.label });

    const byId = new Map(level.structures.map((s) => [s.id, s]));
    const used = new Set();

    BANK[levelId].forEach((q, i) => {
      const s = byId.get(q.structure);
      if (!s) {
        problems.push(
          `${subject.title}, уровень ${levelId}, вопрос «${q.text.slice(0, 40)}»: на карте нет структуры «${q.structure}»`
        );
        return;
      }
      used.add(q.structure);
      if (!themes.includes(q.theme)) themes.push(q.theme);
      questions.push({
        id: `${subject.quizId}-l${levelId}-q${i + 1}`,
        text: q.text,
        answer: q.answer,
        helpText: q.hint,
        ...centered(s),
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
        genericDecoyPoints.push({ ...centered(s), level: levelId });
      }
    }
    for (const d of level.decoys) {
      genericDecoyPoints.push({ ...centered(d), level: levelId });
    }
  }

  const quiz = {
    schemaVersion: 1,
    id: subject.quizId,
    title: subject.title,
    intro: subject.intro,
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

  return quiz;
}

const built = SUBJECTS.map((s) => ({ subject: s, quiz: buildSubject(s) }));

if (problems.length) {
  console.error('Сборка не выполнена:');
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}

for (const { subject, quiz } of built) {
  const out = path.join(CONTENT, subject.out);
  fs.writeFileSync(out, JSON.stringify(quiz, null, 2) + '\n', 'utf-8');
  const byLevel = (n) => quiz.questions.filter((q) => q.level === n).length;
  const decoysOf = (n) => quiz.genericDecoyPoints.filter((d) => d.level === n).length;
  console.log(`«${quiz.title}» → ${subject.out}`);
  console.log(`  вопросов: ${quiz.questions.length} (${byLevel(1)} / ${byLevel(2)} / ${byLevel(3)})`);
  console.log(`  точек без привязки: ${quiz.genericDecoyPoints.length} (${decoysOf(1)} / ${decoysOf(2)} / ${decoysOf(3)})`);
  console.log(`  тем: ${quiz.themes.length}`);
}

// Небольшая викторина-образец для тестов редактора: по четыре вопроса на
// уровень, те же карты и те же точки без привязки.
//
// Она СОБИРАЕТСЯ ОТСЮДА, а не лежит отдельным файлом. У «ХимIQ» образцом была
// демо-сетка с химическими текстами на своей картинке demo_grid.png — то есть
// в поставку ехала химическая картинка, которую никто не открывал и потому не
// замечал. Собранный образец не может разойтись ни с картами, ни с предметом.
const base = built[0].quiz;
const demoQuestions = [1, 2, 3].flatMap((lvl) => base.questions.filter((q) => q.level === lvl).slice(0, 4));
const demo = {
  ...base,
  id: 'physastroiq-demo',
  title: 'ФизАстроIQ (образец)',
  intro: 'Короткая викторина-образец: по четыре вопроса на каждый уровень.',
  themes: [...new Set(demoQuestions.map((q) => q.theme))],
  questions: demoQuestions,
};
fs.writeFileSync(
  path.join(CONTENT, 'physastroiqDemoContent.json'),
  JSON.stringify(demo, null, 2) + '\n',
  'utf-8'
);
console.log(`Образец → physastroiqDemoContent.json (${demo.questions.length} вопросов)`);
