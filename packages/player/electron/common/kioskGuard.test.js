// Тесты блокируемых сочетаний киоск-режима (AAA).
const test = require('node:test');
const assert = require('node:assert/strict');
const { isBlockedKioskInput } = require('./kioskGuard.js');

const key = (k, mods = {}) => ({ type: 'keyDown', key: k, control: !!mods.ctrl, alt: !!mods.alt, shift: !!mods.shift });

test('isBlockedKioskInput: Alt+F4, Ctrl+Q, Ctrl+W блокируются', () => {
  // Arrange + Act + Assert
  assert.equal(isBlockedKioskInput(key('F4', { alt: true })), true);
  assert.equal(isBlockedKioskInput(key('q', { ctrl: true })), true);
  assert.equal(isBlockedKioskInput(key('W', { ctrl: true })), true);
});

test('isBlockedKioskInput: F12/F5/Ctrl+R/Ctrl+Shift+I блокируются', () => {
  assert.equal(isBlockedKioskInput(key('F12')), true);
  assert.equal(isBlockedKioskInput(key('F5')), true);
  assert.equal(isBlockedKioskInput(key('r', { ctrl: true })), true);
  assert.equal(isBlockedKioskInput(key('i', { ctrl: true, shift: true })), true);
});

test('isBlockedKioskInput: обычные клавиши и навигация не блокируются', () => {
  assert.equal(isBlockedKioskInput(key('a')), false);
  assert.equal(isBlockedKioskInput(key('Enter')), false);
  assert.equal(isBlockedKioskInput(key('ArrowRight')), false);
  assert.equal(isBlockedKioskInput(key('c', { ctrl: true })), false); // копирование не трогаем
  assert.equal(isBlockedKioskInput(key('r', { alt: true })), false); // не ctrl
});

test('isBlockedKioskInput: keyUp не блокируется (только keyDown)', () => {
  // Arrange
  const up = { type: 'keyUp', key: 'F4', alt: true, control: false, shift: false };
  // Act + Assert
  assert.equal(isBlockedKioskInput(up), false);
});

test('isBlockedKioskInput: пустой ввод безопасен', () => {
  assert.equal(isBlockedKioskInput(null), false);
  assert.equal(isBlockedKioskInput({}), false);
});
