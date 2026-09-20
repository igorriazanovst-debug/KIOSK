// usage: node tools/check-block.js bank/astronomy/<блок>.json [ожидаемое число]
// Самопроверка одного блока банка теми же правилами, что и весь банк.
'use strict';
const fs = require('node:fs');
const rules = require('../bank/bankRules.js');
const file = process.argv[2];
const expected = process.argv[3] ? Number(process.argv[3]) : undefined;
const questions = JSON.parse(fs.readFileSync(file, 'utf8')).map((q, i) => ({ id: `#${i + 1}`, ...q }));
const violations = rules.allViolations(questions, expected);
const levels = [1, 2, 3].map((l) => questions.filter((q) => q.level === l).length);
console.log(`вопросов: ${questions.length}, по уровням: ${levels.join('/')}, нарушений: ${violations.length}`);
for (const v of violations) console.log(`  ${v.id} [${v.rule}] ${v.why}`);
process.exit(violations.length ? 1 : 0);
