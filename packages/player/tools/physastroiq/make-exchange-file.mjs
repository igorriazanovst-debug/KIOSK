// packages/player/tools/physastroiq/make-exchange-file.mjs
//
// Собирает файл викторины для проверки обмена (FR-014 и первая половина
// FR-019 — «экспорт викторины в отдельный файл»).
//
// ФАЙЛ СОБИРАЕТСЯ ТЕМ ЖЕ КОДОМ, ЧТО И ЭКСПОРТ В ПРИЛОЖЕНИИ
// (`buildExportPayload` + `serializeExportPayload` из editor/quizExport.ts), а
// не пишется руками. Написанный руками JSON проверял бы не продукт, а мою
// аккуратность: он либо не прошёл бы импорт, либо — хуже — прошёл бы, будучи
// непохожим на то, что порождает настоящий экспорт, и проверка оказалась бы
// ни о чём.
//
// И ТУТ ЖЕ ПРОВЕРЯЕТСЯ ИМПОРТЁРОМ ПРОДУКТА (`parseAndPersistImportedQuiz`).
// Отдать на приёмку файл, который не открывается, — это потратить чужое
// время на свою ошибку.
//
// ЧЕГО ЭТОТ ФАЙЛ НЕ ДОКАЗЫВАЕТ. Вторая половина FR-019 — «без необходимости
// установки продукта» — импортом не проверяется в принципе: чтобы
// импортировать, продукт уже нужен. Это расхождение записано в
// docs/physastroiq-acceptance-matrix.md §4.2 и в пункте 6.5 программы испытаний.
//
// Запуск: node --experimental-strip-types tools/physastroiq/make-exchange-file.mjs [куда]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PhysastroiqQuizSchema } from '../../src/physastroiq/model/schema.ts';
import { checkPhysastroiqQuiz } from '../../src/physastroiq/model/completeness.ts';
import {
  buildExportPayload,
  serializeExportPayload,
  parseAndPersistImportedQuiz,
} from '../../src/physastroiq/editor/quizExport.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLAYER = path.join(HERE, '..', '..');
const PUBLIC_PHYSASTROIQ = path.join(PLAYER, 'public', 'physastroiq');
const OUT = process.argv[2] || path.join(PLAYER, '..', '..', 'docs', 'physastroiq-exchange-check.json');

/** Сколько вопросов на уровень оставить: партия должна проходиться быстро. */
const PER_LEVEL = 4;

const real = JSON.parse(
  fs.readFileSync(path.join(PLAYER, 'src', 'physastroiq', 'content', 'physastroiqRealContent.json'), 'utf-8')
);

// Берём по нескольку вопросов с РАЗНЫМИ темами: проверяющему полезнее увидеть
// разные темы, чем четыре вопроса про одну и ту же структуру.
function pick(level) {
  const pool = real.questions.filter((q) => q.level === level);
  const chosen = [];
  const usedThemes = new Set();
  for (const q of pool) {
    if (chosen.length >= PER_LEVEL) break;
    if (usedThemes.has(q.theme)) continue;
    usedThemes.add(q.theme);
    chosen.push(q);
  }
  for (const q of pool) {
    if (chosen.length >= PER_LEVEL) break;
    if (!chosen.includes(q)) chosen.push(q);
  }
  return chosen;
}

const questions = [1, 2, 3].flatMap((level) => pick(level));

const quiz = PhysastroiqQuizSchema.parse({
  ...real,
  id: 'physastroiq-exchange-check',
  title: 'Обмен — проверка FR-014',
  intro:
    'Файл для проверки обмена викторинами. Если вы это читаете в списке викторин — ' +
    'импорт сработал: вопросы и все три изображения-карты приехали одним файлом. ' +
    'По четыре вопроса на каждый уровень.',
  questions,
  // Точки без привязки к вопросу оставлены ВСЕ: викторина в файле должна быть
  // не просто читаемой, а соответствующей ТЗ — не меньше десяти на уровень.
  // Иначе проверяющий откроет её в редакторе и увидит замечания, которые
  // относятся к моей нарезке, а не к обмену.
  genericDecoyPoints: real.genericDecoyPoints,
});

const problems = checkPhysastroiqQuiz(quiz);
if (problems.length > 0) {
  console.error('Викторина для обмена не проходит проверку комплектности:');
  for (const p of problems) console.error(`  ${p.requirement}: ${p.message}`);
  process.exit(1);
}

// Картинки читаются с диска, а не через physastroiqmedia:// — схема живёт только
// внутри плеера. Формат отдаваемого значения тот же, что у настоящего
// fetchMediaAsBase64.
const fetchAsBase64 = async (mediaUrl) => {
  const fileName = decodeURIComponent(String(mediaUrl)).split('/').pop();
  const file = path.join(PUBLIC_PHYSASTROIQ, fileName);
  if (!fs.existsSync(file)) return null;
  return { base64: fs.readFileSync(file).toString('base64'), mimeType: 'image/png' };
};

const payload = await buildExportPayload(quiz, fetchAsBase64);
const json = serializeExportPayload(payload);

const missing = Object.keys(quiz.images)
  .map((k) => quiz.images[k].fileName)
  .filter((name) => !payload.images[name]);
if (missing.length > 0) {
  console.error('В файл не попали изображения: ' + missing.join(', '));
  process.exit(1);
}

// ─── Проверка импортёром продукта ──────────────────────────────────────────
//
// Заглушки только СОХРАНЯЮТ на диск — вся разборка, проверка формата и схемы
// идёт настоящим кодом приложения.
const persisted = [];
const persistLevelImage = async (quizId, level, bytes, mimeType) => {
  persisted.push(`уровень ${level}: ${bytes.length} байт, ${mimeType}`);
  return { ok: true, fileName: `level-${level}.png` };
};
const persistItemImage = async (quizId, questionId, kind) => ({ ok: true, fileName: `${questionId}-${kind}.png` });

const imported = await parseAndPersistImportedQuiz(json, persistLevelImage, persistItemImage);
if (!imported.ok) {
  console.error('Импортёр продукта ОТКЛОНИЛ собранный файл: ' + imported.error);
  process.exit(1);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, json, 'utf-8');

const byLevel = (n) => quiz.questions.filter((q) => q.level === n).length;
console.log(`Файл обмена собран: ${OUT}`);
console.log(`  размер: ${(json.length / 1024).toFixed(0)} КБ`);
console.log(`  вопросов: ${quiz.questions.length} (${byLevel(1)} / ${byLevel(2)} / ${byLevel(3)})`);
console.log(`  изображений внутри: ${Object.keys(payload.images).length}`);
console.log(`  тем: ${quiz.themes.length}`);
console.log('\nПроверено импортёром продукта (parseAndPersistImportedQuiz):');
console.log(`  формат принят, викторина разобрана, id выдан свежий: ${imported.quiz.id !== quiz.id ? 'да' : 'НЕТ'}`);
for (const p of persisted) console.log(`  восстановлено изображение — ${p}`);
