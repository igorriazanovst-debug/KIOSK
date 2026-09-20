// packages/quiz-mini-player/bank/bankRules.js
//
// Правила качества текстового банка. Пишутся ВМЕСТЕ с банком, а не после: у
// викторины с выбором ответа самый дорогой дефект — «ответ находится не тем
// навыком, который проверяет вопрос» (по длине варианта, по слову из вопроса,
// по подсказке). Глазами на сотнях вопросов это не ловится.
//
// Каждая функция возвращает список нарушений с id вопроса; пустой список —
// правило выполнено. Позиция верного варианта здесь не проверяется: варианты
// перемешивает проигрыватель при каждом показе (quizCore.buildOptions).
'use strict';

const LIMITS = { text: 170, option: 70, hint: 170, minHint: 12 };
const WRONG_COUNT = 3;
/** При случайной длине верный вариант оказывается самым длинным в 25 % вопросов */
const MAX_LENGTH_BIAS_SHARE = 0.36;
const MAX_SAME_ANSWER = 4;
const MIN_STEM_LENGTH = 5;
const LEVEL_SHARE_RANGE = { min: 0.27, max: 0.4 };

const norm = (s) => String(s).toLowerCase().replace(/ё/g, 'е').replace(/[«»"'.,!?;:()–—-]/g, ' ').replace(/\s+/g, ' ').trim();

// Ответ не должен зависеть от числа или рекорда, который меняется со временем
const VOLATILE_PATTERNS = [
  /сколько (сейчас |на сегодня )?(известно|открыто|обнаружено)/i,
  /на сегодняшний день|в настоящее время|в наши дни|сейчас работает|действующ(ий|ая|ее)/i,
  /сам(ый|ая|ое) (больш|крупн|мощн|далёк|далек|массивн)\S* (телескоп|обсерватор|галактик|звезд|экзопланет|чёрн|черн)/i,
  /последн(ий|яя|ее) (полёт|полет|миссия|запуск|экспедиция)/i,
  /сколько спутников у (юпитера|сатурна|урана|нептуна)/i,
];
const BANNED_OPTIONS = [/^вс[её] (перечисленн|вышеперечисленн)/i, /^нет (верного|правильного)/i, /^ни (один|одна|одно) из/i, /^оба /i];

function schemaViolations(questions) {
  const out = [];
  for (const q of questions) {
    const bad = (why) => out.push({ id: q.id, rule: 'schema', why });
    for (const field of ['text', 'answer', 'helpText', 'theme']) {
      if (typeof q[field] !== 'string' || !q[field].trim()) bad(`пустое поле ${field}`);
    }
    if (![1, 2, 3].includes(q.level)) bad(`уровень ${q.level}`);
    if (!Array.isArray(q.wrong) || q.wrong.length !== WRONG_COUNT) { bad(`нужно ровно ${WRONG_COUNT} неверных варианта`); continue; }
    const options = [q.answer, ...q.wrong].map(norm);
    if (new Set(options).size !== options.length) bad('варианты повторяются');
    if (String(q.text).length > LIMITS.text) bad(`вопрос длиннее ${LIMITS.text}`);
    if (String(q.helpText).length > LIMITS.hint) bad(`подсказка длиннее ${LIMITS.hint}`);
    if (String(q.helpText).trim().length < LIMITS.minHint) bad('подсказка слишком короткая, чтобы помогать');
    for (const o of [q.answer, ...q.wrong]) {
      if (String(o).length > LIMITS.option) bad(`вариант длиннее ${LIMITS.option}: «${o}»`);
      if (BANNED_OPTIONS.some((re) => re.test(String(o).trim()))) bad(`вариант-уловка: «${o}»`);
    }
    if (!/[?…:.]$/.test(String(q.text).trim())) bad('вопрос не закончен знаком');
  }
  return out;
}

/** Значимые слова ответа: без чисел и коротких служебных */
function answerStems(answer) {
  return norm(answer).split(' ')
    .filter((w) => w.length >= MIN_STEM_LENGTH && !/\d/.test(w))
    .map((w) => w.slice(0, Math.max(MIN_STEM_LENGTH - 1, w.length - 2)));
}

function leakViolations(questions) {
  const out = [];
  for (const q of questions) {
    const stems = answerStems(q.answer);
    if (stems.length === 0) continue;
    const wrongText = norm(q.wrong.join(' '));
    // Слово, общее для ответа и неверных вариантов («созвездие Лебедя» /
    // «созвездие Лиры»), ответа не выдаёт — его не считаем
    const telling = stems.filter((stem) => !wrongText.includes(stem));
    // Корень ищется в НАЧАЛЕ слова: «ранн…» (ранняя) внутри «собранного» —
    // совпадение букв, а не однокоренное слово
    const hasWordWith = (normalized, stem) => normalized.split(' ').some((word) => word.startsWith(stem));
    const text = norm(q.text);
    const hint = norm(q.helpText);
    for (const stem of telling) {
      if (hasWordWith(text, stem)) out.push({ id: q.id, rule: 'leak', why: `ответ читается в вопросе: «${stem}…»` });
      if (hasWordWith(hint, stem)) out.push({ id: q.id, rule: 'leak', why: `подсказка называет ответ: «${stem}…»` });
    }
  }
  return out;
}

function lengthBiasViolations(questions) {
  let longest = 0;
  let shortest = 0;
  for (const q of questions) {
    const a = q.answer.length;
    const others = q.wrong.map((w) => w.length);
    if (others.every((len) => a > len)) longest += 1;
    if (others.every((len) => a < len)) shortest += 1;
  }
  const out = [];
  const share = (n) => n / Math.max(1, questions.length);
  if (share(longest) > MAX_LENGTH_BIAS_SHARE) out.push({ id: '*', rule: 'length-bias', why: `верный вариант самый длинный в ${(share(longest) * 100).toFixed(0)} % вопросов` });
  if (share(shortest) > MAX_LENGTH_BIAS_SHARE) out.push({ id: '*', rule: 'length-bias', why: `верный вариант самый короткий в ${(share(shortest) * 100).toFixed(0)} % вопросов` });
  return out;
}

function kindViolations(questions) {
  const out = [];
  const hasDigit = (s) => /\d/.test(s);
  for (const q of questions) {
    const kinds = [q.answer, ...q.wrong].map(hasDigit);
    if (new Set(kinds).size > 1) out.push({ id: q.id, rule: 'kind', why: 'числовые и нечисловые варианты вперемешку — верный выделяется родом' });
  }
  return out;
}

function duplicateViolations(questions) {
  const out = [];
  const byText = new Map();
  const byAnswer = new Map();
  for (const q of questions) {
    const t = norm(q.text);
    if (byText.has(t)) out.push({ id: q.id, rule: 'duplicate', why: `текст повторяет ${byText.get(t)}` });
    else byText.set(t, q.id);
    const a = norm(q.answer);
    byAnswer.set(a, [...(byAnswer.get(a) || []), q.id]);
  }
  for (const [answer, ids] of byAnswer) {
    if (ids.length > MAX_SAME_ANSWER) out.push({ id: ids.join(','), rule: 'overuse', why: `ответ «${answer}» у ${ids.length} вопросов — перекос` });
  }
  return out;
}

function volatileViolations(questions) {
  const out = [];
  for (const q of questions) {
    if (VOLATILE_PATTERNS.some((re) => re.test(q.text))) {
      out.push({ id: q.id, rule: 'volatile', why: 'ответ зависит от факта, который меняется со временем' });
    }
  }
  return out;
}

function balanceViolations(questions, expectedTotal) {
  const out = [];
  if (expectedTotal !== undefined && questions.length !== expectedTotal) {
    out.push({ id: '*', rule: 'balance', why: `вопросов ${questions.length}, а должно быть ${expectedTotal}` });
  }
  for (const level of [1, 2, 3]) {
    const share = questions.filter((q) => q.level === level).length / Math.max(1, questions.length);
    if (share < LEVEL_SHARE_RANGE.min || share > LEVEL_SHARE_RANGE.max) {
      out.push({ id: '*', rule: 'balance', why: `уровень ${level}: ${(share * 100).toFixed(0)} % банка` });
    }
  }
  return out;
}

function allViolations(questions, expectedTotal) {
  return [
    ...schemaViolations(questions), ...leakViolations(questions), ...lengthBiasViolations(questions),
    ...kindViolations(questions), ...duplicateViolations(questions), ...volatileViolations(questions),
    ...balanceViolations(questions, expectedTotal),
  ];
}

module.exports = {
  LIMITS, norm, schemaViolations, leakViolations, lengthBiasViolations, kindViolations,
  duplicateViolations, volatileViolations, balanceViolations, allViolations,
};
