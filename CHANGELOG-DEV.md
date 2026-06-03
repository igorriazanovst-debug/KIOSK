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

### FEATURE — офлайн-кэш медиафайлов плеера <!-- OFFLINE-CACHE-LOGGED -->
- **Что:** плеер скачивает медиафайлы проекта в локальный кэш и воспроизводит их офлайн; сеть нужна только для активации, heartbeat и проверки обновлений.
- **Реализация** (`packages/player/electron/main.js`):
  - Кастомный протокол `kioskcache://<projectId8>/<fileId>`, зарегистрирован как privileged (`standard, secure, supportFetchAPI, stream, bypassCSP`) ДО `app.ready`.
  - `getCacheDir(projectId)` → `userData/media-cache/<projectId8>/`. Имя файла = `fileId` (без расширения). Это НЕ системный кэш, ОС его не чистит.
  - `downloadToCache` — качает файл с player-токеном, пишет в `.tmp` → `rename`. Таймаут 8 сек (`req.setTimeout`) чтобы офлайн не вис.
  - `prepareProjectForRender(project)` — находит URL `/api/projects/<pid>/files/<fileId>` regex'ом, скачивает только отсутствующие в кэше, подменяет на `kioskcache://`. При офлайне/без токена пропускает сеть и использует кэш. Лог: `[cache] replaced N of M URLs with kioskcache://`.
  - `sendLoadProject()` — централизованная отправка проекта в renderer с кэшированием. Заменила 5 прямых `send('load-project')`.
  - Обработчик протокола `protocol.handle('kioskcache')` отдаёт файл с **поддержкой HTTP Range** (статус 206, `Content-Range`, `Accept-Ranges`) — критично для `<video>` seeking/буферизации. `guessMime` определяет MIME по расширению или магическим байтам (mp4/mov→`ftyp`, png/jpeg/gif/svg). `nodeStreamToWeb` через `Readable.toWeb`.
- **Решённые баги в процессе:**
  - Видео обрывалось на ~трети → `net.fetch('file://')` не поддерживает Range → заменено на ручную отдачу с Range. Маркер: `KIOSKCACHE-RANGE-SUPPORT`.
  - Окно активации не закрывалось после успеха → окно с `closable:false`, `close()` игнорируется в Electron 39 → `setClosable(true)` + `destroy()`. Маркер: `FIX-ACTIVATION-CLOSE-DESTROY`.
  - Видео не играло при первом запуске → кэширование шло до активации (без токена, 401) → добавлен `sendLoadProject()` после успешной активации. Маркер: `POST-ACTIVATION-CACHE`.
  - Офлайн-зависание → таймаут на download + пропуск сети если файл уже в кэше. Маркер: `CACHE-OFFLINE-FIX`.
  - Двойное скачивание при старте → убран вызов `sendLoadProject` из `loadEmbeddedProject` (остался только `did-finish-load`). Маркер: `FIX-DOUBLE-CACHE-CALL`.
- **Замечание по фото:** изображения в проекте — inline `data:image/...;base64` (часть `project.json`), кэшировать не нужно, работают офлайн всегда. Кэшируются только серверные файлы (`/api/.../files/...`): видео, SVG.
- **Серверный фикс:** multer в `builds.js` имел дефолтный лимит текстового поля 1 МБ → при сборке с тяжёлыми медиа `projectData` JSON превышал его (`MulterError: LIMIT_FIELD_VALUE`) → добавлен `fieldSize: 100MB`. Маркер: `MULTER-FIELDSIZE-FIX`. Файлы: `packages/server/src/routes/builds.js` + `dist`.
- **Проверка:** на Windows-устройстве видео воспроизводится онлайн и офлайн, файлы в `media-cache/`. ✅ Подтверждено.

### KNOWN ISSUE — мелочи офлайн-кэша
- При первом запуске видео появляется только после активации (нужен токен для скачивания) — ожидаемо.
- WS/heartbeat в офлайне спамят `EHOSTUNREACH` каждые 30 сек — не критично, но можно глушить лог.
- Старые файлы в кэше не удаляются при смене контента (нет сборки мусора кэша) — TODO на будущее.
