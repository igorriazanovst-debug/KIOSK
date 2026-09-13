// packages/shared/src/alphabet/conformance/generate.mjs
// Генератор сверочных векторов виджета «АзбукоСлов».
//
// ЗАЧЕМ. ТЗ строка 67 требует Android, а Android реализуется ОТДЕЛЬНЫМ
// нативным приложением, не поверх этого кода (решение от 08.09.2026).
// Значит правила игры будут написаны второй раз на другом языке, и
// единственный способ не разъехаться в поведении — общий, машинно
// проверяемый набор ожиданий.
//
// ВЕКТОРЫ СНИМАЮТСЯ С ТЕКУЩЕЙ РЕАЛИЗАЦИИ и фиксируют её как контракт. Это не
// доказательство правильности — это фиксация: любое расхождение (в этой
// реализации при рефакторинге или в нативной при написании) становится
// видимым падением теста, а не тихой разницей в поведении на занятии.
//
// ЧТО СЮДА ПОПАДАЕТ, А ЧТО НЕТ. Только то, где расхождение НЕЗАМЕТНО и
// вредно: раскладка файлов, слияние статистики, правила редактора,
// пригодность слова этапу. Случайный отбор заданий не фиксируется — он
// зависит от генератора, и требовать побитового совпадения бессмысленно;
// фиксируются его СВОЙСТВА (сколько вариантов, что верный ровно один).
//
// Запуск: npm run build && node src/alphabet/conformance/generate.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { alphabet } = require('../../../dist/index.js');
const HERE = path.dirname(fileURLToPath(import.meta.url));

const U1 = 'u0000000000000001';
const U2 = 'u0000000000000002';
const U3 = 'u0000000000000003';

const syl = (id, name, letters) => ({ id, name, letterNumbers: letters });

