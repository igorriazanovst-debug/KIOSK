// packages/quiz-mini-player/tools/compare-review.mjs
//
// Сверка «слепого решения» эксперта с ключом банка:
//   node tools/compare-review.mjs astronomy
// Печатает расхождения (эксперт выбрал не тот вариант, что в ключе) и вопросы с
// флагами. Расхождение — не приговор вопросу: неправ может быть и эксперт. Это
// список того, что разбирается в режиме «рецензия с ключом».
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const subject = process.argv[2];
const norm = (s) => String(s).toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();

const key = new Map(JSON.parse(fs.readFileSync(path.join(ROOT, 'review', `${subject}-key.json`), 'utf8')).map((q) => [q.id, q]));
const answersDir = path.join(ROOT, 'review', 'answers');
const answers = fs.readdirSync(answersDir).filter((f) => f.startsWith(subject + '-') && f.endsWith('.json'))
  .flatMap((f) => JSON.parse(fs.readFileSync(path.join(answersDir, f), 'utf8')));

const seen = new Set();
const mismatches = [];
const flagged = [];
for (const a of answers) {
  const q = key.get(a.id);
  if (!q) { console.log(`неизвестный id в ответах: ${a.id}`); continue; }
  seen.add(a.id);
  if (norm(a.choice) !== norm(q.answer)) mismatches.push({ a, q });
  if (Array.isArray(a.flags) && a.flags.length > 0) flagged.push({ a, q });
}
const missing = [...key.keys()].filter((id) => !seen.has(id));

console.log(`${subject}: решено ${seen.size} из ${key.size}, расхождений с ключом ${mismatches.length}, с флагами ${flagged.length}, не решено ${missing.length}`);
console.log('\n=== РАСХОЖДЕНИЯ ===');
for (const { a, q } of mismatches) {
  console.log(`${a.id} [${q.block}] L${q.level} «${q.text}»\n   ключ: ${q.answer}\n   эксперт (${a.confidence}): ${a.choice}${a.note ? '\n   пометка: ' + a.note : ''}`);
}
console.log('\n=== ФЛАГИ ===');
for (const { a, q } of flagged) {
  console.log(`${a.id} [${q.block}] ${a.flags.join(', ')} — «${q.text}» → ${q.answer}${a.note ? '\n   ' + a.note : ''}`);
}
if (missing.length) console.log('\nне решены: ' + missing.join(', '));

const out = { subject, mismatches: mismatches.map(({ a, q }) => ({ id: a.id, key: q.answer, expert: a.choice, confidence: a.confidence, note: a.note || '' })),
  flagged: flagged.map(({ a }) => ({ id: a.id, flags: a.flags, note: a.note || '' })) };
fs.writeFileSync(path.join(ROOT, 'review', `${subject}-blind-result.json`), JSON.stringify(out, null, 1), 'utf8');
