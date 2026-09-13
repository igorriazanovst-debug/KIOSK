// packages/shared/src/alphabet/store/contentRules.ts
// Правила редактора контента педагога — ТЗ строки 76, 77 и 78.
//
// ЖИВУТ В ОБЩЕМ ПАКЕТЕ, а не в Electron: продукт по ТЗ (строка 67) выходит и
// на Android, а Electron под Android не работает. Разойдись правила между
// шелами — и слово, созданное на планшете, вело бы себя иначе, чем на доске.
//
// ГЛАВНОЕ ЗДЕСЬ — ЦЕЛОСТНОСТЬ ГРАФА, а не проверка полей. Граф «буква → слово
// → слог» связывает три сущности, и педагог правит их поодиночке. Отсюда три
// правила, которые нельзя нарушать ни при каком порядке действий:
//
//   1. Слово ссылается только на существующие слоги. Слово, ссылающееся в
//      пустоту, не даст собрать себя ни на одном этапе.
//   2. Слог, использованный хоть одним словом, удалить нельзя — иначе
//      правило 1 нарушится задним числом, и сломается слово, которого
//      педагог в этот момент даже не видел.
//   3. Удалённое слово исчезает из ВСЕХ комплектов. Осиротевшая ссылка не
//      просто мусор: комплект из десяти слов, где половина не существует,
//      даст партию вдвое короче обещанной, и объяснить это будет нечем.
//
// ТРИ ЗАПИСИ НА СЛОВО (ТЗ строка 76 требует «аудио, текстовые и графические»
// материалы). Эталон вынуждает озвучить слово целиком, слово без последнего
// слога и каждый слог — иначе своё слово не встроится в этапы 2 и 3. Мы
// требуем того же, но НЕ ЖЁСТКО: слово без записей сохраняется и работает на
// этапе 1. Запрещать сохранение до полной озвучки значило бы заставлять
// педагога делать всё за один присест, а запись голоса — дело не одной минуты.
// Чего не хватает, показывает checkUserWordReadiness.

import { AlphabetValidationError } from '../model/schema';
import type { AlphabetLibrary, Syllable, Word, WordSet } from '../model/schema';

/** Свои сущности отличаются от поставочных формой идентификатора */
const USER_ID_RE = /^u[a-f0-9]{16}$/;

export function isUserEntityId(id: string): boolean {
  return USER_ID_RE.test(id);
}

export class AlphabetContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AlphabetContentError';
  }
}

export const MAX_WORD_NAME_LENGTH = 40;
export const MAX_SYLLABLE_NAME_LENGTH = 8;
export const MAX_SET_TITLE_LENGTH = 80;
/**
 * Предел длины слова в слогах. Взят не с потолка: на этапе 3 все слоги слова
 * лежат на панели одновременно вместе с дистракторами, а панель — восемь
 * плиток. Слово длиннее просто не поместится, и лучше сказать об этом при
 * создании, чем на занятии.
 */
export const MAX_SYLLABLES_PER_WORD = 8;

// ─── Свои слоги ─────────────────────────────────────────────────────────

export interface UserSyllableDraft {
  /** Слог строчными: «вто» */
  name: string;
  /** Буквы слога по порядку, номера 1..33 */
  letterNumbers: number[];
}

function normalizeSyllableName(raw: string): string {
  const value = String(raw ?? '').trim().toLowerCase();
  if (value.length === 0) throw new AlphabetContentError('Слог не может быть пустым');
  if (value.length > MAX_SYLLABLE_NAME_LENGTH) {
    throw new AlphabetContentError(`Слог длиннее ${MAX_SYLLABLE_NAME_LENGTH} букв`);
  }
  if (!/^[а-яё]+$/.test(value)) {
    throw new AlphabetContentError('Слог пишется русскими буквами без пробелов и знаков');
  }
  return value;
}

function assertLetterNumbers(numbers: number[], name: string): number[] {
  if (!Array.isArray(numbers) || numbers.length === 0) {
    throw new AlphabetContentError(`У слога «${name}» не указаны буквы`);
  }
  for (const n of numbers) {
    if (!Number.isInteger(n) || n < 1 || n > 33) {
      throw new AlphabetContentError(`У слога «${name}» неверный номер буквы: ${n}`);
    }
  }
  return [...numbers];
}

