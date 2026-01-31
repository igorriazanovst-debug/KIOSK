// packages/server/src/routes/license.routes.ts

import { Router } from 'express';
import { LicenseController } from '../controllers/LicenseController';
import { asyncHandler } from '../middleware/errorHandler';
import { validateWith } from '../middleware/validateRequest';
import {
  activateValidators,
  refreshValidators,
  validateValidators,
  deactivateValidators
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

export default router;
