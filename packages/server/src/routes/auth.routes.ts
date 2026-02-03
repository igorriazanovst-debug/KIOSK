// packages/server/src/routes/auth.routes.ts
import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { authenticateClient } from '../middleware/authClient';

const router = Router();

/**
 * POST /api/auth/license
 * Вход по ключу лицензии
 */
router.post('/license', AuthController.loginWithLicense);

/**
 * POST /api/auth/refresh
 * Обновить токен
 */
router.post('/refresh', authenticateClient, AuthController.refreshToken);

/**
 * GET /api/auth/verify
 * Проверить валидность токена
 */
router.get('/verify', authenticateClient, AuthController.verifyToken);

export default router;
