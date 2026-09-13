// packages/player/src/rusiq/rusiqMediaUrl.ts
// Резолвинг имени файла фонового изображения пользовательской викторины в
// реально загружаемый URL. Схема rusiqmedia:// зарегистрирована в
// electron/main.js (protocol.handle('rusiqmedia', ...)).
//
// НАЙДЕНО ВЖИВУЮ (живая демонстрация Тип7, 2026-09-12): схема
// зарегистрирована как `standard: true`, и WHATWG URL-парсер для
// standard-схемы с ПУСТЫМ host (`rusiqmedia:///file.png`) не сохраняет
// ожидаемое host=''+pathname='/file.png' - имя файла реально "проваливается"
// в host (`request.url` реально отражается как `rusiqmedia://file.png/`), а
// pathname становится '/'. Итог - main.js всегда получал пустой fileName и
// отдавал 404 молча, ни один пользовательский фон НИКОГДА не загружался с
// самого начала Фазы 2a - точки/drag/сохранение при этом работали, т.к. не
// зависят от реальной загрузки картинки (невидимый Rect-фолбэк на случай
// отсутствия фона, добавленный ревью Задачи 9, случайно маскировал баг во
// всех предыдущих живых прогонах, ни разу не включавших визуальный
// скриншот-контроль). Это ТОЧНО ТА ЖЕ находка, что уже была задокументирована
// для natcomlib:// (см. natcom/mediaUrl.ts) - фикс не был перенесён при
// создании rusiqmedia:// по аналогии. Фикс - непустой host ("bg"), тот же
// паттерн, что уже рабочий natcomlib://asset/<fileName>.

export function rusiqBackgroundMediaUrl(fileName: string): string {
  return `rusiqmedia://bg/${encodeURIComponent(fileName)}`;
}

// FR-015 (Фаза 2b): картинка к вопросу/ответу/подсказке (не общий фон).
// Тот же протокол и тот же обработчик в main.js (host отбрасывается
// парсером, реально используется только pathname) - "item" здесь чисто
// для читаемости URL, функционально эквивалентно rusiqBackgroundMediaUrl
// с другим host.
export function rusiqItemImageUrl(fileName: string): string {
  return `rusiqmedia://item/${encodeURIComponent(fileName)}`;
}
