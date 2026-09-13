// packages/player/electron/alphabet/teacherPassword.js
// Пароль педагога виджета «АзбукоСлов» (Тип 3).
//
// Механизм общий (electron/common/teacherPassword.js), своя здесь только
// соль: у виджетов разные каталоги данных, и пароль, заданный в одном, не
// должен открывать другой.

const { createTeacherPassword } = require('../common/teacherPassword');

const SALT = 'kiosk-alphabet-teacher';

module.exports = createTeacherPassword({ salt: SALT });
