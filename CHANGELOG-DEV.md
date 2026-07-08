# Журнал изменений (CHANGELOG-DEV)

> Лог багов, исправлений, новых фич. Заполняется по результату каждого изменения в проекте.
> Формат записи: дата, тип (BUG/FIX/FEATURE/REFACTOR/CHORE), краткое описание, причина, способ исправления, затронутые файлы.

---

## 2026-07-08

### FIX — имя установленного приложения (ярлык) не совпадало с «Имя приложения» из редактора
- **Симптом:** при установке сгенерированного .exe ярлык на рабочем столе / в меню «Пуск» назывался `Kiosk Player` вместо имени, заданного в поле «Имя приложения» диалога сборки.
- **Причина:** `packages/player/package.json` → `build.nsis.shortcutName` жёстко зашит как `"Kiosk Player"`. `builds.js` при сборке подставлял `appName` только в `build.productName` (папка установки + запись в «Установка/удаление»), но не в `nsis.shortcutName` (видимое имя ярлыка).
- **Способ исправления:** в `buildDistribution` (`packages/server/src/routes/builds.js`) после установки `productName` дополнительно `packageJson.build.nsis.shortcutName = appName`. Маркер: `SHORTCUT-NAME-FROM-APPNAME`. Цепочка: `BuildDialog.tsx` (поле «Имя приложения» → `appName`) → POST `/api/builds` → `buildDistribution`.
- **Файлы:** `packages/server/src/routes/builds.js` (+ на сервере пропагируется в `dist/routes/builds.js` при `npm run build` сервера).
- **Проверка:** пересобрать сервер, собрать .exe через диалог с непустым именем → установщик создаёт ярлык с этим именем.


### REVERT — откат прогресс-оверлея «тяжёлого проекта» при загрузке
- **Симптом:** оверлей-предупреждение об открытии «тяжёлого» проекта (>250 КБ HTML в browser-menu pages) с окном 2.5 сек на «Прервать» работал плохо — мешал открытию проектов.
- **Что откачено (из коммита `e6d74de8`):**
  - Удалён компонент `packages/editor-web/src/components/ProjectLoadingOverlay.tsx`.
  - `Editor.tsx` — убраны импорт `ProjectLoadingOverlay` и его рендер `<ProjectLoadingOverlay />` (восстановлена версия `e6d74de8~1`).
  - `editorStore.ts` — возвращён простой `loadProject`; убраны поля `loadingStage`/`loadingProgress`/`loadAbortController` и методы `cancelLoadProject`/`dismissLoading` (из interface и implementation) — восстановлена версия `e6d74de8~1`.
- **Оставлено из того же коммита (НЕ откатывалось):** серверный `/api/import` (`packages/server/src/routes/import.js`, регистрация в `app.ts`), nginx-правило, кнопка «Импорт» в `Toolbar.tsx` (`IMPORT-JSON-BTN`).
- **Способ:** `git checkout e6d74de8~1 -- Editor.tsx editorStore.ts` + `git rm ProjectLoadingOverlay.tsx`. Полная обратимость: исходное состояние сохранено меткой `pre-revert-heavy-overlay-backup` (→ `e6d74de8`).
- **Файлы:** `packages/editor-web/src/components/Editor.tsx`, `packages/editor-web/src/components/ProjectLoadingOverlay.tsx` (удалён), `packages/editor-web/src/stores/editorStore.ts`.
- **Проверка:** `git grep` не находит следов оверлея в изменённых файлах; кнопка «Импорт» и серверный импорт на месте. Требуется rebuild+deploy editor-web (`npm run build` → `cp -r dist/* /opt/kiosk/editor-web/`).

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
