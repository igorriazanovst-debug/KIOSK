// packages/server/src/controllers/LicenseUserController.ts
// Управление клиентскими аккаунтами (LicenseUser) из админ-панели — email,
// пароль, роль. Раньше единственным способом было прямое редактирование БД
// по SSH (см. STATUS.md, "Открытые задачи").

import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { getPrismaClient } from '../config/database';
import { ApiError } from '../middleware/errorHandler';
import { AuditService } from '../services/AuditService';

const BCRYPT_ROUNDS = 10;

// 12 случайных байт (96 бит энтропии) из crypto.randomBytes напрямую в
// base64url — без урезания/дополнения слабым Math.random(), в отличие от
// прежнего генератора (стрипал символы из base64, добивал предсказуемым
// Math.random()-суффиксом фиксированной длины/позиции).
function generateTempPassword(): string {
  return crypto.randomBytes(12).toString('base64url');
}

// true если это единственный OWNER лицензии (значит его нельзя ни понизить,
// ни удалить, не оставив лицензию вообще без владельца).
async function isLastOwner(prisma: ReturnType<typeof getPrismaClient>, licenseId: string, currentRole: string) {
  if (currentRole !== 'OWNER') return false;
  const ownerCount = await prisma.licenseUser.count({ where: { licenseId, role: 'OWNER' } });
  return ownerCount <= 1;
}

export class LicenseUserController {
  /**
   * GET /api/admin/licenses/:id/users
   * Список клиентских аккаунтов лицензии
   */
  static async listForLicense(req: Request, res: Response) {
    const { id: licenseId } = req.params;
    const prisma = getPrismaClient();

    const license = await prisma.license.findUnique({ where: { id: licenseId } });
    if (!license) throw ApiError.notFound('License not found');

    const users = await prisma.licenseUser.findMany({
      where: { licenseId },
      select: { id: true, email: true, role: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: 'asc' }
    });

    res.json({ success: true, data: users });
  }

  /**
   * POST /api/admin/licenses/:id/users
   * Добавить пользователя в лицензию (перенесено из AdminController без
   * изменения поведения — только новое имя файла)
   */
  static async create(req: Request, res: Response) {
    const { id: licenseId } = req.params;
    const { email, role = 'MEMBER' } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'email is required' });
    }

    const prisma = getPrismaClient();

    const license = await prisma.license.findUnique({
      where: { id: licenseId },
      include: { organization: true },
    });

    if (!license) {
      return res.status(404).json({ success: false, error: 'License not found' });
    }

    const existing = await prisma.licenseUser.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ success: false, error: 'User with this email already exists' });
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);

    const user = await prisma.licenseUser.create({
      data: {
        licenseId,
        email,
        passwordHash,
        role: role as any,
      },
    });

    await AuditService.logLicenseUpdated({
      licenseId,
      userId: req.user!.id,
      changes: { createdLicenseUserId: user.id, email },
      ipAddress: req.ip
    });

    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        licenseId,
        tempPassword,
        organizationName: license.organization?.name || '',
      },
    });
  }

  /**
   * PATCH /api/admin/license-users/:id
   * Изменить email/роль, опционально сбросить пароль (новый временный
   * пароль возвращается один раз в ответе — так же, как при создании клиента,
   * админ не может ввести произвольный пароль руками).
   */
  static async update(req: Request, res: Response) {
    const { id } = req.params;
    const { email, role, resetPassword } = req.body;

    const prisma = getPrismaClient();
    const user = await prisma.licenseUser.findUnique({ where: { id } });
    if (!user) throw ApiError.notFound('License user not found');

    if (email && email !== user.email) {
      const emailTaken = await prisma.licenseUser.findUnique({ where: { email } });
      if (emailTaken) {
        return res.status(409).json({ success: false, error: 'Email already in use' });
      }
    }

    if (role && role !== user.role && role !== 'OWNER' && await isLastOwner(prisma, user.licenseId, user.role)) {
      return res.status(409).json({
        success: false,
        error: 'Cannot demote the last OWNER of a license — promote another user first'
      });
    }

    const updateData: any = {};
    if (email) updateData.email = email;
    if (role) updateData.role = role;

    let tempPassword: string | null = null;
    if (resetPassword) {
      tempPassword = generateTempPassword();
      updateData.passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);
    }

    const updated = await prisma.licenseUser.update({
      where: { id },
      data: updateData,
      select: { id: true, email: true, role: true, licenseId: true, updatedAt: true }
    });

    await AuditService.logLicenseUpdated({
      licenseId: user.licenseId,
      userId: req.user!.id,
      changes: { licenseUserId: id, email: !!email, role: role || undefined, passwordReset: !!resetPassword },
      ipAddress: req.ip
    });

    res.json({ success: true, data: { ...updated, tempPassword } });
  }

  /**
   * DELETE /api/admin/license-users/:id
   * Удалить клиентский аккаунт. Блокирует удаление последнего аккаунта
   * лицензии — иначе клиент теряет способ залогиниться вообще.
   */
  static async remove(req: Request, res: Response) {
    const { id } = req.params;
    const prisma = getPrismaClient();

    const user = await prisma.licenseUser.findUnique({ where: { id } });
    if (!user) throw ApiError.notFound('License user not found');

    const totalUsers = await prisma.licenseUser.count({ where: { licenseId: user.licenseId } });
    if (totalUsers <= 1) {
      return res.status(409).json({
        success: false,
        error: 'Cannot delete the last account of a license — the client would be locked out'
      });
    }

    if (await isLastOwner(prisma, user.licenseId, user.role)) {
      return res.status(409).json({
        success: false,
        error: 'Cannot delete the last OWNER of a license — promote another user first'
      });
    }

    await prisma.licenseUser.delete({ where: { id } });

    await AuditService.logLicenseUpdated({
      licenseId: user.licenseId,
      userId: req.user!.id,
      changes: { deletedLicenseUserId: id, email: user.email },
      ipAddress: req.ip
    });

    res.json({ success: true });
  }
}
