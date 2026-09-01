// packages/player/electron/chrono/pickedMediaPaths.js
// Найдено security-review импорта медиа (HIGH): chrono:import-media
// принимал ЛЮБУЮ строку-путь от рендерера, доверяя ей как "то, что
// пользователь выбрал в системном диалоге" - но никакой реальной связи
// между "что вернул chrono:pick-media-file" и "что реально импортируется"
// не было. Проверка расширения/размера в mediaStore.js защищает от
// импорта произвольного НЕмедиа-файла, но не мешает импортировать ЧУЖОЙ
// реальный медиафайл с диска (например, личное фото пользователя,
// известное или угаданное по пути), если рендерер скомпрометирован -
// contextIsolation защищает от прямого доступа к fs, но не от вызова
// chronoAPI.importMedia с произвольным путём напрямую.
//
// Единственный источник допустимых путей - те, что реально вернул
// dialog.showOpenDialog (главный процесс, рендерер их не выбирает и не
// видит список файлов ОС). Путь одноразовый (consume удаляет его) - импорт
// того же пути дважды подряд должен пройти через диалог заново, не через
// повтор старого разрешения.

const MAX_TRACKED_PATHS = 20;

function createPickedMediaPaths(maxTracked = MAX_TRACKED_PATHS) {
  const paths = new Set();

  return {
    /** Запоминает путь, реально возвращённый системным диалогом выбора файла */
    remember(filePath) {
      paths.add(filePath);
      while (paths.size > maxTracked) {
        // Set сохраняет порядок вставки - вытесняем самый старый.
        paths.delete(paths.values().next().value);
      }
    },
    /** true и "сжигает" разрешение, если путь был реально выбран в диалоге и ещё не использован */
    consume(filePath) {
      if (!paths.has(filePath)) return false;
      paths.delete(filePath);
      return true;
    },
  };
}

module.exports = { createPickedMediaPaths, MAX_TRACKED_PATHS };
