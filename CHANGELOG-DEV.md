# Журнал изменений (CHANGELOG-DEV)

> Лог багов, исправлений, новых фич. Заполняется по результату каждого изменения в проекте.
> Формат записи: дата, тип (BUG/FIX/FEATURE/REFACTOR/CHORE), краткое описание, причина, способ исправления, затронутые файлы.

---

## 2026-06-03

### FIX — копировался не тот .exe при сборке плеера
- **Симптом:** на устройстве в плеере старый контент, хотя в БД свежая версия проекта.
- **Причина:** в `buildDistribution` (`packages/server/src/routes/builds.js`, шаг 7) выбор .exe через `files.find(f => f.endsWith('.exe') && f.includes('Setup'))` брал ПЕРВЫЙ попавшийся .exe по порядку readdir. В `dist-electron/` накопились старые .exe от прошлых тестовых сборок (`BadLuck-*`, `OldHorse`, `Tuna`, `button-go-*`) → копировался чужой старый установщик.
- **Способ исправления (v2):**
  1. Перед запуском `electron:build:win` удаляются все старые `*Setup*.exe` из `dist-electron/`.
  2. После сборки .exe выбирается новейший по `mtime` (через `fs.stat` + `reduce`).
  - Маркеры идемпотентности: `FIX-EXE-SELECTION-V2`.
- **Файлы:** `packages/server/src/routes/builds.js`, `packages/server/dist/routes/builds.js`.
- **Проверка:** собранный через редактор установщик содержит актуальный маркер `TEST_МАРКЕР_123`. ✅ Подтверждено.


### FEATURE — удалённое обновление контента плеера (онлайн) <!-- REMOTE-UPDATE-LOGGED -->
- **Что:** плеер периодически опрашивает сервер на новую версию проекта и применяет обновление контента без переустановки .exe.
- **Логика плеера** (`packages/player/electron/main.js`):
  - `checkProjectVersion` — GET `/api/projects/:id/version` с player-токеном; при `serverVersion > knownVersion` шлёт `update-available` в renderer.
  - `startVersionPolling` — первая проверка через 10 сек после старта (только инициализирует `knownVersion`, без баннера), далее каждые 5 мин (`VERSION_POLL_INTERVAL`).
  - `apply-update` (IPC) — берёт `projectData` из ответа `/version`, разворачивает в корень `currentProject` (+`serverUrl`,`licenseKeyHash`), шлёт `load-project` + `update-applied`. Маркер: `APPLY-UPDATE-PROJECTDATA-V2`.
- **Серверная часть** (`packages/server/src/controllers/ProjectController.ts`):
  - `getProjectVersion` (роут `/:id/version`, middleware `authenticatePlayer`) теперь возвращает `projectData` + `canvasWidth/Height/Background`. Маркер: `VERSION-PROJECTDATA-APPLIED`.
  - Это убрало второй HTTP-запрос на `/api/projects/:id` (тот защищён `authenticateClient` = токен редактора, плееру недоступен → возвращал 401).
- **Причина прошлой поломки:** `apply-update` делал второй запрос на `/api/projects/:id` (401 для плеера) и неправильно распаковывал ответ (`{success, project:{projectData}}` вместо плоского `{widgets, canvas}` как в `project.json`).
- **Проверка:** на Windows-устройстве — баннер «Доступно обновление», нажатие «Обновить» сменило текст кнопки `TEST_МАРКЕР_123` → `TEST_МАРКЕР_456` без переустановки. ✅ Подтверждено.
- **Файлы:** `packages/player/electron/main.js`, `packages/server/src/controllers/ProjectController.ts`.

### KNOWN ISSUE — задержка детекта обновления и serverUrl в репо-копии project.json
- Баннер появляется не сразу: первая проверка (через 10 сек) только запоминает текущую версию, реальный детект — на следующем цикле (+5 мин). Можно уменьшить интервал или сразу детектить при первом расхождении с версией из `project.json`.
- `packages/player/electron/project.json` в репо содержит `serverUrl: :8080` (артефакт прошлой сборки) — на собранных через редактор плеерах подставляется корректный URL из `PLAYER_SERVER_URL`.
- TODO осталось: офлайн-кэш медиафайлов (сейчас контент обновляется онлайн, медиа тянутся с сервера по URL).
