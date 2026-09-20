// packages/quiz-mini-player/test/inlineSafe.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { inlineSafe } = require('../tools/inlineSafe.js');

const BACKSLASH = String.fromCharCode(92);
const CLOSING_TAG = '<' + '/script';

test('закрывающий тег script внутри кода перестаёт быть тегом для парсера HTML', () => {
  const out = inlineSafe('var a = "' + CLOSING_TAG + '>"; var b = "' + CLOSING_TAG.toUpperCase() + ' >";');
  assert.equal(out.toLowerCase().includes(CLOSING_TAG), false, out);
  assert.equal(out.includes('<' + BACKSLASH + '/script>'), true, out);
  assert.equal(out.includes('<' + BACKSLASH + '/SCRIPT >'), true, out);
});

test('для JavaScript строка остаётся той же', () => {
  const code = 'module.exports = "x' + CLOSING_TAG + '>y";';
  const m = { exports: null };
  new Function('module', inlineSafe(code))(m);
  assert.equal(m.exports, 'x' + CLOSING_TAG + '>y');
});

test('код без закрывающего тега не меняется', () => {
  const code = 'var s = "<script>"; var r = 1;';
  assert.equal(inlineSafe(code), code);
});

test('в собранном player.html ровно столько закрывающих тегов script, сколько блоков в шаблоне', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'release', 'player.html'), 'utf8').toLowerCase();
  const template = fs.readFileSync(path.join(__dirname, '..', 'src', 'template.html'), 'utf8').toLowerCase();
  const count = (text) => text.split(CLOSING_TAG).length - 1;
  assert.equal(count(html), count(template));
});
