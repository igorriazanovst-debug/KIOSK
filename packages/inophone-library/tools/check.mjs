// packages/inophone-library/tools/check.mjs
// Проверка пакета контента ТЕМИ ЖЕ правилами, что применит приложение при
// старте: разбор схемы из @kiosk/shared, отчёт о комплектности, квоты ТЗ.
//
// Вторых правил здесь нет намеренно. Проверка, написанная отдельно от той, что
// работает в приложении, доказывает только собственную непротиворечивость: у
// эталона так и вышло — часть словаря в XML, часть в коде, и сверить их между
// собой было нечем.
//
// ВЫХОДНОЙ КОД НЕНУЛЕВОЙ, только если пакет НЕЛЬЗЯ ПРОЧИТАТЬ. Неполнота — не
// ошибка сборки: контент набирается постепенно, и падающая на каждом шаге
// проверка перестаёт запускаться уже к третьему дню. Недостающее печатается
// поимённо и остаётся видимым.
//
// Запуск: node tools/check.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// У пакета контента нет своего node_modules — собранный shared берётся ПО ПУТИ,
// а не по имени. Тот же приём, что в words-library/tools/build.mjs
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ASSETS = path.join(ROOT, 'assets');

const sharedPath = path.resolve(ROOT, '../shared/dist/index.js');
if (!fs.existsSync(sharedPath)) {
  console.error(`Не найден собранный @kiosk/shared: ${sharedPath}
Соберите: cd packages/shared && npm run build`);
  process.exit(1);
}
const { inophone } = createRequire(import.meta.url)(sharedPath);

function listFiles(dir, prefix = '') {
  const out = new Set();
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) for (const f of listFiles(path.join(dir, entry.name), rel)) out.add(f);
    else out.add(rel);
  }
  return out;
}

let library;
try {
  library = inophone.parseInophoneLibrary(JSON.parse(fs.readFileSync(path.join(ROOT, 'index.json'), 'utf8')));
} catch (err) {
  console.error(`ПАКЕТ НЕ ЧИТАЕТСЯ: ${err.message}`);
  process.exit(1);
}

const present = listFiles(ASSETS);
const completeness = inophone.checkCompleteness(library, present);
const quotas = inophone.checkQuotas(library);

console.log(`тем ${library.themes.length}, сцен ${library.scenes.length}, понятий ${library.concepts.length}`);
console.log(`файлов в пакете: ${present.size}`);
console.log('');

const row = (name, q) => `${q.ok ? 'есть' : 'НЕ ХВАТАЕТ'}  ${name}: ${q.have} из ${q.need} (запас ${q.spare})`;
console.log('Квоты ТЗ');
console.log('  ' + row('слов на шести языках', quotas.words));
console.log('  ' + row('сцен', quotas.scenes));
console.log('  ' + row('тем', quotas.themes));
console.log('');

console.log('Комплектность');
console.log(`  понятий с переводом на все языки: ${completeness.fullyTranslated}`);
console.log(`  понятий с озвучкой на все языки:  ${completeness.fullyVoiced}`);
console.log(`  недостающих файлов: ${completeness.missingCount}`);
for (const f of completeness.missingFiles) console.log(`    нет: ${f}`);
if (completeness.missingCount > completeness.missingFiles.length) {
  console.log(`    …и ещё ${completeness.missingCount - completeness.missingFiles.length}`);
}
for (const f of completeness.extraFiles) console.log(`    лишний: ${f}`);
console.log('  не записана озвучка, по языкам:');
for (const code of inophone.LANGUAGE_CODES) {
  console.log(`    ${inophone.languageInfo(code).russianName}: ${completeness.audioGapByLanguage[code]}`);
}
