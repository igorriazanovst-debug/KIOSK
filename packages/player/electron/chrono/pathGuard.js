// packages/player/electron/chrono/pathGuard.js
// Единственная точка, через которую любой код виджета «Хронолиния» может
// превратить относительный путь (id проекта, имя файла медиа и т.п.) в
// реальный путь на диске. Пишется ДО первого файлового API, не после —
// см. Хронолайнер_план_реализации.md, Фаза 1, Трек C.
//
// Защищает от path traversal (`../../etc`) и от абсолютных путей, которые
// Node.js path.resolve() иначе тихо принимает как есть, отбрасывая корень:
// path.resolve('/safe/root', '/etc/passwd') === '/etc/passwd', не
// '/safe/root/etc/passwd'. Поэтому проверка — не на наличие "..", а на то,
// что итоговый разрешённый путь физически остаётся внутри корня.

const path = require('path');

class PathGuardError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PathGuardError';
  }
}

/**
 * Разрешает relativePath внутри root. Бросает PathGuardError, если итоговый
 * путь выходит за пределы root (traversal, абсолютный путь, посторонний диск).
 *
 * @param {string} root
 * @param {string} relativePath
 * @returns {string} абсолютный путь внутри root
 */
function resolveWithinRoot(root, relativePath) {
  if (typeof relativePath !== 'string' || relativePath.length === 0) {
    throw new PathGuardError('Empty or non-string path');
  }
  // Нулевой байт — классический трюк обхода проверок расширения/пути.
  if (relativePath.includes('\0')) {
    throw new PathGuardError('Path contains a null byte');
  }

  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);

  const rootWithSep = resolvedRoot.endsWith(path.sep) ? resolvedRoot : resolvedRoot + path.sep;

  if (resolved !== resolvedRoot && !resolved.startsWith(rootWithSep)) {
    throw new PathGuardError(`Path escapes storage root: ${relativePath}`);
  }

  return resolved;
}

/**
 * То же самое, но возвращает null вместо исключения — удобно для мест,
 * где отказ должен быть тихим (например, при листинге, где один плохой
 * элемент не должен ронять весь список).
 */
function tryResolveWithinRoot(root, relativePath) {
  try {
    return resolveWithinRoot(root, relativePath);
  } catch {
    return null;
  }
}

module.exports = { resolveWithinRoot, tryResolveWithinRoot, PathGuardError };
