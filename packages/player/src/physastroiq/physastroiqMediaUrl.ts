// packages/player/src/physastroiq/physastroiqMediaUrl.ts
// Резолвинг имени файла изображения пользовательской викторины в реально
// загружаемый URL. Схема physastroiqmedia:// регистрируется в electron/main.js
// (protocol.handle('physastroiqmedia', ...)) — Фаза 5, ещё не подключена.
//
// Прямая адаптация rusiqMediaUrl.ts (Тип 7) — там же задокументирована
// находка: standard-схема с ПУСТЫМ host (`physastroiqmedia:///file.png`)
// "теряет" имя файла (проваливается в host, pathname становится '/'), а
// непустой host ("bg"/"item") — рабочий паттерн, уже проверенный на
// natcomlib://, rusiqmedia://. Применяется здесь заранее (не постфактум),
// чтобы не наступать на ту же грабли снова.

export function physastroiqLevelImageMediaUrl(fileName: string): string {
  return `physastroiqmedia://level/${encodeURIComponent(fileName)}`;
}

// FR-015 ТЗ (строка 254): картинка к вопросу/ответу/подсказке (не
// изображение-карта уровня). Тот же протокол и тот же обработчик в
// main.js — "item" здесь чисто для читаемости URL.
export function physastroiqItemImageUrl(fileName: string): string {
  return `physastroiqmedia://item/${encodeURIComponent(fileName)}`;
}
