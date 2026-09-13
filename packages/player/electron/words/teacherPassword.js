// packages/player/electron/words/teacherPassword.js
// Пароль педагога виджета «Я знаю много слов» (Тип 2).
//
// Сам механизм общий и живёт в electron/common/teacherPassword.js — он
// понадобился второму виджету слово в слово. Здесь остаётся только СОЛЬ:
// общий код не повод давать двум виджетам общий пароль, каталоги данных у
// них разные, и хеш из одного не должен подходить к другому.
//
// Соль не менялась при выносе: иначе у всех, кто уже сменил пароль,
// приложение перестало бы его принимать.

const { createTeacherPassword } = require('../common/teacherPassword');

const SALT = 'kiosk-words-teacher';

module.exports = createTeacherPassword({ salt: SALT });
