// packages/server/src/routes/admin.routes.ts

import { Router } from 'express';
import { AdminController } from '../controllers/AdminController';
import { ProjectGrantController } from '../controllers/ProjectGrantController';
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
  getAuditLogsValidators,
  createGrantValidators,
  revokeGrantValidators
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
  '/devices/online',
  asyncHandler(AdminController.getOnlineDevices)
);

router.get(
  '/devices/online',
  asyncHandler(AdminController.getOnlineDevices)
);

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

router.post('/licenses/:id/users', asyncHandler(AdminController.addLicenseUser));

/**
 * Projects / ProjectGrant (шаринг проекта между лицензиями без копирования)
 */
router.get(
  '/projects',
  asyncHandler(ProjectGrantController.listProjects)
);

router.post(
  '/projects/:projectId/grants',
  validateWith(createGrantValidators),
  asyncHandler(ProjectGrantController.createGrant)
);

router.delete(
  '/projects/:projectId/grants/:licenseId',
  validateWith(revokeGrantValidators),
  asyncHandler(ProjectGrantController.revokeGrant)
);

// Создание клиента с временным паролем
router.post(
  '/invite',
  asyncHandler(AdminController.invite)
);

export default router;
