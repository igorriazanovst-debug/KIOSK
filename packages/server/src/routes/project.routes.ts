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
  limits: { fileSize: 600 * 1024 * 1024 } // 600 MB
});

// Middleware добавлен индивидуально к каждому роуту
// (вместо глобального router.use(authenticateClient))

router.get('/', authenticateClient, ProjectController.listProjects);
router.post('/', authenticateClient, ProjectController.createProject);
router.get('/:id', authenticateClient, ProjectController.getProject);
router.put('/:id', authenticateClient, ProjectController.updateProject);
router.delete('/:id', authenticateClient, ProjectController.deleteProject);

router.get('/:projectId/files', authenticateClient, FileController.listFiles);

router.post(
  '/:projectId/files',
  authenticateClient,
  upload.single('file'),
  checkStorageLimit,
  logStorageUsage,
  FileController.uploadFile
);

// ПУБЛИЧНЫЙ маршрут - БЕЗ authenticateClient для <video> элементов
router.get('/:projectId/files/:fileId', FileController.downloadFile);

router.delete('/:projectId/files/:fileId', authenticateClient, FileController.deleteFile);

export default router;
