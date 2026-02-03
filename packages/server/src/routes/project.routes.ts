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
  limits: { fileSize: 100 * 1024 * 1024 } // 100 MB
});

// Все роуты требуют аутентификации
router.use(authenticateClient);

/**
 * GET /api/projects
 * Список проектов
 */
router.get('/', ProjectController.listProjects);

/**
 * POST /api/projects
 * Создать проект
 */
router.post('/', ProjectController.createProject);

/**
 * GET /api/projects/:id
 * Получить проект
 */
router.get('/:id', ProjectController.getProject);

/**
 * PUT /api/projects/:id
 * Обновить проект
 */
router.put('/:id', ProjectController.updateProject);

/**
 * DELETE /api/projects/:id
 * Удалить проект
 */
router.delete('/:id', ProjectController.deleteProject);

/**
 * GET /api/projects/:projectId/files
 * Список файлов проекта
 */
router.get('/:projectId/files', FileController.listFiles);

/**
 * POST /api/projects/:projectId/files
 * Загрузить файл
 */
router.post(
  '/:projectId/files',
  upload.single('file'),
  checkStorageLimit,
  logStorageUsage,
  FileController.uploadFile
);

/**
 * GET /api/projects/:projectId/files/:fileId
 * Скачать файл
 */
router.get('/:projectId/files/:fileId', FileController.downloadFile);

/**
 * DELETE /api/projects/:projectId/files/:fileId
 * Удалить файл
 */
router.delete('/:projectId/files/:fileId', FileController.deleteFile);

export default router;
