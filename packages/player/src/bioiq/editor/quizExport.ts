// packages/player/src/bioiq/editor/quizExport.ts
// FR-013 ТЗ (строка 252, обмен викторинами) — прямая адаптация
// rusiq/editor/quizExport.ts (Тип 7): экспорт/импорт ОДНОГО
// самодостаточного JSON-файла (викторина + base64 всех картинок),
// читаемого уже установленным лицензированным Плеером. Согласованная
// реинтерпретация «без установки продукта» — тот же прецедент, что уже
// принят для rusiq (план реализации Тип10_БиоIQ §6, вопрос 2).
//
// Отличие от rusiq: картинок-карт ТРИ (по одной на уровень, quiz.images),
// не одна общая (quiz.image) — buildExportPayload собирает все, persist*
// при импорте разбирает по номеру уровня, а не как один "background".

import { BioiqQuizSchema, type BioiqQuestion, type BioiqQuiz } from '../model/schema.ts';
import { bioiqLevelImageMediaUrl, bioiqItemImageUrl } from '../bioiqMediaUrl.ts';
import { saveQuizLevelImage, saveQuizItemImage, type BioiqItemImageKind } from './quizStore.ts';

export const BIOIQ_EXPORT_FORMAT = 'bioiq-quiz-export-v1' as const;

export interface BioiqExportedImage {
  base64: string;
  mimeType: string;
}

