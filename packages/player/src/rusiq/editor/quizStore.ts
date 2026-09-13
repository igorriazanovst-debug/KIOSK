// packages/player/src/rusiq/editor/quizStore.ts
// Тонкая обёртка над window.rusiqAPI для каталога пользовательских
// викторин (Фаза 2a) - тот же принцип, что userDataStorage.ts у истории
// результатов (Фаза 1). Список (listQuizzes) НЕ валидируется схемой -
// это только метаданные для каталога (id/title/hasPassword/updatedAt),
// полная RusiqQuizSchema применяется только к результату loadQuiz/перед
// saveQuiz, где нужна ПОЛНАЯ структура викторины.
//
// Примечание: window.rusiqAPI уже частично типизирован через
// `declare global` в userDataStorage.ts (loadUserData/saveUserData).
// TypeScript не сливает несколько `declare global` для одного и того же
// свойства интерфейса, если формы отличаются (TS2717) - при попытке
// повторно объявить `Window.rusiqAPI` здесь с расширенным набором полей
// компилятор требует ТОЧНОГО совпадения типа с уже существующим
// объявлением и не увеличивает набор свойств. Поэтому редакторские
// методы API типизируются локально (RusiqEditorAPI) и достаются через
// точечное приведение типа, не через повторную глобальную аугментацию.

import { RusiqQuizSchema, type RusiqQuiz } from '../model/schema.ts';

export interface QuizListEntry {
  id: string;
  title: string;
  hasPassword: boolean;
  updatedAt: string;
}

interface RusiqEditorAPI {
  listQuizzes: () => Promise<QuizListEntry[]>;
  loadQuiz: (quizId: string) => Promise<unknown>;
  saveQuiz: (quiz: RusiqQuiz) => Promise<{ ok: boolean }>;
  deleteQuiz: (quizId: string) => Promise<{ ok: boolean }>;
  saveQuizBackground: (
    quizId: string,
    buffer: ArrayBuffer,
    mimeType: string,
  ) => Promise<{ ok: boolean; fileName?: string }>;
}

function getEditorAPI(): RusiqEditorAPI | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { rusiqAPI?: RusiqEditorAPI }).rusiqAPI;
}

export async function listQuizzes(): Promise<QuizListEntry[]> {
  const api = getEditorAPI();
  if (!api) return [];
  try {
    return await api.listQuizzes();
  } catch {
    return [];
  }
}

export async function loadQuiz(quizId: string): Promise<RusiqQuiz | null> {
  const api = getEditorAPI();
  if (!api) return null;
  try {
    const raw = await api.loadQuiz(quizId);
    const parsed = RusiqQuizSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function saveQuiz(quiz: RusiqQuiz): Promise<boolean> {
  const api = getEditorAPI();
  if (!api) return false;
  try {
    const result = await api.saveQuiz(quiz);
    return result.ok;
  } catch {
    return false;
  }
}

export async function deleteQuiz(quizId: string): Promise<boolean> {
  const api = getEditorAPI();
  if (!api) return false;
  try {
    const result = await api.deleteQuiz(quizId);
    return result.ok;
  } catch {
    return false;
  }
}

export async function saveQuizBackground(
  quizId: string,
  buffer: ArrayBuffer,
  mimeType: string,
): Promise<{ ok: boolean; fileName?: string }> {
  const api = getEditorAPI();
  if (!api) return { ok: false };
  try {
    return await api.saveQuizBackground(quizId, buffer, mimeType);
  } catch {
    return { ok: false };
  }
}
