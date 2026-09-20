// packages/quiz-mini-player/tools/apply-patches.mjs
//
// Применяет правки экспертной рецензии (review/patches/*.json) к блокам банка.
//   node tools/apply-patches.mjs            применить
//   node tools/apply-patches.mjs --dry-run  только показать
//
// Правка адресуется id вопроса (astro-017), а id — это порядковый номер в
// собранном банке. Поэтому правки применяются к тому же составу блоков, по
// которому шла рецензия; менять число вопросов в блоках между рецензией и
// применением нельзя — скрипт сверяет текст вопроса с ключом рецензии и
// останавливается, если они разошлись.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUBJECTS, loadSubject } from './build-bank.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry-run');
const ALLOWED_FIELDS = new Set(['text', 'answer', 'wrong', 'helpText', 'theme']);

const patchDir = path.join(ROOT, 'review', 'patches');
const patches = fs.readdirSync(patchDir).filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(fs.readFileSync(path.join(patchDir, f), 'utf8')).map((p) => ({ ...p, file: f })));

const summary = { patch: 0, keep: 0, fields: {} };
for (const subject of SUBJECTS) {
  const questions = loadSubject(subject);
  const keyById = new Map(JSON.parse(fs.readFileSync(path.join(ROOT, 'review', `${subject.key}-key.json`), 'utf8')).map((q) => [q.id, q]));
  const blocks = new Map();
  const position = new Map();
  for (const q of questions) {
    if (!blocks.has(q.block)) blocks.set(q.block, JSON.parse(fs.readFileSync(path.join(ROOT, 'bank', subject.key, q.block), 'utf8')));
    const indexInBlock = [...position.values()].filter((p) => p.block === q.block).length;
    position.set(q.id, { block: q.block, index: indexInBlock });
  }
  const touched = new Set();
  for (const p of patches.filter((x) => x.id.startsWith(subject.idPrefix + '-'))) {
    const pos = position.get(p.id);
    if (!pos) throw new Error(`${p.file}: неизвестный id ${p.id}`);
    if (p.action === 'keep') { summary.keep += 1; continue; }
    if (p.action !== 'patch' || !p.set || typeof p.set !== 'object') throw new Error(`${p.file}: ${p.id}: непонятное действие`);
    const target = blocks.get(pos.block)[pos.index];
    const reviewed = keyById.get(p.id);
    if (!reviewed || reviewed.text !== target.text) throw new Error(`${p.id}: вопрос в банке уже не тот, по которому шла рецензия — правка не применяется`);
    for (const [field, value] of Object.entries(p.set)) {
      if (!ALLOWED_FIELDS.has(field)) throw new Error(`${p.id}: поле ${field} править нельзя`);
      if (field === 'wrong' ? !(Array.isArray(value) && value.length === 3 && value.every((v) => typeof v === 'string')) : typeof value !== 'string') {
        throw new Error(`${p.id}: неверное значение поля ${field}`);
      }
      target[field] = value;
      summary.fields[field] = (summary.fields[field] || 0) + 1;
    }
    summary.patch += 1;
    touched.add(pos.block);
  }
  if (!DRY) {
    for (const block of touched) {
      fs.writeFileSync(path.join(ROOT, 'bank', subject.key, block), JSON.stringify(blocks.get(block), null, 2) + '\n', 'utf8');
    }
  }
}
console.log(`${DRY ? '[проба] ' : ''}правок: ${summary.patch}, оставлено как есть: ${summary.keep}, по полям: ${JSON.stringify(summary.fields)}`);