export function applyCreateSyllable(
  syllables: readonly Syllable[],
  draft: UserSyllableDraft,
  newId: string
): { syllables: Syllable[]; created: Syllable } {
  const name = normalizeSyllableName(draft.name);
  if (!isUserEntityId(newId)) {
    throw new AlphabetContentError('Идентификатор своего слога должен быть «u» и 16 hex');
  }
  // Слог с тем же написанием уже есть — заводить второй незачем: он получил
  // бы отдельную озвучку и отдельный файл, а звучал бы одинаково
  const existing = syllables.find((s) => s.name === name);
  if (existing) {
    throw new AlphabetContentError(`Слог «${name}» уже есть — используйте его`);
  }
  const created: Syllable = {
    id: newId,
    name,
    letterNumbers: assertLetterNumbers(draft.letterNumbers, name),
  };
  return { syllables: [...syllables, created], created };
}

/**
 * Удаление слога. Запрещено, если слог использован хоть одним словом —
 * см. правило 2 в шапке файла. Сообщение называет слова поимённо: «слог
 * используется» без имён заставляет педагога искать их перебором.
 */
export function applyDeleteSyllable(
  syllables: readonly Syllable[],
  words: readonly Word[],
  syllableId: string
): Syllable[] {
  const syllable = syllables.find((s) => s.id === syllableId);
  if (!syllable) throw new AlphabetContentError('Такого слога нет');
  if (!isUserEntityId(syllableId)) {
    throw new AlphabetContentError('Поставочный слог удалить нельзя');
  }
  const used = words.filter((w) => w.syllableIds.includes(syllableId));
  if (used.length > 0) {
    const names = used.slice(0, 3).map((w) => `«${w.name}»`).join(', ');
    const more = used.length > 3 ? ` и ещё ${used.length - 3}` : '';
    throw new AlphabetContentError(
      `Слог «${syllable.name}» используется в словах: ${names}${more}. Сначала измените эти слова`
    );
  }
  return syllables.filter((s) => s.id !== syllableId);
}

// ─── Свои слова ─────────────────────────────────────────────────────────

export interface UserWordDraft {
  name: string;
  /** Слоги по порядку — ссылки на существующие слоги */
  syllableIds: string[];
  /** Есть ли запись «без последнего слога» */
  hasWithoutLastSyllable?: boolean;
  /** Файл своей иллюстрации в хранилище медиа */
  imageFile?: string | null;
}

/**
 * Написание слова приводится к виду «Кошка»: заглавная первая, остальные
 * строчные.
 *
 * ПРИВОДИТСЯ, А НЕ ПРОВЕРЯЕТСЯ. Первая версия отвергала «кошка» и «КОШКА» с
 * требованием писать с заглавной. Это ошибка там, где приложение может
 * поправить само: педагог набирает слово экранной клавиатурой на сенсорной
 * панели, регистр там переключается отдельной кнопкой, и отказ ради того,
 * что исправляется одной строкой кода, — просто помеха.
 *
 * Отвергается только то, что поправить нельзя: пустое, слишком длинное и
 * написанное не русскими буквами.
 */
