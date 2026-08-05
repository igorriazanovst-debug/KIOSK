// packages/server/src/routes/admin.routes.ts

import { Router } from 'express';
import { AdminController } from '../controllers/AdminController';
import { ProjectGrantController } from '../controllers/ProjectGrantController';
import { LicenseUserController } from '../controllers/LicenseUserController';
import { DeviceReassignController } from '../controllers/DeviceReassignController';
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
  revokeGrantValidators,
  createLicenseUserValidators,
  updateLicenseUserValidators,
  licenseUserIdParamValidators,
  reassignDeviceValidators
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
  '/devices',
  validateWith(getDevicesValidators),
  asyncHandler(AdminController.getDevices)
);

router.delete(
  '/devices/:id',
  validateWith(uuidParamValidators),
  asyncHandler(AdminController.deleteDevice)
);

router.post(
  '/devices/:id/reassign',
  validateWith(reassignDeviceValidators),
  asyncHandler(DeviceReassignController.reassign)
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

/**
 * License users (клиентские аккаунты — email/пароль/роль)
 */
router.get(
  '/licenses/:id/users',
  validateWith(uuidParamValidators),
  asyncHandler(LicenseUserController.listForLicense)
);

router.post(
  '/licenses/:id/users',
  validateWith(createLicenseUserValidators),
  asyncHandler(LicenseUserController.create)
);

router.patch(
  '/license-users/:id',
  validateWith(updateLicenseUserValidators),
  asyncHandler(LicenseUserController.update)
);

router.delete(
  '/license-users/:id',
  validateWith(licenseUserIdParamValidators),
  asyncHandler(LicenseUserController.remove)
);

// Сброс пароля LicenseUser или платформенного User по email (прод-хотфикс
// 2026-07-21, см. коммит f7c5c13) — отдельная, более старая ручка, не
// связанная с LicenseUserController.update({resetPassword:true}) выше:
// та требует уже известный licenseUserId и всегда генерирует пароль сама,
// эта принимает произвольный email и (пока) допускает ввод пароля руками.
router.post(
  '/users/reset-password',
  asyncHandler(AdminController.resetUserPassword)
);

router.get(
  '/organizations',
  asyncHandler(AdminController.listOrganizations)
);

router.get(
  '/organizations/:id/users',
  asyncHandler(AdminController.listOrganizationUsers)
);

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
