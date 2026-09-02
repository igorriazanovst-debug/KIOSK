// packages/player/electron/chrono/sessionLock.js
// Состояние разблокировки редактирования на стороне ГЛАВНОГО процесса.
//
// Найдено security-review Фазы 4 (CRITICAL): React-состояние `unlocked` в
// ChronolineRuntime.tsx решает только, какие callback-пропсы передать в
// BoardView - оно ничего не сообщает main-процессу. Поскольку
// window.chronoAPI (preload.js) выставляет createProject/renameProject/
// deleteProject/saveProjectData как обычные функции на window, ЛЮБОЙ код
// в рендерере (например, из DevTools) мог вызвать их напрямую и обойти
// пароль полностью - UI-гейт canEdit не является границей авторизации,
// только UX. Эта граница обязана жить здесь, в main-процессе: каждый
// мутирующий IPC-канал (ipc.js) обязан проверять isUnlocked() перед тем,
// как выполнить операцию, независимо от того, что решил рендерер.
//
// Разблокировка живёт в памяти процесса (не на диске - в отличие от
// счётчика неудачных попыток в auth.js, который обязан переживать
// перезапуск приложения, разблокировка НЕ должна: перезапуск обязан
// требовать пароль заново) и истекает по бездействию - иначе однажды
// разблокированный редактор остаётся открытым до следующего перезапуска
// приложения, что для необслуживаемого киоска может значить недели.

const IDLE_TIMEOUT_MS = 30 * 60_000; // 30 минут бездействия - автоблокировка

function createSessionLock(idleTimeoutMs = IDLE_TIMEOUT_MS) {
  let unlockedAt = null;

  return {
    unlock() {
      unlockedAt = Date.now();
    },
    lock() {
      unlockedAt = null;
    },
    isUnlocked() {
      if (unlockedAt === null) return false;
      if (Date.now() - unlockedAt > idleTimeoutMs) {
        unlockedAt = null;
        return false;
      }
      return true;
    },
    /** Продлевает сессию при каждом успешном мутирующем действии, не только при входе */
    touch() {
      if (unlockedAt !== null) unlockedAt = Date.now();
    },
  };
}

module.exports = { createSessionLock, IDLE_TIMEOUT_MS };
