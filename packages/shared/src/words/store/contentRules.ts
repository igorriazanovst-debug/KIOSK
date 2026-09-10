// packages/shared/src/words/store/contentRules.ts
// Правила работы с контентом педагога: свои слова и свои комплекты.
// Чистые функции без файловой системы — как и rules.ts, они общие для
// Windows и нативной Android-реализации (см. docs/words-cross-platform-contract.md).
//
// Закрывают требования ТЗ: строка 55 (аудио, текст, графика), строка 56
// (создание, удаление, переименование, импорт и экспорт комплектов),
// строка 57 (свои слова и объединение их в темы).
//
// Ключевое правило, которое нельзя потерять при второй реализации:
// удаление своего слова ВЫЧИЩАЕТ его из всех комплектов, где оно
// использовалось. У эталона ОС3 это сделано (DELETE_MY_WORD_IN_ALL_MY_THEMES),
// и висячих ссылок после удаления не остаётся. Комплект, ссылающийся на
// удалённое слово, — это партия, которая падает посреди урока.

import type { UserSet, UserWord } from '../model/schema';
import { WordsRulesError } from './rules';

export const MAX_USER_WORD_NAME_LENGTH = 64;
export const MAX_SET_TITLE_LENGTH = 80;
export const MAX_USER_WORDS = 500;
export const MAX_SETS = 100;
/** Минимум слов в комплекте, с которым партия имеет смысл */
export const MIN_SET_WORDS = 2;

function normalizeName(raw: unknown, what: string, maxLength: number): string {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) throw new WordsRulesError(`${what} не может быть пустым`);
  if (trimmed.length > maxLength) {
    throw new WordsRulesError(`${what} длиннее ${maxLength} символов`);
  }
  return trimmed;
}

// ─── Свои слова ─────────────────────────────────────────────────────────

export interface UserWordDraft {
  name: string;
  /** Имя файла иллюстрации в каталоге медиа; null — картинки нет */
  imageFile: string | null;
  /** Имя файла озвучки; null — записи нет */
  audioFile: string | null;
}

/**
 * Своё слово без картинки и без звука бессмысленно: в игре его нечем
 * показать и нечем произнести. Требуем хотя бы одно из двух — картинку
 * (её видно на карточке) или запись (её слышно).
 */
function assertPlayable(draft: UserWordDraft): void {
  if (!draft.imageFile && !draft.audioFile) {
    throw new WordsRulesError(
      'У слова должна быть хотя бы картинка или запись — иначе его нечем показать ребёнку'
    );
  }
}

export function applyCreateUserWord(
  words: readonly UserWord[],
  draft: UserWordDraft,
  id: string
): { words: UserWord[]; created: UserWord } {
  const name = normalizeName(draft.name, 'Название слова', MAX_USER_WORD_NAME_LENGTH);
  assertPlayable(draft);

  if (words.length >= MAX_USER_WORDS) {
    throw new WordsRulesError(`Больше ${MAX_USER_WORDS} своих слов не поддерживается`);
  }
  if (words.some((w) => w.name.toLowerCase() === name.toLowerCase())) {
    throw new WordsRulesError(`Слово «${name}» у вас уже есть`);
  }

  const created: UserWord = {
    id,
    name,
    level: 9,
    imageFile: draft.imageFile,
    audioFile: draft.audioFile,
  };
  return { words: [...words, created], created };
}

export function applyUpdateUserWord(
  words: readonly UserWord[],
  wordId: string,
  draft: UserWordDraft
): { words: UserWord[]; updated: UserWord } {
  const index = words.findIndex((w) => w.id === wordId);
  if (index < 0) throw new WordsRulesError('Такого слова нет в списке');

  const name = normalizeName(draft.name, 'Название слова', MAX_USER_WORD_NAME_LENGTH);
  assertPlayable(draft);

  if (words.some((w) => w.id !== wordId && w.name.toLowerCase() === name.toLowerCase())) {
    throw new WordsRulesError(`Слово «${name}» у вас уже есть`);
  }

  const updated: UserWord = {
    ...words[index],
    name,
    imageFile: draft.imageFile,
    audioFile: draft.audioFile,
  };
  const next = words.slice();
  next[index] = updated;
  return { words: next, updated };
}

