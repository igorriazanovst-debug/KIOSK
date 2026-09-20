// packages/quiz-mini-player/test/bankRules.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../bank/bankRules.js');

const good = (over = {}) => ({
  id: 'a1', level: 1, theme: 'Планеты', text: 'Какая планета ближе всех к Солнцу?', answer: 'Меркурий',
  wrong: ['Венера', 'Марс', 'Юпитер'], helpText: 'Самая маленькая планета, год на ней длится 88 суток.', ...over,
});

test('исправный вопрос не нарушает ни одного правила', () => {
  assert.deepEqual(rules.schemaViolations([good()]), []);
  assert.deepEqual(rules.leakViolations([good()]), []);
  assert.deepEqual(rules.kindViolations([good()]), []);
  assert.deepEqual(rules.volatileViolations([good()]), []);
});

test('схема: пустые поля, не три неверных, повтор варианта, уловки, нет знака в конце', () => {
  const why = (q) => rules.schemaViolations([q]).map((v) => v.why).join(' | ');
  assert.match(why(good({ helpText: '' })), /пустое поле helpText/);
  assert.match(why(good({ wrong: ['Венера', 'Марс'] })), /ровно 3/);
  assert.match(why(good({ wrong: ['Венера', 'венера', 'Марс'] })), /повторяются/);
  assert.match(why(good({ wrong: ['Венера', 'Марс', 'Все перечисленные'] })), /уловка/);
  assert.match(why(good({ text: 'Какая планета ближе всех к Солнцу' })), /не закончен/);
  assert.match(why(good({ level: 4 })), /уровень 4/);
});

test('утечка: ответ в тексте вопроса и в подсказке — в том числе однокоренным словом', () => {
  const inText = good({ text: 'Как называется планета Меркурий, ближайшая к Солнцу?' });
  assert.match(rules.leakViolations([inText])[0].why, /читается в вопросе/);
  const inHint = good({ helpText: 'Орбита меркурианского года — 88 суток.' });
  assert.match(rules.leakViolations([inHint])[0].why, /подсказка называет/);
});

test('совпадение букв внутри другого слова утечкой не считается', () => {
  const q = good({ text: 'О чём говорит равномерность реликтового излучения?', answer: 'Оно рождено всей ранней Вселенной',
    wrong: ['Его источник в центре Галактики', 'Оно возникает в атмосфере Земли', 'Его испускает Солнце'],
    helpText: 'Свет от источника, собранного в одном месте, приходит с одной стороны неба.' });
  assert.deepEqual(rules.leakViolations([q]), []);
});

test('слово, общее для ответа и неверных вариантов, утечкой не считается', () => {
  const q = good({
    text: 'В каком созвездии находится Денеб?', answer: 'Созвездие Лебедя',
    wrong: ['Созвездие Лиры', 'Созвездие Орла', 'Созвездие Ориона'], helpText: 'Это созвездие называют ещё Северным Крестом.',
  });
  assert.deepEqual(rules.leakViolations([q]), []);
});

test('перекос длины: верный вариант систематически самый длинный', () => {
  const biased = Array.from({ length: 10 }, (_, i) => good({ id: 'b' + i, answer: 'Очень длинный правильный ответ ' + i, wrong: ['Кратко', 'Мало', 'Нет'] }));
  assert.match(rules.lengthBiasViolations(biased)[0].why, /самый длинный в 100 %/);
  const fair = Array.from({ length: 12 }, (_, i) => good({ id: 'f' + i, answer: i % 4 === 0 ? 'Самый длинный вариант' : 'Да-да', wrong: ['Средний', 'Ещё подлиннее', 'Нет'] }));
  assert.deepEqual(rules.lengthBiasViolations(fair), []);
});

test('род вариантов: число среди слов выдаёт ответ', () => {
  assert.equal(rules.kindViolations([good({ answer: '8', wrong: ['Семь', 'Девять', 'Десять'] })]).length, 1);
  assert.deepEqual(rules.kindViolations([good({ answer: '8', wrong: ['7', '9', '10'] })]), []);
});

test('дубли текста и злоупотребление одним ответом', () => {
  const dup = [good({ id: 'd1' }), good({ id: 'd2', text: 'какая планета ближе всех к солнцу?' })];
  assert.match(rules.duplicateViolations(dup)[0].why, /повторяет d1/);
  const over = Array.from({ length: 5 }, (_, i) => good({ id: 'o' + i, text: `Вопрос ${i} о планете?` }));
  assert.match(rules.duplicateViolations(over)[0].why, /перекос/);
});

test('нестабильные факты отлавливаются по формулировке', () => {
  for (const text of ['Сколько спутников у Сатурна?', 'Какой самый большой телескоп в мире?', 'Сколько экзопланет известно на сегодняшний день?']) {
    assert.equal(rules.volatileViolations([good({ text })]).length, 1, text);
  }
});

test('баланс: общее число и доля уровней', () => {
  const bank = Array.from({ length: 9 }, (_, i) => good({ id: 'q' + i, level: (i % 3) + 1 }));
  assert.deepEqual(rules.balanceViolations(bank, 9), []);
  assert.match(rules.balanceViolations(bank, 10)[0].why, /должно быть 10/);
  assert.match(rules.balanceViolations(bank.map((q) => ({ ...q, level: 1 })), 9)[0].why, /уровень 1: 100 %/);
});