function normalizeWordName(raw: string): string {
  const value = String(raw ?? '').trim();
  if (value.length === 0) throw new AlphabetContentError('Слово не может быть пустым');
  if (value.length > MAX_WORD_NAME_LENGTH) {
    throw new AlphabetContentError(`Слово длиннее ${MAX_WORD_NAME_LENGTH} букв`);
  }
  if (!/^[а-яёА-ЯЁ-]+$/.test(value)) {
    throw new AlphabetContentError('Слово пишется русскими буквами, без пробелов и цифр');
  }
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function assertSyllablesExist(syllableIds: string[], syllables: readonly Syllable[]): string[] {
  if (!Array.isArray(syllableIds) || syllableIds.length === 0) {
    throw new AlphabetContentError('Слово нужно разбить на слоги');
  }
  if (syllableIds.length > MAX_SYLLABLES_PER_WORD) {
    throw new AlphabetContentError(
      `Слово длиннее ${MAX_SYLLABLES_PER_WORD} слогов не поместится на панель игры`
    );
  }
  const known = new Set(syllables.map((s) => s.id));
  const missing = syllableIds.filter((id) => !known.has(id));
  if (missing.length > 0) {
    throw new AlphabetContentError(`Слогов нет в наборе: ${missing.join(', ')}`);
  }
  return [...syllableIds];
}

/**
 * Написание слова должно совпадать со склейкой его слогов. Иначе на этапе 3
 * ребёнок соберёт «со-ба-ка», а подписано будет «Собачка» — и прав окажется
 * он, а не приложение.
 */
function assertNameMatchesSyllables(
  name: string,
  syllableIds: string[],
  syllables: readonly Syllable[]
): void {
  const spelled = syllableIds
    .map((id) => syllables.find((s) => s.id === id)?.name ?? '')
    .join('');
  if (spelled.toLowerCase() !== name.toLowerCase()) {
    throw new AlphabetContentError(
      `Слоги складываются в «${spelled}», а слово написано «${name}»`
    );
  }
}

export function applyCreateWord(
  words: readonly Word[],
  syllables: readonly Syllable[],
  draft: UserWordDraft,
  newId: string
): { words: Word[]; created: Word } {
  const name = normalizeWordName(draft.name);
  if (!isUserEntityId(newId)) {
    throw new AlphabetContentError('Идентификатор своего слова должен быть «u» и 16 hex');
  }
  if (words.some((w) => w.name.toLowerCase() === name.toLowerCase())) {
    throw new AlphabetContentError(`Слово «${name}» уже есть в наборе`);
  }
  const syllableIds = assertSyllablesExist(draft.syllableIds, syllables);
  assertNameMatchesSyllables(name, syllableIds, syllables);

  const created: Word = {
    id: newId,
    name,
    syllableIds,
    hasWithoutLastSyllable: !!draft.hasWithoutLastSyllable && syllableIds.length >= 2,
    imageFile: draft.imageFile ?? null,
  };
  return { words: [...words, created], created };
}

export function applyUpdateWord(
  words: readonly Word[],
  syllables: readonly Syllable[],
  wordId: string,
  draft: UserWordDraft
): { words: Word[]; updated: Word } {
  const index = words.findIndex((w) => w.id === wordId);
  if (index < 0) throw new AlphabetContentError('Такого слова нет');
  if (!isUserEntityId(wordId)) {
    throw new AlphabetContentError('Поставочное слово изменить нельзя — создайте своё');
  }
  const name = normalizeWordName(draft.name);
  if (words.some((w, i) => i !== index && w.name.toLowerCase() === name.toLowerCase())) {
    throw new AlphabetContentError(`Слово «${name}» уже есть в наборе`);
  }
  const syllableIds = assertSyllablesExist(draft.syllableIds, syllables);
  assertNameMatchesSyllables(name, syllableIds, syllables);

  const updated: Word = {
    id: wordId,
    name,
    syllableIds,
    hasWithoutLastSyllable: !!draft.hasWithoutLastSyllable && syllableIds.length >= 2,
    imageFile: draft.imageFile ?? null,
  };
  const next = words.slice();
  next[index] = updated;
  return { words: next, updated };
}

/**
 * Удаление слова. Уносит его из ВСЕХ комплектов — см. правило 3 в шапке.
 * Файлы медиа здесь не трогаются: их судьбу решает вызывающий код, потому
 * что одну картинку могут делить два слова (хранилище дедуплицирует по хешу).
 */
export function applyDeleteWord(
  words: readonly Word[],
  sets: readonly WordSet[],
  wordId: string
): { words: Word[]; sets: WordSet[] } {
  const word = words.find((w) => w.id === wordId);
  if (!word) throw new AlphabetContentError('Такого слова нет');
  if (!isUserEntityId(wordId)) {
    throw new AlphabetContentError('Поставочное слово удалить нельзя');
  }
  return {
    words: words.filter((w) => w.id !== wordId),
    sets: sets.map((set) =>
      set.wordIds.includes(wordId)
        ? { ...set, wordIds: set.wordIds.filter((id) => id !== wordId) }
        : set
    ),
  };
}

/**
 * Чего не хватает слову, чтобы работать на всех трёх этапах.
 *
 * НЕ ЗАПРЕТ, А ПОДСКАЗКА. Слово без записей сохраняется и играется на этапе 1;
 * требовать полную озвучку до сохранения значило бы заставить педагога
 * сделать всё за один присест.
 */
export interface WordReadiness {
  /** Годится этапу 1 «покажи букву» */
  letterShow: boolean;
  /** Годится этапу 2 «закончи слово» */
  wordCompleting: boolean;
  /** Годится этапу 3 «составь слово» */
  wordMake: boolean;
  /** Чего не хватает — текстом для педагога */
  missing: string[];
}

export function checkUserWordReadiness(
  word: Word,
  options: { hasImage: boolean; hasWholeAudio: boolean; syllablesWithAudio: Set<string> }
): WordReadiness {
  const missing: string[] = [];
  if (!options.hasImage) missing.push('иллюстрация');
  if (!options.hasWholeAudio) missing.push('запись слова целиком');

  const multi = word.syllableIds.length >= 2;
  if (multi && !word.hasWithoutLastSyllable) missing.push('запись слова без последнего слога');

  const silentSyllables = word.syllableIds.filter((id) => !options.syllablesWithAudio.has(id));
  if (silentSyllables.length > 0) missing.push(`озвучка слогов (${silentSyllables.length})`);

  return {
    // Этапу 1 достаточно картинки: буква определяется по графу, а звук —
    // удобство, и его отсутствие подписано на самом экране
    letterShow: options.hasImage,
    wordCompleting: multi && word.hasWithoutLastSyllable && options.hasImage,
    wordMake: multi && options.hasImage && silentSyllables.length === 0,
    missing,
  };
}

// ─── Комплекты (ТЗ строка 77: пять операций) ────────────────────────────

export interface SetDraft {
  title: string;
  wordIds: string[];
}

function normalizeSetTitle(raw: string): string {
  const value = String(raw ?? '').trim();
  if (value.length === 0) throw new AlphabetContentError('У комплекта должно быть название');
  if (value.length > MAX_SET_TITLE_LENGTH) {
    throw new AlphabetContentError(`Название длиннее ${MAX_SET_TITLE_LENGTH} символов`);
  }
  return value;
}

function assertWordsExist(wordIds: string[], words: readonly Word[]): string[] {
  if (!Array.isArray(wordIds)) throw new AlphabetContentError('Список слов комплекта повреждён');
  const known = new Set(words.map((w) => w.id));
  const missing = wordIds.filter((id) => !known.has(id));
  if (missing.length > 0) {
    throw new AlphabetContentError(`Слов нет в наборе: ${missing.join(', ')}`);
  }
  // Повтор в комплекте — не ошибка ввода, а бессмыслица: слово и так может
  // выпасть в партии дважды, а в списке выглядело бы как две карточки
  return [...new Set(wordIds)];
}

export function applyCreateSet(
  sets: readonly WordSet[],
  words: readonly Word[],
  draft: SetDraft,
  newId: string
): { sets: WordSet[]; created: WordSet } {
  const title = normalizeSetTitle(draft.title);
  if (!isUserEntityId(newId)) {
    throw new AlphabetContentError('Идентификатор своего комплекта должен быть «u» и 16 hex');
  }
  if (sets.some((s) => s.title.toLowerCase() === title.toLowerCase())) {
    throw new AlphabetContentError(`Комплект «${title}» уже есть`);
  }
  const created: WordSet = { id: newId, title, wordIds: assertWordsExist(draft.wordIds, words) };
  return { sets: [...sets, created], created };
}

/** Переименование и правка состава — одна операция: экран редактора один */
export function applyUpdateSet(
  sets: readonly WordSet[],
  words: readonly Word[],
  setId: string,
  draft: SetDraft
): { sets: WordSet[]; updated: WordSet } {
  const index = sets.findIndex((s) => s.id === setId);
  if (index < 0) throw new AlphabetContentError('Такого комплекта нет');
  if (!isUserEntityId(setId)) {
    throw new AlphabetContentError('Поставочный комплект изменить нельзя — создайте свой');
  }
  const title = normalizeSetTitle(draft.title);
  if (sets.some((s, i) => i !== index && s.title.toLowerCase() === title.toLowerCase())) {
    throw new AlphabetContentError(`Комплект «${title}» уже есть`);
  }
  const updated: WordSet = { id: setId, title, wordIds: assertWordsExist(draft.wordIds, words) };
  const next = sets.slice();
  next[index] = updated;
  return { sets: next, updated };
}

export function applyDeleteSet(sets: readonly WordSet[], setId: string): WordSet[] {
  const set = sets.find((s) => s.id === setId);
  if (!set) throw new AlphabetContentError('Такого комплекта нет');
  if (!isUserEntityId(setId)) {
    throw new AlphabetContentError('Поставочный комплект удалить нельзя');
  }
  return sets.filter((s) => s.id !== setId);
}

/**
 * Имя импортируемого комплекта при конфликте. Эталон в этом случае сообщает
 * «Импортируемая тема "X" уже существует под именем "Y"» — то есть
 * переименовывает, а не отказывает. Повторяем: отказ на импорте заставил бы
 * педагога сначала идти переименовывать существующий комплект.
 */
export function resolveImportedSetTitle(
  sets: readonly WordSet[],
  title: string
): { title: string; renamed: boolean } {
  const base = normalizeSetTitle(title);
  const taken = new Set(sets.map((s) => s.title.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return { title: base, renamed: false };
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${base} (${n})`;
    if (!taken.has(candidate.toLowerCase())) return { title: candidate, renamed: true };
  }
  throw new AlphabetContentError('Слишком много комплектов с таким названием');
}

// ─── Сборка библиотеки из поставочного и своего ─────────────────────────

/**
 * Библиотека, которую видит игра: поставочный пакет плюс контент педагога.
 *
 * Слова педагога дописываются и к своим буквам — иначе этап «покажи букву»
 * их не предложит, хотя они есть. Ровно эту связь проверяет checkGraph, и
 * ровно на ней один раз уже споткнулся сборщик поставочного пакета.
 */
export function mergeUserContent(
  library: AlphabetLibrary,
  user: { words: readonly Word[]; syllables: readonly Syllable[]; sets: readonly WordSet[] }
): AlphabetLibrary {
  const syllables = [...library.syllables, ...user.syllables];
  const words = [...library.words, ...user.words];

  const byNumber = new Map(library.letters.map((l) => [l.number, [...l.wordIds]]));
  for (const word of user.words) {
    const firstSyllable = syllables.find((s) => s.id === word.syllableIds[0]);
    const first = firstSyllable?.letterNumbers[0];
    if (first === undefined) continue;
    const list = byNumber.get(first);
    if (list && !list.includes(word.id)) list.push(word.id);
  }

  return {
    ...library,
    letters: library.letters.map((l) => ({ ...l, wordIds: byNumber.get(l.number) ?? l.wordIds })),
    syllables,
    words,
    sets: [...library.sets, ...user.sets],
  };
}

/** Разбор своего контента с диска — недоверенные данные не идут мимо схемы */
export function parseUserContent(input: unknown): {
  words: Word[];
  syllables: Syllable[];
  sets: WordSet[];
} {
  if (!input || typeof input !== 'object') return { words: [], syllables: [], sets: [] };
  const raw = input as Record<string, unknown>;
  // Разбор терпимый по каждому списку отдельно: битый список слогов не должен
  // уносить комплекты, которые к нему отношения не имеют
  return {
    words: keepValid<Word>(raw.words, isWordShape),
    syllables: keepValid<Syllable>(raw.syllables, isSyllableShape),
    sets: keepValid<WordSet>(raw.sets, isSetShape),
  };
}

function keepValid<T>(list: unknown, ok: (v: unknown) => boolean): T[] {
  if (!Array.isArray(list)) return [];
  return list.filter(ok) as T[];
}

function isSyllableShape(v: unknown): boolean {
  const s = v as Syllable;
  return (
    !!s &&
    typeof s.id === 'string' &&
    typeof s.name === 'string' &&
    Array.isArray(s.letterNumbers) &&
    s.letterNumbers.every((n) => Number.isInteger(n) && n >= 1 && n <= 33)
  );
}

function isWordShape(v: unknown): boolean {
  const w = v as Word;
  return (
    !!w &&
    typeof w.id === 'string' &&
    typeof w.name === 'string' &&
    Array.isArray(w.syllableIds) &&
    w.syllableIds.length > 0 &&
    w.syllableIds.every((id) => typeof id === 'string') &&
    typeof w.hasWithoutLastSyllable === 'boolean'
  );
}

function isSetShape(v: unknown): boolean {
  const s = v as WordSet;
  return (
    !!s &&
    typeof s.id === 'string' &&
    typeof s.title === 'string' &&
    Array.isArray(s.wordIds) &&
    s.wordIds.every((id) => typeof id === 'string')
  );
}

export { AlphabetValidationError };
