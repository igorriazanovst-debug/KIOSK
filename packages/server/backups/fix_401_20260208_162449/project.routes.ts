// packages/server/src/routes/project.routes.ts
import { Router } from 'express';
import { ProjectController } from '../controllers/ProjectController';
import { FileController } from '../controllers/FileController';
import { authenticateClient } from '../middleware/authClient';
import { checkStorageLimit, logStorageUsage } from '../middleware/storageLimit';
import multer from 'multer';

const router = Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 600 * 1024 * 1024 } // 600 MB (было 100 MB)
});

// ============================================================================
// ВАЖНО: НЕ используем router.use(authenticateClient) глобально!
// Вместо этого добавляем middleware к каждому маршруту отдельно.
// Это позволяет сделать GET /files/:fileId публичным для <video> элементов.
// ============================================================================

/**
 * GET /api/projects
 * Список проектов (требует токен)
 */
router.get('/', authenticateClient, ProjectController.listProjects);

/**
 * POST /api/projects
 * Создать проект (требует токен)
 */
router.post('/', authenticateClient, ProjectController.createProject);

/**
 * GET /api/projects/:id
 * Получить проект (требует токен)
 */
router.get('/:id', authenticateClient, ProjectController.getProject);

/**
 * PUT /api/projects/:id
 * Обновить проект (требует токен)
 */
router.put('/:id', authenticateClient, ProjectController.updateProject);

/**
 * DELETE /api/projects/:id
 * Удалить проект (требует токен)
 */
router.delete('/:id', authenticateClient, ProjectController.deleteProject);

/**
 * GET /api/projects/:projectId/files
 * Список файлов проекта (требует токен)
 */
router.get('/:projectId/files', authenticateClient, FileController.listFiles);

/**
 * POST /api/projects/:projectId/files
 * Загрузить файл (требует токен)
 */
router.post(
  '/:projectId/files',
  authenticateClient,
  upload.single('file'),
  checkStorageLimit,
  logStorageUsage,
  FileController.uploadFile
);

/**
 * GET /api/projects/:projectId/files/:fileId
 * Скачать файл (ПУБЛИЧНЫЙ - БЕЗ ТОКЕНА)
 * 
 * Этот маршрут должен быть публичным, потому что:
 * 1. HTML <video> элемент не может передать Authorization header
 * 2. Браузер делает прямой GET запрос на src видео
 * 3. CORS политика не позволяет добавить custom headers
 * 
 * Безопасность: файлы доступны только по UUID, который сложно угадать
 */
router.get('/:projectId/files/:fileId', FileController.downloadFile);

/**
 * DELETE /api/projects/:projectId/files/:fileId
 * Удалить файл (требует токен)
 */
router.delete('/:projectId/files/:fileId', authenticateClient, FileController.deleteFile);

export default router;
