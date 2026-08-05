// packages/server/src/controllers/AdminController.ts
// FIXED: Added generateLicenseKey() function for createLicense endpoint

import { Request, Response } from 'express';
import { getPrismaClient } from '../config/database';
import { LicenseService } from '../services/LicenseService';
import { DeviceService } from '../services/DeviceService';
import { AuditService } from '../services/AuditService';
import { ApiError } from '../middleware/errorHandler';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getJWTConfig } from '../config/jwt';
import { deviceSockets } from '../app';

// BigInt serialization helper
function replaceBigInt(_key: string, value: any) {
  return typeof value === 'bigint' ? Number(value) : value;
}



/**
 * Generate a random license key in format: XXXX-XXXX-XXXX-XXXX
 * Uses uppercase letters and numbers (A-Z, 0-9)
 */
function generateLicenseKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const groups = 4;
  const charsPerGroup = 4;
  
  return Array.from({ length: groups }, () =>
    Array.from({ length: charsPerGroup }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('')
  ).join('-');
}

export class AdminController {
  /**
   * POST /api/admin/login
   * Вход админа
   */
  static async login(req: Request, res: Response) {
    const { email, password } = req.body;
    
    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        organization: true
      }
    });
    
    if (!user || user.role !== 'ADMIN') {
      await AuditService.logAdminLogin({
        userId: user?.id || 'unknown',
        email,
        success: false,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
      
      throw ApiError.unauthorized('Invalid credentials');
    }
    
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isPasswordValid) {
      await AuditService.logAdminLogin({
        userId: user.id,
        email,
        success: false,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
      
      throw ApiError.unauthorized('Invalid credentials');
    }
    
    // Создать JWT токен для админа
    const config = getJWTConfig();
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId
      },
      config.privateKey,
      {
        algorithm: config.algorithm,
        expiresIn: '24h'
      }
    );
    
    await AuditService.logAdminLogin({
      userId: user.id,
      email,
      success: true,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        organization: user.organization ? {
          id: user.organization.id,
          name: user.organization.name
        } : null
      }
    });
  }
  
  /**
   * GET /api/admin/licenses
   * Получить список всех лицензий
   */
  static async getLicenses(req: Request, res: Response) {
    const { status, plan, search, page = 1, limit = 20 } = req.query;
    
    const prisma = getPrismaClient();
    const skip = (Number(page) - 1) * Number(limit);
    
    const where: any = {};
    
    if (status) where.status = status;
    if (plan) where.plan = plan;
    if (search) {
      where.OR = [
        { licenseKey: { contains: search as string, mode: 'insensitive' } },
      ];
    }
    
    const [licenses, total] = await Promise.all([
      prisma.license.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          organization: true,
          _count: {
            select: { devices: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.license.count({ where })
    ]);
    
    
    // Конвертируем BigInt в Number для JSON
    const licensesWithNumbers = licenses.map(license => ({
      ...license,
      storageLimit: license.storageLimit ? Number(license.storageLimit) : 524288000
    }));

    res.json({
      success: true,
      data: licensesWithNumbers,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  }
  
  /**
   * POST /api/admin/licenses
   * Создать новую лицензию
   * 
   * FIXED: Added automatic licenseKey generation
   */
  static async createLicense(req: Request, res: Response) {
    const {
      organizationId,
      organizationName,
      plan,
      seatsEditor,
      seatsPlayer,
      validUntil,
    } = req.body;

    const prisma = getPrismaClient();

    // Определяем существующую оргу или создаём новую по имени
    let orgId: string | undefined = organizationId;

    if (orgId) {
      const organization = await prisma.organization.findUnique({ where: { id: orgId } });
      if (!organization) {
        throw ApiError.notFound('Organization not found');
      }
    } else if (organizationName && String(organizationName).trim()) {
      const orgName = String(organizationName).trim();
      const existing = await prisma.organization.findFirst({
        where: { name: { equals: orgName, mode: 'insensitive' } },
      });
      if (existing) {
        orgId = existing.id;
      } else {
        const crypto = require('crypto');
        const orgOwnerId = crypto.randomUUID();
        const newOrgId = crypto.randomUUID();
        const placeholderEmail = `org_${newOrgId}@placeholder.local`;
        await prisma.$transaction(async (tx: any) => {
          await tx.$executeRaw`INSERT INTO users (id, email, "passwordHash", role, "organizationId", "createdAt", "updatedAt") VALUES (${orgOwnerId}, ${placeholderEmail}, ${'placeholder'}, 'USER', NULL, NOW(), NOW())`;
          await tx.$executeRaw`INSERT INTO organizations (id, name, "ownerUserId", "createdAt", "updatedAt") VALUES (${newOrgId}, ${orgName}, ${orgOwnerId}, NOW(), NOW())`;
          await tx.$executeRaw`UPDATE users SET "organizationId" = ${newOrgId} WHERE id = ${orgOwnerId}`;
        });
        orgId = newOrgId;
      }
    } else {
      res.status(400).json({ success: false, error: 'organizationId or organizationName is required' });
      return;
    }

    const licenseKey = generateLicenseKey();

    const { getPlanConfig, Plan } = await import('@kiosk/shared');
    let planEnum: any;
    switch (String(plan).toUpperCase()) {
      case 'BASIC': planEnum = Plan.Basic; break;
      case 'PRO': planEnum = Plan.Pro; break;
      case 'MAX': planEnum = Plan.Max; break;
      default: planEnum = Plan.Basic;
    }
    const planConfig = getPlanConfig(planEnum);

    const license = await LicenseService.createLicense({
      organizationId: orgId!,
      plan,
      licenseKey,
      seatsEditor: seatsEditor || planConfig.seatsEditor,
      seatsPlayer: seatsPlayer || planConfig.seatsPlayer,
      validFrom: new Date(),
      validUntil: new Date(validUntil),
    });

    await AuditService.logLicenseCreated({
      licenseId: license.id,
      userId: req.user!.id,
      details: {
        organizationId: orgId!,
        plan,
        licenseKey,
        seatsEditor: license.seatsEditor,
        seatsPlayer: license.seatsPlayer,
        validUntil,
      },
      ipAddress: req.ip,
    });

    // license.storageLimit — BigInt, см. replaceBigInt ниже по файлу.
    res.status(201).json(JSON.parse(JSON.stringify({ success: true, data: license }, replaceBigInt)));
  }

  /**
   * GET /api/admin/licenses/:id
   * Получить детали лицензии
   */
  static async getLicenseDetails(req: Request, res: Response) {
    const { id } = req.params;
    
    const prisma = getPrismaClient();
    const license = await prisma.license.findUnique({
      where: { id },
      include: {
        organization: true,
        devices: {
          orderBy: { lastSeenAt: 'desc' }
        },
        projects: {
          select: { id: true, name: true, updatedAt: true, licenseId: true }
        },
        projectGrants: {
          where: { revokedAt: null },
          include: {
            project: {
              select: { id: true, name: true, updatedAt: true, licenseId: true }
            }
          }
        }
      }
    });

    if (!license) {
      throw ApiError.notFound('License not found');
    }

    const ownProjects = license.projects.map(p => ({ ...p, accessType: 'own' as const }));
    const grantedProjects = license.projectGrants.map(g => ({
      ...g.project,
      accessType: 'granted' as const,
      grantId: g.id,
      grantedAt: g.grantedAt
    }));

    // license.storageLimit — BigInt (см. schema.prisma), JSON.stringify не
    // умеет его сериализовать напрямую — тот же replaceBigInt, что и в
    // getDevices выше.
    res.json(JSON.parse(JSON.stringify({
      success: true,
      data: {
        ...license,
        availableProjects: [...ownProjects, ...grantedProjects]
      }
    }, replaceBigInt)));
  }

  /**
   * PATCH /api/admin/licenses/:id
   * Обновить лицензию
   */
  static async updateLicense(req: Request, res: Response) {
    const { id } = req.params;
    const { status, validUntil, plan, seatsEditor, seatsPlayer } = req.body;

    const prisma = getPrismaClient();

    // Проверить что лицензия существует
    const existingLicense = await prisma.license.findUnique({
      where: { id }
    });

    if (!existingLicense) {
      throw ApiError.notFound('License not found');
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (validUntil) updateData.validUntil = new Date(validUntil);
    if (plan) updateData.plan = plan;
    if (seatsEditor !== undefined) updateData.seatsEditor = seatsEditor;
    if (seatsPlayer !== undefined) updateData.seatsPlayer = seatsPlayer;

    const license = await prisma.license.update({
      where: { id },
      data: updateData
    });
    
    // Audit log
    await AuditService.logLicenseUpdated({
      licenseId: id,
      userId: req.user!.id,
      changes: updateData,
      ipAddress: req.ip
    });
    
    // license.storageLimit — BigInt, см. replaceBigInt ниже по файлу.
    res.json(JSON.parse(JSON.stringify({
      success: true,
      data: license
    }, replaceBigInt)));
  }

  /**
   * GET /api/admin/devices
   * Получить список всех устройств
   */
  static async getDevices(req: Request, res: Response) {
    const { status, appType, licenseId, search, page = 1, limit = 20 } = req.query;
    
    const prisma = getPrismaClient();
    const skip = (Number(page) - 1) * Number(limit);
    
    const where: any = {};
    
    if (status) where.status = status;
    if (appType) where.appType = appType;
    if (licenseId) where.licenseId = licenseId;
    if (search) {
      where.OR = [
        { deviceId: { contains: search as string, mode: 'insensitive' } },
        { deviceName: { contains: search as string, mode: 'insensitive' } }
      ];
    }
    
    const [devices, total] = await Promise.all([
      prisma.device.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          license: {
            include: {
              organization: true
            }
          }
        },
        orderBy: { lastSeenAt: 'desc' }
      }),
      prisma.device.count({ where })
    ]);
    
    res.json(JSON.parse(JSON.stringify({
      success: true,
      data: devices,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }, replaceBigInt)));
  }
  
  
  /**
   * DELETE /api/admin/devices/:id
   * Удалить (деактивировать) устройство
   */
  static async deleteDevice(req: Request, res: Response) {
    const { id } = req.params;
    
    const prisma = getPrismaClient();
    const device = await prisma.device.findUnique({
      where: { id }
    });
    
    if (!device) {
      throw ApiError.notFound('Device not found');
    }
    
    await DeviceService.deactivateDevice(device.deviceId);
    
    // Если устройство онлайн — отправить device:shutdown по WS
    try {
      const { getDeviceSockets } = await import('../app');
      const sockets = getDeviceSockets();
      const ws = sockets.get(device.deviceId);
      if (ws && ws.readyState === 1 /* OPEN */) {
        ws.send(JSON.stringify({ type: 'device:shutdown', reason: 'Deactivated by admin' }));
        console.log('[Admin] Sent device:shutdown to', device.deviceId);
      }
    } catch (err: any) {
      console.warn('[Admin] Could not send WS shutdown:', err.message);
    }
    
    await AuditService.logDeactivation({
      deviceId: device.id,
      licenseId: device.licenseId,
      userId: req.user!.id,
      ipAddress: req.ip
    });
    
    res.json({
      success: true,
      message: 'Device deactivated successfully'
    });
  }
  
  /**
   * GET /api/admin/stats
   * Получить статистику системы
   */
  static async getStats(req: Request, res: Response) {
    const prisma = getPrismaClient();
    
    const [
      totalLicenses,
      activeLicenses,
      expiredLicenses,
      totalDevices,
      activeDevices,
      editorDevices,
      playerDevices
    ] = await Promise.all([
      prisma.license.count(),
      prisma.license.count({ where: { status: 'ACTIVE' } }),
      prisma.license.count({ 
        where: { 
          validUntil: { lt: new Date() },
          status: 'ACTIVE'
        } 
      }),
      prisma.device.count(),
      prisma.device.count({ where: { status: 'ACTIVE' } }),
      prisma.device.count({ where: { appType: 'EDITOR' } }),
      prisma.device.count({ where: { appType: 'PLAYER' } })
    ]);
    
    res.json({
      success: true,
      data: {
        licenses: {
          total: totalLicenses,
          active: activeLicenses,
          expired: expiredLicenses
        },
        devices: {
          total: totalDevices,
          active: activeDevices,
          editor: editorDevices,
          player: playerDevices
        }
      }
    });
  }
  
  /**
   * GET /api/admin/audit-logs
   * Получить логи аудита
   */
  static async getAuditLogs(req: Request, res: Response) {
    const { action, userId, deviceId, page = 1, limit = 50 } = req.query;
    
    const prisma = getPrismaClient();
    const skip = (Number(page) - 1) * Number(limit);
    
    const where: any = {};
    
    if (action) where.action = action;
    if (userId) where.userId = userId;
    if (deviceId) where.deviceId = deviceId;
    
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.auditLog.count({ where })
    ]);
    
    res.json({
      success: true,
      data: logs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  }
  /**
   * POST /api/admin/invite
   * Создать клиента: Organization + License + LicenseUser(OWNER)
   * Возвращает временный пароль
   */
  static async invite(req: Request, res: Response) {
    const { email, plan, organizationName, validUntil } = req.body;

    if (!email || !plan || !organizationName) {
      throw ApiError.badRequest('email, plan, organizationName required');
    }

    const prisma = getPrismaClient();
    const bcrypt = await import('bcrypt');

    // Проверяем уникальность email
    const existing = await prisma.licenseUser.findUnique({ where: { email } });
    if (existing) throw ApiError.conflict('Email already registered');

    // Лимиты seats по плану
    const SEATS: Record<string, { editor: number; player: number; storage: bigint }> = {
      BASIC: { editor: 2, player: 1,  storage: BigInt(524288000) },
      PRO:   { editor: 4, player: 10, storage: BigInt(2147483648) },
      MAX:   { editor: 8, player: 25, storage: BigInt(10737418240) },
    };
    const planUpper = plan.toUpperCase() as 'BASIC' | 'PRO' | 'MAX';
    const seats = SEATS[planUpper] || SEATS.BASIC;

    // Генерируем licenseKey
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const licenseKey = Array.from({ length: 4 }, () =>
      Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    ).join('-');

    // Генерируем временный пароль
    const tempPassword = Array.from({ length: 12 }, () =>
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#'
        .charAt(Math.floor(Math.random() * 58))
    ).join('');

    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const validUntilDate = validUntil ? new Date(validUntil) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    // Создаём Organization + License + LicenseUser в транзакции
    const result = await prisma.$transaction(async (tx) => {
      // Создаём временного User-владельца организации
      const orgOwnerId = require('crypto').randomUUID();
      const orgId = require('crypto').randomUUID();

      await tx.$executeRaw`
        INSERT INTO users (id, email, "passwordHash", role, "organizationId", "createdAt", "updatedAt")
        VALUES (${orgOwnerId}, ${email + '_org'}, ${'placeholder'}, 'USER', NULL, NOW(), NOW())
      `;

      await tx.$executeRaw`
        INSERT INTO organizations (id, name, "ownerUserId", "createdAt", "updatedAt")
        VALUES (${orgId}, ${organizationName}, ${orgOwnerId}, NOW(), NOW())
      `;

      await tx.$executeRaw`
        UPDATE users SET "organizationId" = ${orgId} WHERE id = ${orgOwnerId}
      `;

      const license = await tx.license.create({
        data: {
          licenseKey,
          organizationId: orgId!,
          plan: planUpper,
          status: 'ACTIVE',
          seatsEditor: seats.editor,
          seatsPlayer: seats.player,
          storageLimit: seats.storage,
          validFrom: new Date(),
          validUntil: validUntilDate,
        },
      });

      const licenseUser = await tx.licenseUser.create({
        data: {
          licenseId: license.id,
          email,
          passwordHash,
          role: 'OWNER',
        },
      });

      return { license, licenseUser, orgId };
    });

    return res.status(201).json({
      success: true,
      data: {
        email,
        tempPassword,
        organizationName,
        plan: planUpper,
        licenseKey: result.license.licenseKey,
        licenseId: result.license.id,
        organizationId: result.orgId,
        validUntil: validUntilDate,
      },
    });
  }

  /**
   * POST /api/admin/users/reset-password
   * Сброс пароля пользователю по email (licenseUser или user).
   * TODO(security): newPassword сейчас принимается от админа как есть при
   * длине >= 6 без проверки сложности — известный риск, решение отложено
   * (см. STATUS.md), пока не трогаем.
   */
  static async resetUserPassword(req: Request, res: Response) {
    const { email, newPassword } = req.body;
    if (!email || !String(email).trim()) {
      return res.status(400).json({ success: false, error: 'email is required' });
    }
    const targetEmail = String(email).trim();

    const tempPassword = (newPassword && String(newPassword).length >= 6)
      ? String(newPassword)
      : Array.from({ length: 12 }, () =>
          'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#'
            .charAt(Math.floor(Math.random() * 58))
        ).join('');

    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const prisma = getPrismaClient();

    const lu = await prisma.licenseUser.findUnique({ where: { email: targetEmail } });
    if (lu) {
      await prisma.licenseUser.update({ where: { email: targetEmail }, data: { passwordHash } });
      return res.json({ success: true, data: { email: targetEmail, tempPassword, account: 'licenseUser', role: lu.role } });
    }

    const u = await prisma.user.findUnique({ where: { email: targetEmail } });
    if (u) {
      await prisma.user.update({ where: { email: targetEmail }, data: { passwordHash } });
      return res.json({ success: true, data: { email: targetEmail, tempPassword, account: 'user', role: u.role } });
    }

    return res.status(404).json({ success: false, error: 'User not found' });
  }

  /**
   * GET /api/admin/organizations
   * Список организаций
   */
  static async listOrganizations(req: Request, res: Response) {
    const prisma = getPrismaClient();
    const orgs = await prisma.organization.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return res.json({ success: true, data: orgs });
  }

  /**
   * GET /api/admin/organizations/:id/users
   * Пользователи организации (licenseUser + user, без placeholder-владельцев)
   */
  static async listOrganizationUsers(req: Request, res: Response) {
    const { id } = req.params;
    const prisma = getPrismaClient();

    const licenses = await prisma.license.findMany({
      where: { organizationId: id },
      select: { id: true, licenseKey: true },
    });
    const licenseIds = licenses.map((l) => l.id);
    const keyById: Record<string, string> = {};
    licenses.forEach((l) => { keyById[l.id] = l.licenseKey; });

    const licenseUsers = licenseIds.length
      ? await prisma.licenseUser.findMany({
          where: { licenseId: { in: licenseIds } },
          select: { email: true, role: true, licenseId: true },
        })
      : [];

    const orgUsers = await prisma.user.findMany({
      where: { organizationId: id, passwordHash: { not: 'placeholder' } },
      select: { email: true, role: true },
    });

    const seen = new Set<string>();
    const users: any[] = [];
    licenseUsers.forEach((u) => {
      if (seen.has(u.email)) return;
      seen.add(u.email);
      users.push({ email: u.email, role: u.role, type: 'licenseUser', licenseKey: keyById[u.licenseId] || null });
    });
    orgUsers.forEach((u) => {
      if (seen.has(u.email)) return;
      seen.add(u.email);
      users.push({ email: u.email, role: u.role, type: 'user', licenseKey: null });
    });

    users.sort((a, b) => a.email.localeCompare(b.email));
    return res.json({ success: true, data: users });
  }

  /**
   * GET /api/admin/devices/online
   * Устройства онлайн прямо сейчас (WS подключены или lastSeenAt < 3 мин)
   */
  static async getOnlineDevices(req: Request, res: Response) {
    const prisma = getPrismaClient();
    const since3min = new Date(Date.now() - 3 * 60 * 1000);

    const devices = await prisma.device.findMany({
      where: {
        status: 'ACTIVE',
        lastSeenAt: { gte: since3min }
      },
      include: {
        license: {
          include: { organization: true }
        },
        project: {
          select: { id: true, name: true }
        }
      },
      orderBy: { lastSeenAt: 'desc' }
    });

    // Добавляем IP из WS map и флаг ws-онлайн
    let sockets: Map<string, any> | null = null;
    let ipMap: Map<string, string> | null = null;
    try {
      const appModule = await import('../app');
      sockets = appModule.getDeviceSockets();
      ipMap = appModule.getDeviceIpMap();
    } catch {}

    const mapped = devices.map(d => ({
      ...JSON.parse(JSON.stringify(d, (_, v) => typeof v === 'bigint' ? v.toString() : v)),
      wsOnline: sockets ? sockets.has(d.deviceId) : false,
      ipAddress: (() => {
        // Сначала из WS map
        const wsIp = ipMap ? ipMap.get(d.deviceId) : null;
        if (wsIp) return wsIp;
        // Fallback: читаем из osInfo
        try {
          const os = typeof d.osInfo === 'string' ? JSON.parse(d.osInfo) : d.osInfo;
          if (os?.ipAddress && os.ipAddress !== 'unknown') return os.ipAddress;
        } catch {}
        return null;
      })(),
    }));

    // Для редакторов: дедупликация по licenseId+ipAddress — оставляем только свежайший
    const result: typeof mapped = [];
    const editorSeen = new Map<string, boolean>();
    for (const d of mapped) {
      if (d.appType === 'EDITOR') {
        const key = `${d.licenseId}::${d.ipAddress || d.deviceId}`;
        if (!editorSeen.has(key)) {
          editorSeen.set(key, true);
          result.push(d);
        }
      } else {
        result.push(d);
      }
    }

    res.json({
      success: true,
      data: result,
      total: result.length
    });
  }

}
