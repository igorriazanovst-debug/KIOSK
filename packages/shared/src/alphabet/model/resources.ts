// packages/shared/src/alphabet/model/resources.ts
// Раскладка файлов контента «АзбукоСлов» и проверка её комплектности.
//
// Раскладка повторяет эталонную (раздел 6 спецификации воспроизведения):
//
//   img/<id>.svg              иллюстрация слова
//   media/<id>.mp3            слово целиком
//   media/<id>_bgn.mp3        слово без последнего слога
//   media/<номер буквы>.mp3   произношение буквы, 1.mp3 … 33.mp3
//   media/<слог>.mp3          произношение слога
//
// Повторяем её осознанно: она экономна — слоговая озвучка переиспользуется
// всеми словами, где слог встречается (237 файлов слогов против 366 файлов
// слов), и именно это даёт эталону дистрибутив в 72 МБ при 183 иллюстрациях.
//
// НО У НЕЁ ЕСТЬ ДЕФЕКТ, КОТОРЫЙ МЫ НЕ ПОВТОРЯЕМ: слова, слоги и буквы делят
// ОДИН каталог `media/`. Односложное слово «Йод» с идентификатором `jod` и
// слог `jod` дают один и тот же путь; слог с идентификатором `1` — путь буквы
// «А». Файл при сборке молча перезапишется, и слово заговорит голосом слога
// или наоборот. Поэтому checkPathCollisions — обязательная проверка сборки,
// а не факультативная.

import type { AlphabetLibrary } from './schema';

export const ALPHABET_IMAGE_DIR = 'img';
export const ALPHABET_AUDIO_DIR = 'media';

/** Иллюстрация слова */
export function wordImagePath(wordId: string): string {
  return `${ALPHABET_IMAGE_DIR}/${wordId}.svg`;
}

/** Слово целиком — звучит на всех трёх этапах */
export function wordAudioPath(wordId: string): string {
  return `${ALPHABET_AUDIO_DIR}/${wordId}.mp3`;
}

/**
 * Слово без последнего слога — «авто-бу…», ребёнок достраивает. Отдельная
 * запись, а не склейка слоговых: диктор произносит начало слова со связной
 * интонацией, склейка слогов звучит как перечисление и заранее подсказывает
 * разбивку, которую ребёнок как раз и должен услышать сам.
 */
export function wordWithoutLastSyllableAudioPath(wordId: string): string {
  return `${ALPHABET_AUDIO_DIR}/${wordId}_bgn.mp3`;
}

/** Произношение буквы — адресуется номером в алфавите, а не самой буквой */
export function letterAudioPath(letterNumber: number): string {
  return `${ALPHABET_AUDIO_DIR}/${letterNumber}.mp3`;
}

/** Произношение слога — переиспользуется всеми словами, где слог встречается */
export function syllableAudioPath(syllableId: string): string {
  return `${ALPHABET_AUDIO_DIR}/${syllableId}.mp3`;
}

/** Записана ли озвучка вообще — см. AlphabetAudioSchemeSchema */
export function schemeHasAudio(library: AlphabetLibrary): boolean {
  return library.audioScheme.recorded;
}

/**
 * Полный список файлов, обязательных для этой библиотеки. Порядок устойчив
 * (буквы, слоги, слова в порядке объявления), чтобы диффы отчёта сборки
 * читались глазами.
 *
 * Запись «без последнего слога» требуется только у слов, где она объявлена
 * флагом: у односложных её не бывает, и требовать её от них значило бы
 * выдумать несуществующий дефект.
 *
 * Список без повторов: односложное слово и его единственный слог указывают на
 * один файл, и требовать его дважды бессмысленно — а в отчёте о нехватке он
 * иначе появился бы двумя строками об одном и том же.
 */
export function expectedLibraryFiles(library: AlphabetLibrary): string[] {
  const files: string[] = [];
  const seen = new Set<string>();
  const add = (path: string): void => {
    if (seen.has(path)) return;
    seen.add(path);
    files.push(path);
  };

  const hasAudio = schemeHasAudio(library);

  if (hasAudio) {
    for (const letter of library.letters) add(letterAudioPath(letter.number));
    for (const syllable of library.syllables) add(syllableAudioPath(syllable.id));
  }

  for (const word of library.words) {
    add(wordImagePath(word.id));
    if (hasAudio) {
      add(wordAudioPath(word.id));
      if (word.hasWithoutLastSyllable) {
        add(wordWithoutLastSyllableAudioPath(word.id));
      }
    }
  }

  return files;
}

export interface CompletenessReport {
  /** Файлы, которых не хватает — это ошибка сборки */
  missing: string[];
  /** Файлы в пакете, на которые никто не ссылается — мёртвый вес дистрибутива */
  unreferenced: string[];
  complete: boolean;
}