export interface DeleteUserWordResult {
  words: UserWord[];
  sets: UserSet[];
  /** Комплекты, из которых слово было вычищено — их стоит показать педагогу */
  affectedSetIds: string[];
  /** Файлы медиа, которые больше никому не нужны и подлежат удалению */
  orphanedFiles: string[];
}

/**
 * Удаление своего слова. Слово вычищается из ВСЕХ комплектов — висячих
 * ссылок не остаётся. Файлы медиа возвращаются отдельно: удалять их или нет,
 * решает уровень хранения, но знать, что они осиротели, должен домен.
 */
export function applyDeleteUserWord(
  words: readonly UserWord[],
  sets: readonly UserSet[],
  wordId: string
): DeleteUserWordResult {
  const word = words.find((w) => w.id === wordId);
  if (!word) throw new WordsRulesError('Такого слова нет в списке');

  const remaining = words.filter((w) => w.id !== wordId);
  const affectedSetIds: string[] = [];
  const nextSets = sets.map((set) => {
    if (!set.wordIds.includes(wordId)) return set;
    affectedSetIds.push(set.id);
    return { ...set, wordIds: set.wordIds.filter((id) => id !== wordId) };
  });

  // Файл считается осиротевшим, только если на него не ссылается ни одно
  // другое слово: две карточки могут делить одну картинку после копирования
  const stillUsed = new Set<string>();
  for (const w of remaining) {
    if (w.imageFile) stillUsed.add(w.imageFile);
    if (w.audioFile) stillUsed.add(w.audioFile);
  }
  const orphanedFiles = [word.imageFile, word.audioFile].filter(
    (file): file is string => !!file && !stillUsed.has(file)
  );

  return { words: remaining, sets: nextSets, affectedSetIds, orphanedFiles };
}

// ─── Комплекты ──────────────────────────────────────────────────────────

export interface SetDraft {
  title: string;
  wordIds: readonly string[];
}

function assertSetContent(draft: SetDraft, knownWordIds: ReadonlySet<string>): string[] {
  const unique: string[] = [];
  for (const id of draft.wordIds) {
    if (!knownWordIds.has(id)) {
      throw new WordsRulesError(`В комплекте есть слово, которого больше нет: ${id}`);
    }
    if (!unique.includes(id)) unique.push(id);
  }
  if (unique.length < MIN_SET_WORDS) {
    throw new WordsRulesError(`В комплекте должно быть хотя бы ${MIN_SET_WORDS} слова`);
  }
  return unique;
}

export function applyCreateSet(
  sets: readonly UserSet[],
  draft: SetDraft,
  id: string,
  knownWordIds: ReadonlySet<string>
): { sets: UserSet[]; created: UserSet } {
  const title = normalizeName(draft.title, 'Название комплекта', MAX_SET_TITLE_LENGTH);
  const wordIds = assertSetContent(draft, knownWordIds);

  if (sets.length >= MAX_SETS) {
    throw new WordsRulesError(`Больше ${MAX_SETS} комплектов не поддерживается`);
  }
  if (sets.some((s) => s.title.toLowerCase() === title.toLowerCase())) {
    throw new WordsRulesError(`Комплект «${title}» уже есть`);
  }

  const created: UserSet = { id, title, wordIds };
  return { sets: [...sets, created], created };
}

/** Переименование и правка состава — одна операция (ТЗ строка 56) */
export function applyUpdateSet(
  sets: readonly UserSet[],
  setId: string,
  draft: SetDraft,
  knownWordIds: ReadonlySet<string>
): { sets: UserSet[]; updated: UserSet } {
  const index = sets.findIndex((s) => s.id === setId);
  if (index < 0) throw new WordsRulesError('Такого комплекта нет');

  const title = normalizeName(draft.title, 'Название комплекта', MAX_SET_TITLE_LENGTH);
  const wordIds = assertSetContent(draft, knownWordIds);

  if (sets.some((s) => s.id !== setId && s.title.toLowerCase() === title.toLowerCase())) {
    throw new WordsRulesError(`Комплект «${title}» уже есть`);
  }

  const updated: UserSet = { ...sets[index], title, wordIds };
  const next = sets.slice();
  next[index] = updated;
  return { sets: next, updated };
}

export function applyDeleteSet(sets: readonly UserSet[], setId: string): UserSet[] {
  const remaining = sets.filter((s) => s.id !== setId);
  if (remaining.length === sets.length) throw new WordsRulesError('Такого комплекта нет');
  return remaining;
}
