// packages/server/src/routes/admin.routes.ts

import { Router } from 'express';
import { AdminController } from '../controllers/AdminController';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateAdmin } from '../middleware/auth';
import { validateWith } from '../middleware/validateRequest';
import {
  loginValidators,
  createLicenseValidators,
  updateLicenseValidators,
  getLicensesValidators,
  getDevicesValidators,
  uuidParamValidators,
  getAuditLogsValidators
} from '../validators/admin.validators';

const router = Router();

/**
 * POST /api/admin/login
 * Вход админа (не требует аутентификации)
 */
router.post(
  '/login',
  validateWith(loginValidators),
  asyncHandler(AdminController.login)
);

// Все остальные роуты требуют аутентификации
router.use(authenticateAdmin);

/**
 * Licenses
 */
router.get(
  '/licenses',
  validateWith(getLicensesValidators),
  asyncHandler(AdminController.getLicenses)
);

router.post(
  '/licenses',
  validateWith(createLicenseValidators),
  asyncHandler(AdminController.createLicense)
);

router.get(
  '/licenses/:id',
  validateWith(uuidParamValidators),
  asyncHandler(AdminController.getLicenseDetails)
);

router.patch(
  '/licenses/:id',
  validateWith(updateLicenseValidators),
  asyncHandler(AdminController.updateLicense)
);

/**
 * Devices
 */
router.get(
  '/devices',
  validateWith(getDevicesValidators),
  asyncHandler(AdminController.getDevices)
);

router.delete(
  '/devices/:id',
  validateWith(uuidParamValidators),
  asyncHandler(AdminController.deleteDevice)
);

/**
 * Statistics
 */
router.get(
  '/stats',
  asyncHandler(AdminController.getStats)
);

/**
 * Audit Logs
 */
router.get(
  '/audit',
  validateWith(getAuditLogsValidators),
  asyncHandler(AdminController.getAuditLogs)
);

export default router;
