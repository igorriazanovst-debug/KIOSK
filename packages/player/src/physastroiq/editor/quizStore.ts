// packages/player/src/physastroiq/editor/quizStore.ts
// Тонкая обёртка над window.physastroiqAPI для каталога пользовательских
// викторин. Прямая адаптация rusiq/editor/quizStore.ts (Тип 7).
// Отличие: saveQuizBackground (один общий фон) заменён на
// saveQuizLevelImage(quizId, level, ...) — своя картинка на каждый из
// 3 уровней (план реализации §3). Список (listQuizzes) НЕ валидируется
// схемой — только метаданные каталога; полная PhysastroiqQuizSchema
// применяется к результату loadQuiz/перед saveQuiz.

import { PhysastroiqQuizSchema, type PhysastroiqQuiz } from '../model/schema.ts';

export interface QuizListEntry {
  id: string;
  title: string;
  hasPassword: boolean;
  updatedAt: string;
}

export type PhysastroiqItemImageKind = 'question' | 'answer' | 'hint';

interface PhysastroiqEditorAPI {
  listQuizzes: () => Promise<QuizListEntry[]>;
  loadQuiz: (quizId: string) => Promise<unknown>;
  saveQuiz: (quiz: PhysastroiqQuiz) => Promise<{ ok: boolean }>;
  deleteQuiz: (quizId: string) => Promise<{ ok: boolean }>;
  saveQuizLevelImage: (
    quizId: string,
    level: number,
    buffer: ArrayBuffer,
    mimeType: string,
  ) => Promise<{ ok: boolean; fileName?: string }>;
  saveQuizItemImage: (
    quizId: string,
    questionId: string,
    kind: PhysastroiqItemImageKind,
    buffer: ArrayBuffer,
    mimeType: string,
  ) => Promise<{ ok: boolean; fileName?: string }>;
  deleteQuizItemImage: (fileName: string) => Promise<{ ok: boolean }>;
  exportQuiz: (fileContentJson: string, suggestedFileName: string) => Promise<{ ok: boolean; filePath?: string; canceled?: boolean }>;
  importQuiz: () => Promise<{ ok: boolean; content?: string; canceled?: boolean }>;
}

function getEditorAPI(): PhysastroiqEditorAPI | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { physastroiqAPI?: PhysastroiqEditorAPI }).physastroiqAPI;
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

export async function loadQuiz(quizId: string): Promise<PhysastroiqQuiz | null> {
  const api = getEditorAPI();
  if (!api) return null;
  try {
    const raw = await api.loadQuiz(quizId);
    const parsed = PhysastroiqQuizSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function saveQuiz(quiz: PhysastroiqQuiz): Promise<boolean> {
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

export async function saveQuizLevelImage(
  quizId: string,
  level: number,
  buffer: ArrayBuffer,
  mimeType: string,
): Promise<{ ok: boolean; fileName?: string }> {
  const api = getEditorAPI();
  if (!api) return { ok: false };
  try {
    return await api.saveQuizLevelImage(quizId, level, buffer, mimeType);
  } catch {
    return { ok: false };
  }
}

export async function saveQuizItemImage(
  quizId: string,
  questionId: string,
  kind: PhysastroiqItemImageKind,
  buffer: ArrayBuffer,
  mimeType: string,
): Promise<{ ok: boolean; fileName?: string }> {
  const api = getEditorAPI();
  if (!api) return { ok: false };
  try {
    return await api.saveQuizItemImage(quizId, questionId, kind, buffer, mimeType);
  } catch {
    return { ok: false };
  }
}

export async function deleteQuizItemImage(fileName: string): Promise<boolean> {
  const api = getEditorAPI();
  if (!api) return false;
  try {
    const result = await api.deleteQuizItemImage(fileName);
    return result.ok;
  } catch {
    return false;
  }
}

export async function exportQuizFile(fileContentJson: string, suggestedFileName: string): Promise<{ ok: boolean; filePath?: string }> {
  const api = getEditorAPI();
  if (!api) return { ok: false };
  try {
    return await api.exportQuiz(fileContentJson, suggestedFileName);
  } catch {
    return { ok: false };
  }
}

export async function importQuizFile(): Promise<{ ok: boolean; content?: string }> {
  const api = getEditorAPI();
  if (!api) return { ok: false };
  try {
    return await api.importQuiz();
  } catch {
    return { ok: false };
  }
}
