// packages/player/src/rusiq/editor/quizExport.ts
// FR-013 (обмен викторинами между пользователями) + FR-018 (экспорт в
// отдельный файл) - согласованная реинтерпретация из дизайн-спеки Фазы 1
// (см. Тип7_трассировочная_матрица.md, «Реализовано через согласованное
// переосмысление»): «без установки продукта» буквально не реализуется - у
// KIOSK нет прецедента непривязанного к лицензии исполняемого артефакта.
// Вместо этого: экспорт/импорт ОДНОГО самодостаточного JSON-файла (сама
// викторина + base64 всех картинок, на которые она ссылается), читаемого
// уже установленным лицензированным Плеером через кнопки в
// QuizCatalogScreen.
//
// Картинки на диске (фон + per-вопросные question/answer/hint, FR-015)
// хранятся ОТДЕЛЬНЫМИ файлами (rusiqmedia://), не внутри quiz.json - экспорт
// поэтому должен явно СОБРАТЬ их в один файл (fetch по тому же
// rusiqmedia:// URL, которым их уже рисует UI, работает и как обычный
// fetch благодаря supportFetchAPI: true у схемы в main.js), а импорт -
// РАЗОБРАТЬ обратно на отдельные файлы на диске под новыми именами
// (квиз может импортироваться на другую машину/поверх другого набора
// файлов - доверять старым именам с диска экспортёра нельзя).
//
// Тестируемость: fetch/сохранение на диск вынесены в инжектируемые
// параметры (FetchAsBase64/PersistBackground/PersistItemImage) - тот же
// принцип, что инжектируемый RNG у quizEngine.ts (Тип 8), чтобы саму логику
// сборки/разбора можно было проверить без реального Electron/fetch.

import { RusiqQuizSchema, type RusiqQuestion, type RusiqQuiz } from '../model/schema.ts';
import { rusiqBackgroundMediaUrl, rusiqItemImageUrl } from '../rusiqMediaUrl.ts';
import { saveQuizBackground, saveQuizItemImage, type RusiqItemImageKind } from './quizStore.ts';

export const RUSIQ_EXPORT_FORMAT = 'rusiq-quiz-export-v1' as const;

export interface RusiqExportedImage {
  base64: string;
  mimeType: string;
}

