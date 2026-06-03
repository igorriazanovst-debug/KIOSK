// packages/server/src/routes/license.routes.ts

import { Router } from 'express';
import { LicenseController } from '../controllers/LicenseController';
import { authenticatePlayer } from '../middleware/authClient';
import { asyncHandler } from '../middleware/errorHandler';
import { validateWith } from '../middleware/validateRequest';
import {
  activateValidators,
  refreshValidators,
  validateValidators,
  deactivateValidators,
  activatePlayerValidators,
  verifyUpdatePasswordValidators
} from '../validators/license.validators';

const router = Router();

/**
 * POST /api/license/activate
 * Активировать устройство с license key
 */
router.post(
  '/activate',
  validateWith(activateValidators),
  asyncHandler(LicenseController.activate)
);

/**
 * POST /api/license/refresh
 * Обновить токен устройства
 */
router.post(
  '/refresh',
  validateWith(refreshValidators),
  asyncHandler(LicenseController.refresh)
);

/**
 * POST /api/license/validate
 * Проверить валидность токена
 */
router.post(
  '/validate',
  validateWith(validateValidators),
  asyncHandler(LicenseController.validate)
);

/**
 * POST /api/license/deactivate
 * Деактивировать устройство
 */
router.post(
  '/deactivate',
  validateWith(deactivateValidators),
  asyncHandler(LicenseController.deactivate)
);

/**
 * POST /api/license/activate-player
 * Активация плеера по SHA256-хэшу licenseKey (без передачи открытого ключа)
 */
router.post(
  '/activate-player',
  validateWith(activatePlayerValidators),
  asyncHandler(LicenseController.activateByCredentials)
);

/**
 * POST /api/license/verify-update-password
 * Проверка пароля для подтверждения обновления контента на плеере
 */
router.post(
  '/verify-update-password',
  authenticatePlayer,
  validateWith(verifyUpdatePasswordValidators),
  asyncHandler(LicenseController.verifyUpdatePassword)
);

export default router;
