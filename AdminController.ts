// packages/server/src/controllers/AdminController.ts

import { Request, Response } from 'express';
import { getPrismaClient } from '../config/database';
import { LicenseService } from '../services/LicenseService';
import { DeviceService } from '../services/DeviceService';
import { AuditService } from '../services/AuditService';
import { ApiError } from '../middleware/errorHandler';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getJWTConfig } from '../config/jwt';

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
        { organization: { name: { contains: search as string, mode: 'insensitive' } } }
      ];
    }
    
    const [licenses, total] = await Promise.all([
      prisma.license.findMany({
        where,
        include: {
          organization: {
            select: {
              id: true,
              name: true
            }
          },
          _count: {
            select: {
              devices: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip
      }),
      prisma.license.count({ where })
    ]);
    
    res.json({
      success: true,
      data: licenses,
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
   */
  static async createLicense(req: Request, res: Response) {
    const { organizationId, plan, validUntil, seatsEditor, seatsPlayer } = req.body;
    
    const prisma = getPrismaClient();
    
    // Проверить что организация существует
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId }
    });
    
    if (!organization) {
      throw ApiError.notFound('Organization not found');
    }
    
    // Получить дефолтные значения seats из константы плана если не указаны
    const { getPlanConfig, Plan } = await import('@kiosk/shared');
    
    // Конвертируем строку плана в enum
    let planEnum: any;
    switch(plan.toUpperCase()) {
      case 'BASIC':
        planEnum = Plan.Basic;
        break;
      case 'PRO':
        planEnum = Plan.Pro;
        break;
      case 'MAX':
        planEnum = Plan.Max;
        break;
      default:
        planEnum = Plan.Basic;
    }
    
    const planConfig = getPlanConfig(planEnum);
    
    // Создать лицензию
    const license = await LicenseService.createLicense({
      organizationId,
      plan,
      seatsEditor: seatsEditor || planConfig.seatsEditor,
      seatsPlayer: seatsPlayer || planConfig.seatsPlayer,
      validFrom: new Date(),
      validUntil: new Date(validUntil)
    });
    
    // Audit log
    await AuditService.logLicenseCreated({
      licenseId: license.id,
      userId: req.user!.id,
      details: {
        organizationId,
        plan,
        seatsEditor: license.seatsEditor,
        seatsPlayer: license.seatsPlayer,
        validUntil
      },
      ipAddress: req.ip
    });
    
    res.status(201).json({
      success: true,
      data: license
    });
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
        }
      }
    });
    
    if (!license) {
      throw ApiError.notFound('License not found');
    }
    
    res.json({
      success: true,
      data: license
    });
  }
  
  /**
   * PATCH /api/admin/licenses/:id
   * Обновить лицензию
   */
  static async updateLicense(req: Request, res: Response) {
    const { id } = req.params;
    const { status, validUntil, plan } = req.body;
    
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
    
    res.json({
      success: true,
      data: license
    });
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
        include: {
          license: {
            include: {
              organization: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        },
        orderBy: { lastSeenAt: 'desc' },
        take: Number(limit),
        skip
      }),
      prisma.device.count({ where })
    ]);
    
    res.json({
      success: true,
      data: devices,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
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
    
    await AuditService.logDeactivation({
      deviceId: device.deviceId,
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
      playerDevices,
      recentActivations
    ] = await Promise.all([
      prisma.license.count(),
      prisma.license.count({ where: { status: 'ACTIVE' } }),
      prisma.license.count({
        where: {
          status: 'ACTIVE',
          validUntil: { lt: new Date() }
        }
      }),
      prisma.device.count(),
      prisma.device.count({ where: { status: 'ACTIVE' } }),
      prisma.device.count({ where: { appType: 'EDITOR', status: 'ACTIVE' } }),
      prisma.device.count({ where: { appType: 'PLAYER', status: 'ACTIVE' } }),
      prisma.device.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        }
      })
    ]);
    
    // Статистика по планам
    const licensesByPlan = await prisma.license.groupBy({
      by: ['plan'],
      where: { status: 'ACTIVE' },
      _count: true
    });
    
    res.json({
      success: true,
      data: {
        licenses: {
          total: totalLicenses,
          active: activeLicenses,
          expired: expiredLicenses,
          byPlan: licensesByPlan.map(item => ({
            plan: item.plan,
            count: item._count
          }))
        },
        devices: {
          total: totalDevices,
          active: activeDevices,
          editors: editorDevices,
          players: playerDevices,
          recentActivations
        }
      }
    });
  }
  
  /**
   * GET /api/admin/audit
   * Получить audit logs
   */
  static async getAuditLogs(req: Request, res: Response) {
    const { action, userId, licenseId, deviceId, limit = 100, offset = 0 } = req.query;
    
    const logs = await AuditService.getLogs({
      action: action as string,
      userId: userId as string,
      licenseId: licenseId as string,
      deviceId: deviceId as string,
      limit: Number(limit),
      offset: Number(offset)
    });
    
    res.json({
      success: true,
      data: logs
    });
  }
}