export interface BioiqExportedFile {
  format: typeof BIOIQ_EXPORT_FORMAT;
  quiz: BioiqQuiz;
  // Ключ - имя файла НА ДИСКЕ ЭКСПОРТЁРА (quiz.images[level].fileName /
  // question.*Image) - при импорте эти имена только сопоставляют картинку
  // с её местом в quiz, не переиспользуются как реальные имена на диске
  // получателя.
  images: Record<string, BioiqExportedImage>;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export type FetchAsBase64 = (mediaUrl: string) => Promise<BioiqExportedImage | null>;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function fetchMediaAsBase64(mediaUrl: string): Promise<BioiqExportedImage | null> {
  try {
    const res = await fetch(mediaUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    const base64 = await blobToBase64(blob);
    return { base64, mimeType: blob.type || 'application/octet-stream' };
  } catch {
    return null;
  }
}

async function collectImage(
  images: Record<string, BioiqExportedImage>,
  fetchAsBase64: FetchAsBase64,
  fileName: string | null,
  mediaUrl: string,
): Promise<void> {
  if (!fileName || images[fileName]) return;
  const result = await fetchAsBase64(mediaUrl);
  if (result) images[fileName] = result;
}

// Собирает самодостаточный экспортный объект: викторина как есть
// (fileName-поля ещё указывают на имена файлов экспортёра) + карта ВСЕХ
// используемых картинок (три изображения-карты уровней + per-вопросные
// question/answer/hint) с их base64-содержимым. Отсутствие какой-то одной
// картинки на диске экспортёра НЕ прерывает экспорт целиком — та же
// graceful degradation, что у rusiq.
export async function buildExportPayload(quiz: BioiqQuiz, fetchAsBase64: FetchAsBase64): Promise<BioiqExportedFile> {
  const images: Record<string, BioiqExportedImage> = {};
  for (const levelKey of Object.keys(quiz.images)) {
    const meta = quiz.images[levelKey];
    await collectImage(images, fetchAsBase64, meta.fileName, bioiqLevelImageMediaUrl(meta.fileName));
  }
  for (const q of quiz.questions) {
    await collectImage(images, fetchAsBase64, q.questionImage, q.questionImage ? bioiqItemImageUrl(q.questionImage) : '');
    await collectImage(images, fetchAsBase64, q.answerImage, q.answerImage ? bioiqItemImageUrl(q.answerImage) : '');
    await collectImage(images, fetchAsBase64, q.hintImage, q.hintImage ? bioiqItemImageUrl(q.hintImage) : '');
  }
  return { format: BIOIQ_EXPORT_FORMAT, quiz, images };
}

export function serializeExportPayload(payload: BioiqExportedFile): string {
  return JSON.stringify(payload);
}

export function suggestExportFileName(quiz: BioiqQuiz): string {
  const safeTitle = quiz.title.trim().replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
  return `${safeTitle.length > 0 ? safeTitle : 'Викторина'}.bioiq.json`;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export type PersistLevelImage = (quizId: string, level: number, bytes: Uint8Array, mimeType: string) => Promise<{ ok: boolean; fileName?: string }>;
export type PersistItemImage = (
  quizId: string,
  questionId: string,
  kind: BioiqItemImageKind,
  bytes: Uint8Array,
  mimeType: string,
) => Promise<{ ok: boolean; fileName?: string }>;

export const persistLevelImageViaIpc: PersistLevelImage = (quizId, level, bytes, mimeType) =>
  saveQuizLevelImage(quizId, level, bytes.buffer as ArrayBuffer, mimeType);

export const persistItemImageViaIpc: PersistItemImage = (quizId, questionId, kind, bytes, mimeType) =>
  saveQuizItemImage(quizId, questionId, kind, bytes.buffer as ArrayBuffer, mimeType);

export type ImportQuizResult = { ok: true; quiz: BioiqQuiz } | { ok: false; error: string };

// Разбирает файл, полученный buildExportPayload/serializeExportPayload,
// обратно в валидный BioiqQuiz со СВЕЖИМ id (та же причина, что у rusiq:
// id экспортёра мог совпасть случайно или намеренно дублироваться) и
// заново сохранёнными на диске картинками. Отличие от rusiq: persist
// проходит по ВСЕМ трём уровням, а не по одному общему фону — если хотя
// бы для одного объявленного уровня картинка не восстановилась, импорт
// целиком отклоняется (та же дисциплина "не пускать невалидную запись",
// что у handleSave в EditorScreen — квиз без карты хотя бы одного уровня
// не пройдёт BioiqQuizSchema всё равно, лучше явная ошибка при импорте,
// чем немой битый файл на диске получателя).
export async function parseAndPersistImportedQuiz(
  rawJson: string,
  persistLevelImage: PersistLevelImage,
  persistItemImage: PersistItemImage,
): Promise<ImportQuizResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { ok: false, error: 'Файл повреждён — это не корректный JSON' };
  }
  if (!isPlainRecord(parsed) || parsed.format !== BIOIQ_EXPORT_FORMAT) {
    return { ok: false, error: 'Это не файл экспорта викторины БиоIQ' };
  }
  const quizResult = BioiqQuizSchema.safeParse(parsed.quiz);
  if (!quizResult.success) {
    return { ok: false, error: 'Содержимое викторины в файле повреждено или неполно' };
  }
  const images = isPlainRecord(parsed.images) ? parsed.images : {};

  const newQuizId = crypto.randomUUID();

  async function persistImageBytes(
    oldFileName: string | null,
  ): Promise<{ base64: string; mimeType: string } | null> {
    if (!oldFileName) return null;
    const img = images[oldFileName];
    if (!isPlainRecord(img) || typeof img.base64 !== 'string' || typeof img.mimeType !== 'string') return null;
    return { base64: img.base64, mimeType: img.mimeType };
  }

  const newImages: BioiqQuiz['images'] = {};
  for (const levelKey of Object.keys(quizResult.data.images)) {
    const meta = quizResult.data.images[levelKey];
    const raw = await persistImageBytes(meta.fileName);
    if (!raw) {
      return { ok: false, error: `Не удалось восстановить изображение-карту уровня ${levelKey} из файла` };
    }
    const bytes = base64ToBytes(raw.base64);
    const result = await persistLevelImage(newQuizId, Number(levelKey), bytes, raw.mimeType);
    if (!result.ok || !result.fileName) {
      return { ok: false, error: `Не удалось сохранить изображение-карту уровня ${levelKey}` };
    }
    newImages[levelKey] = { ...meta, fileName: result.fileName };
  }

  async function persistItemImageField(
    oldFileName: string | null,
    kind: BioiqItemImageKind,
    questionId: string,
  ): Promise<string | null> {
    const raw = await persistImageBytes(oldFileName);
    if (!raw) return null;
    const bytes = base64ToBytes(raw.base64);
    const result = await persistItemImage(newQuizId, questionId, kind, bytes, raw.mimeType);
    return result.ok ? (result.fileName ?? null) : null;
  }

  const newQuestions: BioiqQuestion[] = [];
  for (const q of quizResult.data.questions) {
    newQuestions.push({
      ...q,
      questionImage: await persistItemImageField(q.questionImage, 'question', q.id),
      answerImage: await persistItemImageField(q.answerImage, 'answer', q.id),
      hintImage: await persistItemImageField(q.hintImage, 'hint', q.id),
    });
  }

  const quiz: BioiqQuiz = {
    ...quizResult.data,
    id: newQuizId,
    images: newImages,
    questions: newQuestions,
  };

  return { ok: true, quiz };
}