/**
 * Сверяет фактический состав пакета с тем, что требует библиотека.
 * `actualFiles` — пути относительно корня пакета, с любыми разделителями:
 * на Windows fs отдаёт «\», а манифест всегда в POSIX-форме.
 *
 * Нехватка — ошибка сборки, а не предупреждение: у эталона в поставке
 * недоставало двух mp3, и дефект дожил до продакшена именно потому, что
 * очередь воспроизведения не падает на отсутствующем файле.
 */
export function checkLibraryCompleteness(
  library: AlphabetLibrary,
  actualFiles: Iterable<string>
): CompletenessReport {
  const actual = new Set<string>();
  for (const file of actualFiles) {
    actual.add(file.replace(/\\/g, '/').replace(/^\.\//, ''));
  }

  const expected = expectedLibraryFiles(library);
  const expectedSet = new Set(expected);

  const missing = expected.filter((file) => !actual.has(file));
  const unreferenced = [...actual].filter((file) => !expectedSet.has(file)).sort();

  return { missing, unreferenced, complete: missing.length === 0 };
}

export interface PathCollision {
  path: string;
  /** Кто претендует на этот путь — по два и больше владельца на коллизию */
  owners: string[];
  /**
   * Безвредна ли коллизия. Безвредна ровно одна: односложное слово и его
   * единственный слог — это один и тот же звук, и один файл на двоих здесь
   * не ошибка, а экономия. Остальные — дефект.
   */
  benign: boolean;
}

/**
 * Ищет пути, на которые претендует больше одного владельца.
 *
 * Общий каталог `media/` — конструктивная черта эталонной раскладки и её же
 * слабое место (см. шапку файла). Коллизия ничего не ломает на сборке: файл
 * просто перезаписывается последним. Проявится она на занятии — слово
 * прозвучит как чужой слог, — и объяснить это будет нечем.
 *
 * Ловится и случай «слог против слова без последнего слога»: слог с именем,
 * оканчивающимся на `_bgn`, забирает чужой путь. Выдумкой это не выглядит
 * только потому, что `_` в идентификаторах — это мягкий знак («apel_sin»),
 * так что слог, кончающийся на `_bgn`, теоретически возможен.
 */
export function checkPathCollisions(library: AlphabetLibrary): PathCollision[] {
  const owners = new Map<string, string[]>();

  const claim = (path: string, owner: string): void => {
    const list = owners.get(path);
    if (list) list.push(owner);
    else owners.set(path, [owner]);
  };

  for (const letter of library.letters) {
    claim(letterAudioPath(letter.number), `буква «${letter.name}»`);
  }
  for (const syllable of library.syllables) {
    claim(syllableAudioPath(syllable.id), `слог «${syllable.name}» (${syllable.id})`);
  }
  for (const word of library.words) {
    claim(wordAudioPath(word.id), `слово «${word.name}»`);
    if (word.hasWithoutLastSyllable) {
      claim(
        wordWithoutLastSyllableAudioPath(word.id),
        `слово «${word.name}» без последнего слога`
      );
    }
    claim(wordImagePath(word.id), `иллюстрация слова «${word.name}»`);
  }

  // Пути, где односложное слово делит файл со своим же единственным слогом
  const benignPaths = new Set<string>();
  for (const word of library.words) {
    if (word.syllableIds.length === 1 && word.syllableIds[0] === word.id) {
      benignPaths.add(wordAudioPath(word.id));
    }
  }

  const collisions: PathCollision[] = [];
  for (const [path, list] of owners) {
    if (list.length > 1) {
      collisions.push({ path, owners: list, benign: benignPaths.has(path) && list.length === 2 });
    }
  }
  collisions.sort((a, b) => a.path.localeCompare(b.path));
  return collisions;
}

/** Только вредные коллизии — то, что обязано валить сборку */
export function harmfulPathCollisions(library: AlphabetLibrary): PathCollision[] {
  return checkPathCollisions(library).filter((c) => !c.benign);
}

export interface ContentSizeEstimate {
  letterCount: number;
  syllableCount: number;
  wordCount: number;
  audioFileCount: number;
  imageBytes: number;
  audioBytes: number;
  totalBytes: number;
}

/**
 * Оценка веса пакета. Нужна для того же решения, что и в виджете «слов»:
 * сколько контента влезает в приемлемый дистрибутив. Здесь запас лучше —
 * слоговая озвучка общая, и рост каталога слов не тянет за собой
 * пропорциональный рост звука.
 */
export function estimateContentSize(
  library: AlphabetLibrary,
  avg: { imageBytes: number; audioBytes: number }
): ContentSizeEstimate {
  // Считаем по фактическому списку файлов, а не по формуле: формула не знает
  // про общие файлы односложных слов и завысила бы вес
  const audioFileCount = expectedLibraryFiles(library).filter((f) => f.endsWith('.mp3')).length;

  const imageBytes = library.words.length * avg.imageBytes;
  const audioBytes = audioFileCount * avg.audioBytes;

  return {
    letterCount: library.letters.length,
    syllableCount: library.syllables.length,
    wordCount: library.words.length,
    audioFileCount,
    imageBytes,
    audioBytes,
    totalBytes: imageBytes + audioBytes,
  };
}