export interface RusiqExportedFile {
  format: typeof RUSIQ_EXPORT_FORMAT;
  quiz: RusiqQuiz;
  // Ключ - имя файла НА ДИСКЕ ЭКСПОРТЁРА (quiz.image.fileName / question.*Image
  // в quiz выше) - при импорте эти имена только сопоставляют картинку с её
  // местом в quiz, не переиспользуются как реальные имена на диске получателя.
  images: Record<string, RusiqExportedImage>;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export type FetchAsBase64 = (mediaUrl: string) => Promise<RusiqExportedImage | null>;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string; // "data:<mime>;base64,<data>"
      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// Продакшен-реализация FetchAsBase64 - читает уже загружаемый rusiqmedia://
// URL через обычный fetch (схема зарегистрирована с supportFetchAPI: true в
// main.js) вместо повторной IPC-точки чтения сырых байт файла.
export async function fetchMediaAsBase64(mediaUrl: string): Promise<RusiqExportedImage | null> {
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
  images: Record<string, RusiqExportedImage>,
  fetchAsBase64: FetchAsBase64,
  fileName: string | null,
  mediaUrl: string,
): Promise<void> {
  if (!fileName || images[fileName]) return;
  const result = await fetchAsBase64(mediaUrl);
  if (result) images[fileName] = result;
}

// Собирает самодостаточный экспортный объект: сама викторина как есть
// (fileName-поля ещё указывают на имена файлов экспортёра) + карта всех
// используемых картинок с их base64-содержимым. Отсутствие какой-то одной
// картинки на диске экспортёра (fetchAsBase64 вернул null) НЕ прерывает
// экспорт целиком - просто эта картинка не попадёт в images, импортёр
// обработает это как «картинки не было» (graceful degradation, та же
// философия, что уже применена к отсутствующим фото у 23/118 элементов
// Тип8).
export async function buildExportPayload(quiz: RusiqQuiz, fetchAsBase64: FetchAsBase64): Promise<RusiqExportedFile> {
  const images: Record<string, RusiqExportedImage> = {};
  await collectImage(images, fetchAsBase64, quiz.image.fileName, rusiqBackgroundMediaUrl(quiz.image.fileName));
  for (const q of quiz.questions) {
    await collectImage(images, fetchAsBase64, q.questionImage, q.questionImage ? rusiqItemImageUrl(q.questionImage) : '');
    await collectImage(images, fetchAsBase64, q.answerImage, q.answerImage ? rusiqItemImageUrl(q.answerImage) : '');
    await collectImage(images, fetchAsBase64, q.hintImage, q.hintImage ? rusiqItemImageUrl(q.hintImage) : '');
  }
  return { format: RUSIQ_EXPORT_FORMAT, quiz, images };
}

export function serializeExportPayload(payload: RusiqExportedFile): string {
  return JSON.stringify(payload);
}

export function suggestExportFileName(quiz: RusiqQuiz): string {
  const safeTitle = quiz.title.trim().replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
  return `${safeTitle.length > 0 ? safeTitle : 'Викторина'}.rusiq.json`;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export type PersistBackground = (quizId: string, bytes: Uint8Array, mimeType: string) => Promise<{ ok: boolean; fileName?: string }>;
export type PersistItemImage = (
  quizId: string,
  questionId: string,
  kind: RusiqItemImageKind,
  bytes: Uint8Array,
  mimeType: string,
) => Promise<{ ok: boolean; fileName?: string }>;

// Продакшен-адаптеры PersistBackground/PersistItemImage поверх уже
// существующего quizStore (те же IPC-каналы, что использует редактор при
// обычном сохранении фона/картинок).
export const persistBackgroundViaIpc: PersistBackground = (quizId, bytes, mimeType) => saveQuizBackground(quizId, bytes.buffer as ArrayBuffer, mimeType);

export const persistItemImageViaIpc: PersistItemImage = (quizId, questionId, kind, bytes, mimeType) =>
  saveQuizItemImage(quizId, questionId, kind, bytes.buffer as ArrayBuffer, mimeType);

export type ImportQuizResult = { ok: true; quiz: RusiqQuiz } | { ok: false; error: string };

// Разбирает файл, полученный buildExportPayload/serializeExportPayload на
// ДРУГОЙ (или той же) машине, обратно в валидный RusiqQuiz со СВЕЖИМ id
// (импорт поверх уже существующей на этой машине викторины с тем же id
// недопустим - id экспортёра мог совпасть случайно или намеренно
// дублироваться) и заново сохранёнными на диске картинками (старые имена
// файлов с диска экспортёра ни для чего не используются, кроме как ключ
// поиска в `images`).
export async function parseAndPersistImportedQuiz(
  rawJson: string,
  persistBackground: PersistBackground,
  persistItemImage: PersistItemImage,
): Promise<ImportQuizResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { ok: false, error: 'Файл повреждён — это не корректный JSON' };
  }
  if (!isPlainRecord(parsed) || parsed.format !== RUSIQ_EXPORT_FORMAT) {
    return { ok: false, error: 'Это не файл экспорта викторины РусIQ' };
  }
  const quizResult = RusiqQuizSchema.safeParse(parsed.quiz);
  if (!quizResult.success) {
    return { ok: false, error: 'Содержимое викторины в файле повреждено или неполно' };
  }
  const images = isPlainRecord(parsed.images) ? parsed.images : {};

  const newQuizId = crypto.randomUUID();

  async function persistImage(
    oldFileName: string | null,
    kind: 'background' | RusiqItemImageKind,
    questionId?: string,
  ): Promise<string | null> {
    if (!oldFileName) return null;
    const img = images[oldFileName];
    if (!isPlainRecord(img) || typeof img.base64 !== 'string' || typeof img.mimeType !== 'string') return null;
    const bytes = base64ToBytes(img.base64);
    if (kind === 'background') {
      const result = await persistBackground(newQuizId, bytes, img.mimeType);
      return result.ok ? (result.fileName ?? null) : null;
    }
    const result = await persistItemImage(newQuizId, questionId as string, kind, bytes, img.mimeType);
    return result.ok ? (result.fileName ?? null) : null;
  }

  const newBackgroundFileName = await persistImage(quizResult.data.image.fileName, 'background');
  if (!newBackgroundFileName) {
    return { ok: false, error: 'Не удалось восстановить фоновое изображение из файла' };
  }

  const newQuestions: RusiqQuestion[] = [];
  for (const q of quizResult.data.questions) {
    newQuestions.push({
      ...q,
      questionImage: await persistImage(q.questionImage, 'question', q.id),
      answerImage: await persistImage(q.answerImage, 'answer', q.id),
      hintImage: await persistImage(q.hintImage, 'hint', q.id),
    });
  }

  const quiz: RusiqQuiz = {
    ...quizResult.data,
    id: newQuizId,
    image: { ...quizResult.data.image, fileName: newBackgroundFileName },
    questions: newQuestions,
  };

  return { ok: true, quiz };
}
