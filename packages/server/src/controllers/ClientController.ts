// src/controllers/ClientController.ts
import { Request, Response } from 'express';
import { getPrismaClient } from '../config/database';
import { ApiError } from '../middleware/errorHandler';
import { getJWTConfig } from '../config/jwt';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Лимиты sub-users по плану
const SUBUSER_LIMITS: Record<string, number> = {
  BASIC: 2,
  PRO: 4,
  MAX: 6,
};

export class ClientController {
  /**
   * POST /api/client/login
   * Вход клиента (OWNER или MEMBER) по email + password
   */
  static async login(req: Request, res: Response) {
    const { email, password } = req.body;

    if (!email || !password) {
      throw ApiError.badRequest('email and password required');
    }

    const prisma = getPrismaClient();
    const user = await prisma.licenseUser.findUnique({
      where: { email },
      include: {
        license: {
          include: { organization: true },
        },
      },
    });

    if (!user) {
      throw ApiError.unauthorized('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw ApiError.unauthorized('Invalid credentials');
    }

    // Проверяем что лицензия активна
    if (user.license.status !== 'ACTIVE') {
      throw ApiError.forbidden('License is not active');
    }

    const config = getJWTConfig();
    const token = jwt.sign(
      {
        licenseUserId: user.id,
        licenseId: user.licenseId,
        email: user.email,
        role: user.role,
        type: 'license_user',
      },
      config.privateKey,
      { algorithm: config.algorithm, expiresIn: '7d' }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      license: {
        id: user.license.id,
        plan: user.license.plan,
        organizationName: user.license.organization.name,
        validUntil: user.license.validUntil,
        seatsEditor: user.license.seatsEditor,
        seatsPlayer: user.license.seatsPlayer,
      },
    });
  }

  /**
   * GET /api/client/dashboard
   * Данные личного кабинета
   */
  static async dashboard(req: Request, res: Response) {
    const { licenseId } = req.licenseUser!;
    const prisma = getPrismaClient();

    const license = await prisma.license.findUnique({
      where: { id: licenseId },
      include: {
        organization: true,
        devices: {
          where: { status: 'ACTIVE' },
          orderBy: { lastSeenAt: 'desc' },
        },
        licenseUsers: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, email: true, role: true, createdAt: true },
        },
      },
    });

    if (!license) throw ApiError.notFound('License not found');

    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    const devicesWithStatus = license.devices.map((d) => ({
      id: d.id,
      deviceId: d.deviceId,
      deviceName: d.deviceName,
      appType: d.appType,
      osInfo: d.osInfo,
      lastSeenAt: d.lastSeenAt,
      online: d.lastSeenAt > fiveMinutesAgo,
    }));

    const subUserLimit = SUBUSER_LIMITS[license.plan] ?? 2;

    return res.json({
      success: true,
      data: {
        license: {
          id: license.id,
          plan: license.plan,
          status: license.status,
          organizationName: license.organization.name,
          validFrom: license.validFrom,
          validUntil: license.validUntil,
          seatsEditor: license.seatsEditor,
          seatsPlayer: license.seatsPlayer,
        },
        devices: devicesWithStatus,
        users: license.licenseUsers,
        limits: {
          subUsers: subUserLimit,
          currentSubUsers: license.licenseUsers.filter((u) => u.role === 'MEMBER').length,
          seatsEditor: license.seatsEditor,
          seatsPlayer: license.seatsPlayer,
          activeEditors: devicesWithStatus.filter((d) => d.appType === 'EDITOR').length,
          activePlayers: devicesWithStatus.filter((d) => d.appType === 'PLAYER').length,
        },
      },
    });
  }

  /**
   * GET /api/client/users
   * Список sub-users (только OWNER)
   */
  static async listUsers(req: Request, res: Response) {
    const { licenseId } = req.licenseUser!;
    const prisma = getPrismaClient();

    const users = await prisma.licenseUser.findMany({
      where: { licenseId, role: 'MEMBER' },
      select: { id: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    return res.json({ success: true, data: users });
  }

  /**
   * POST /api/client/users
   * Создать sub-user (только OWNER)
   */
  static async createUser(req: Request, res: Response) {
    const { licenseId } = req.licenseUser!;
    const { email, password } = req.body;

    if (!email || !password) {
      throw ApiError.badRequest('email and password required');
    }

    const prisma = getPrismaClient();

    // Проверяем лицензию и лимит
    const license = await prisma.license.findUnique({ where: { id: licenseId } });
    if (!license) throw ApiError.notFound('License not found');

    const subUserLimit = SUBUSER_LIMITS[license.plan] ?? 2;
    const currentCount = await prisma.licenseUser.count({
      where: { licenseId, role: 'MEMBER' },
    });

    if (currentCount >= subUserLimit) {
      throw ApiError.forbidden(
        `Sub-user limit reached: ${currentCount}/${subUserLimit} for ${license.plan} plan`
      );
    }

    // Проверяем уникальность email
    const existing = await prisma.licenseUser.findUnique({ where: { email } });
    if (existing) throw ApiError.conflict('Email already registered');

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.licenseUser.create({
      data: { licenseId, email, passwordHash, role: 'MEMBER' },
      select: { id: true, email: true, role: true, createdAt: true },
    });

    return res.status(201).json({ success: true, data: user });
  }

  /**
   * DELETE /api/client/users/:id
   * Удалить sub-user (только OWNER)
   */
  static async deleteUser(req: Request, res: Response) {
    const { licenseId } = req.licenseUser!;
    const { id } = req.params;

    const prisma = getPrismaClient();
    const user = await prisma.licenseUser.findUnique({ where: { id } });

    if (!user || user.licenseId !== licenseId) {
      throw ApiError.notFound('User not found');
    }

    if (user.role === 'OWNER') {
      throw ApiError.forbidden('Cannot delete OWNER');
    }

    await prisma.licenseUser.delete({ where: { id } });
    return res.json({ success: true, message: 'User deleted' });
  }
}
