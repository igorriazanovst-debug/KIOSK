// packages/editor-web/src/utils/navigation/fileUrl.ts
// Хелпер для построения URL ProjectFile в рантайме.
// Правило №7: никаких хардкодов URL — строится из projectId + fileId.

/**
 * URL для скачивания файла проекта.
 * Использует относительный путь, который nginx проксирует на бэкенд.
 */
export function buildFileUrl(projectId: string, fileId: string): string {
  if (!projectId || !fileId) return '';
  return `/api/projects/${projectId}/files/${fileId}`;
}