const vectors = {
  note:
    'Сверочные векторы виджета «АзбукоСлов» (Тип 3). Общий контракт между ' +
    'реализацией на Electron и будущей нативной Android-реализацией. ' +
    'Снято с текущей реализации; расхождение обязано быть падением теста.',
  generatedFrom: 'packages/shared/src/alphabet',

  // ─── Раскладка файлов ────────────────────────────────────────────────
  // Разойдись пути — файлы будут лежать на диске, а игра молча не будет их
  // находить: отсутствующий файл очередь воспроизведения не роняет
  resources: {
    wordImage: ['avtobus', 'apel_sin', 'jod', 'mysh_'].map((id) => ({
      wordId: id,
      path: alphabet.wordImagePath(id),
    })),
    wordAudio: ['avtobus', 'jod'].map((id) => ({
      wordId: id,
      path: alphabet.wordAudioPath(id),
    })),
    wordWithoutLastSyllable: ['avtobus', 'apel_sin'].map((id) => ({
      wordId: id,
      path: alphabet.wordWithoutLastSyllableAudioPath(id),
    })),
    // Буква адресуется НОМЕРОМ, а не самой буквой: от номера не зависит ни
    // кодировка, ни регистр
    letterAudio: [1, 7, 21, 33].map((n) => ({
      letterNumber: n,
      path: alphabet.letterAudioPath(n),
    })),
    syllableAudio: ['av', 'to', 'bus', 'pod_'].map((id) => ({
      syllableId: id,
      path: alphabet.syllableAudioPath(id),
    })),
  },

  // ─── Пригодность слова этапу ─────────────────────────────────────────
  // Односложное слово годится этапу 1 и не годится этапам 2 и 3. Реализация,
  // которая предложит его на этапе 3, покажет ребёнку задание без решения
  stageEligibility: (() => {
    const library = alphabet.parseAlphabetLibrary({
      schemaVersion: 1,
      audioScheme: { recorded: true },
      letters: [...'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'].map((name, i) => ({
        number: i + 1,
        name,
        wordIds: i === 0 ? ['avtobus'] : i === 10 ? ['jod'] : [],
      })),
      syllables: [
        syl('av', 'ав', [1, 3]),
        syl('to', 'то', [20, 16]),
        syl('bus', 'бус', [2, 21, 19]),
        syl('jod', 'йод', [11, 16, 5]),
      ],
      words: [
        {
          id: 'avtobus',
          name: 'Автобус',
          syllableIds: ['av', 'to', 'bus'],
          hasWithoutLastSyllable: true,
        },
        { id: 'jod', name: 'Йод', syllableIds: ['jod'], hasWithoutLastSyllable: false },
      ],
      sets: [],
    });
    return {
      letterShow: alphabet.wordsForLetterShow(library).map((w) => w.id),
      wordCompleting: alphabet.wordsForCompleting(library).map((w) => w.id),
      wordMake: alphabet.wordsForMaking(library).map((w) => w.id),
    };
  })(),

  // ─── Слияние статистики ──────────────────────────────────────────────
  // Последняя сессия ЗАМЕЩАЕТСЯ, итог НАКАПЛИВАЕТСЯ. Перепутать легко, а
  // последствия неприятны в обе стороны
  statistics: (() => {
    const first = alphabet.mergeSessionStatistics({}, 'u1', [
      { letterNumber: 1, correct: true },
      { letterNumber: 1, correct: false },
      { letterNumber: 2, correct: true },
    ]);
    const second = alphabet.mergeSessionStatistics(first, 'u1', [
      { letterNumber: 1, correct: true },
    ]);
    return {
      afterFirst: first,
      // Буква 2 во второй партии не встречалась: сессия обнулилась, итог цел
      afterSecond: second,
      chartRows: alphabet.letterChartRows(second, 'u1', [1, 2, 7]),
    };
  })(),

  // ─── Правила редактора ───────────────────────────────────────────────
  // Слово, созданное на планшете, обязано вести себя так же, как созданное
  // на доске
  contentRules: (() => {
    const syllables = [syl(U1, 'ко', [12, 16]), syl(U2, 'шка', [26, 12, 1])];
    const cases = [];

    const push = (what, fn) => {
      try {
        cases.push({ what, ok: true, result: fn() });
      } catch (err) {
        cases.push({ what, ok: false, error: err.message });
      }
    };

    push('регистр приводится', () =>
      alphabet.applyCreateWord([], syllables, { name: 'КоШкА', syllableIds: [U1, U2] }, U3).created
        .name
    );
    push('написание не совпало со слогами', () =>
      alphabet.applyCreateWord([], syllables, { name: 'Кошечка', syllableIds: [U1, U2] }, U3)
    );
    push('односложное не получает записи без последнего слога', () =>
      alphabet.applyCreateWord(
        [],
        [syl(U1, 'кот', [12, 16, 20])],
        { name: 'Кот', syllableIds: [U1], hasWithoutLastSyllable: true },
        U3
      ).created.hasWithoutLastSyllable
    );
    push('слог, использованный словом, не удаляется', () =>
      alphabet.applyDeleteSyllable(
        syllables,
        [{ id: U3, name: 'Кошка', syllableIds: [U1, U2], hasWithoutLastSyllable: true }],
        U1
      )
    );
    push('удалённое слово уходит из комплектов', () =>
      alphabet.applyDeleteWord(
        [{ id: U3, name: 'Кошка', syllableIds: [U1, U2], hasWithoutLastSyllable: true }],
        [{ id: U1, title: 'Дом', wordIds: [U3] }],
        U3
      ).sets
    );
    push('повтор слова в комплекте схлопывается', () =>
      alphabet.applyCreateSet(
        [],
        [{ id: U3, name: 'Кошка', syllableIds: [U1, U2], hasWithoutLastSyllable: true }],
        { title: 'Дом', wordIds: [U3, U3] },
        U1
      ).created.wordIds
    );
    push('конфликт имени при импорте', () =>
      alphabet.resolveImportedSetTitle([{ id: U1, title: 'ПДД', wordIds: [] }], 'ПДД')
    );
    return cases;
  })(),

  // ─── Готовность своего слова ─────────────────────────────────────────
  readiness: (() => {
    const word = {
      id: U3,
      name: 'Кошка',
      syllableIds: [U1, U2],
      hasWithoutLastSyllable: true,
    };
    return {
      nothing: alphabet.checkUserWordReadiness(word, {
        hasImage: false,
        hasWholeAudio: false,
        syllablesWithAudio: new Set(),
      }),
      imageOnly: alphabet.checkUserWordReadiness(word, {
        hasImage: true,
        hasWholeAudio: false,
        syllablesWithAudio: new Set(),
      }),
      complete: alphabet.checkUserWordReadiness(word, {
        hasImage: true,
        hasWholeAudio: true,
        syllablesWithAudio: new Set([U1, U2]),
      }),
    };
  })(),

  // ─── Разбор пакета: что отвергается, а что нет ───────────────────────
  // Список включает и случай, который ПРИНИМАЕТСЯ: контракт должен
  // фиксировать не только запреты, иначе нативная реализация может оказаться
  // строже нужного и отвергнуть законные данные
  libraryValidation: (() => {
    const base = {
      schemaVersion: 1,
      audioScheme: { recorded: false },
      letters: [{ number: 1, name: 'А', wordIds: [] }],
      syllables: [syl('av', 'ав', [1, 3])],
      words: [{ id: 'a', name: 'А', syllableIds: ['av'], hasWithoutLastSyllable: false }],
      sets: [],
    };
    const cases = [
      ['чужая версия схемы', { ...base, schemaVersion: 2 }],
      ['номер буквы вне 1..33', { ...base, letters: [{ number: 34, name: 'Я', wordIds: [] }] }],
      [
        'повтор идентификатора слова',
        { ...base, words: [base.words[0], { ...base.words[0], name: 'Б' }] },
      ],
      ['слово без слогов', { ...base, words: [{ ...base.words[0], syllableIds: [] }] }],
      // Этот случай ПРИНИМАЕТСЯ, и это часть контракта: слова педагога
      // лежат в том же списке, что и поставочные, поэтому идентификатор
      // вида «u»+16hex там законен. Разводятся они не списком, а формой
      // идентификатора — LibraryIdSchema такую форму отвергает, а
      // EntityIdSchema (union) принимает обе
      [
        'свой идентификатор в общем списке слов — ПРИНИМАЕТСЯ',
        { ...base, words: [{ ...base.words[0], id: U1 }] },
      ],
    ];
    return cases.map(([what, input]) => {
      try {
        alphabet.parseAlphabetLibrary(input);
        return { what, rejected: false };
      } catch {
        return { what, rejected: true };
      }
    });
  })(),
};

const out = path.join(HERE, 'vectors.json');
fs.writeFileSync(out, `${JSON.stringify(vectors, null, 2)}\n`, 'utf8');
console.log(`векторы записаны: ${out}`);
console.log(`размер: ${fs.statSync(out).size} байт`);
