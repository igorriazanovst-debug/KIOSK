// Киоск-защита главного окна (ТЗ Калининград, MUS-KIOSK-02/03): блокируемые
// сочетания клавиш. Посетитель не должен закрыть приложение или открыть
// инструменты разработчика/перезагрузку; выход — только из админ-режима.
// Модуль без electron: логика проверяется node:test.

// input — объект Input из Electron 'before-input-event' (type/key/control/alt/shift).
function isBlockedKioskInput(input) {
  if (!input || input.type !== 'keyDown') return false;
  const key = String(input.key || '');
  const ctrl = !!input.control && !input.alt;
  const alt = !!input.alt && !input.control;
  const shift = !!input.shift;
  // MUS-KIOSK-02: закрытие
  if (alt && !shift && key === 'F4') return true; // Alt+F4
  if (ctrl && !shift && (key === 'q' || key === 'Q')) return true; // Ctrl+Q
  if (ctrl && !shift && (key === 'w' || key === 'W')) return true; // Ctrl+W
  // MUS-KIOSK-03: инструменты и перезагрузка
  if (key === 'F12') return true;
  if (key === 'F5') return true;
  if (ctrl && shift && ['i', 'I', 'j', 'J', 'c', 'C'].includes(key)) return true; // DevTools/консоль
  if (ctrl && !shift && (key === 'r' || key === 'R')) return true; // Ctrl+R
  return false;
}

module.exports = { isBlockedKioskInput };
