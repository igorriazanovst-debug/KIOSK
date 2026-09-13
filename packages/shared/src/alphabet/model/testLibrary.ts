// packages/shared/src/alphabet/model/testLibrary.ts
// Маленький, но НАСТОЯЩИЙ пакет контента для тестов домена.
//
// Слова взяты у эталона вместе с их разбивкой на слоги — «Автобус» (ав-то-бус),
// «Арбуз» (ар-буз), «Банан» (ба-нан), «Бант» (односложное). Односложное слово
// здесь не для красоты: именно на нём ломается отбор заданий для этапов 2 и 3,
// и без него тесты этого не поймают.
//
// АЛФАВИТ В ФИКСТУРЕ ПОЛНЫЙ, все 33 буквы, хотя слова есть только у двух.
// Иначе слог «ав» ссылался бы на букву «В», которой в пакете нет, и проверка
// графа справедливо ругалась бы на саму фикстуру. Полный алфавит и в жизни
// всегда полный: меняется список слов у буквы, а не набор букв.
//
// Файл не `.test.ts`, потому что фикстурой пользуются тесты трёх модулей
// (граф, раскладка, движки этапов), а дублировать её по копии на модуль —
// верный способ развести их между собой.

import { parseAlphabetLibrary, ALPHABET_LIBRARY_SCHEMA_VERSION } from './schema';
import type { AlphabetLibrary, Letter } from './schema';

const ALPHABET = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';

/** Тридцать три буквы; слова проставляются поверх */
export function emptyLetters(): Letter[] {
  return [...ALPHABET].map((name, index) => ({ number: index + 1, name, wordIds: [] }));
}

function lettersWithWords(): Letter[] {
  const letters = emptyLetters();
  letters[0].wordIds = ['avtobus', 'arbuz'];
  letters[1].wordIds = ['banan', 'bant'];
  return letters;
}

export function testLibrary(overrides: Partial<AlphabetLibrary> = {}): AlphabetLibrary {
  return parseAlphabetLibrary({
    schemaVersion: ALPHABET_LIBRARY_SCHEMA_VERSION,
    audioScheme: { recorded: true },
    letters: lettersWithWords(),
    syllables: [
      { id: 'av', name: 'ав', letterNumbers: [1, 3] },
      { id: 'to', name: 'то', letterNumbers: [20, 16] },
      { id: 'bus', name: 'бус', letterNumbers: [2, 21, 19] },
      { id: 'ar', name: 'ар', letterNumbers: [1, 18] },
      { id: 'buz', name: 'буз', letterNumbers: [2, 21, 9] },
      { id: 'ba', name: 'ба', letterNumbers: [2, 1] },
      { id: 'nan', name: 'нан', letterNumbers: [15, 1, 15] },
      { id: 'bant', name: 'бант', letterNumbers: [2, 1, 15, 20] },
    ],
    words: [
      {
        id: 'avtobus',
        name: 'Автобус',
        syllableIds: ['av', 'to', 'bus'],
        hasWithoutLastSyllable: true,
      },
      { id: 'arbuz', name: 'Арбуз', syllableIds: ['ar', 'buz'], hasWithoutLastSyllable: true },
      { id: 'banan', name: 'Банан', syllableIds: ['ba', 'nan'], hasWithoutLastSyllable: true },
      // Односложное: этапам 2 и 3 непригодно, этапу 1 — вполне.
      // Его единственный слог носит тот же идентификатор, что и само слово —
      // как «Йод»/`jod` у эталона; на этом проверяется безвредная коллизия путей
      { id: 'bant', name: 'Бант', syllableIds: ['bant'], hasWithoutLastSyllable: false },
    ],
    sets: [{ id: 'bazovyj', title: 'Базовый набор', wordIds: ['avtobus', 'arbuz'] }],
    ...overrides,
  });
}

/** Полный список файлов, который делает фикстуру комплектной */
export const TEST_LIBRARY_FILES: string[] = [
  ...emptyLetters().map((l) => `media/${l.number}.mp3`),
  'media/av.mp3',
  'media/to.mp3',
  'media/bus.mp3',
  'media/ar.mp3',
  'media/buz.mp3',
  'media/ba.mp3',
  'media/nan.mp3',
  // media/bant.mp3 служит и слогу «бант», и слову «Бант» — один звук на двоих
  'media/bant.mp3',
  'img/avtobus.svg',
  'media/avtobus.mp3',
  'media/avtobus_bgn.mp3',
  'img/arbuz.svg',
  'media/arbuz.mp3',
  'media/arbuz_bgn.mp3',
  'img/banan.svg',
  'media/banan.mp3',
  'media/banan_bgn.mp3',
  'img/bant.svg',
];
