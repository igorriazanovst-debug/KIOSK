// packages/server/src/services/AuditService.ts

import { getPrismaClient } from '../config/database';

export interface AuditLogData {
  action: string;
  userId?: string;
  deviceId?: string;
  licenseId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  /**
   * Создать запись в audit log
   */
  static async log(data: AuditLogData): Promise<void> {
    const prisma = getPrismaClient();
    
    try {
      await prisma.auditLog.create({
        data: {
          action: data.action,
          userId: data.userId,
          deviceId: data.deviceId,
          licenseId: data.licenseId,
          details: data.details || {},
          ipAddress: data.ipAddress,
          userAgent: data.userAgent
        }
      });
    } catch (error) {
      // Логирование не должно ломать основной процесс
      console.error('Failed to create audit log:', error);
    }
  }
  
  /**
   * Логировать активацию устройства
   */
  static async logActivation(params: {
    deviceId: string;
    licenseId: string;
    appType: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.log({
      action: 'device_activate',
      deviceId: params.deviceId,
      licenseId: params.licenseId,
      details: {
        appType: params.appType
      },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent
    });
  }
  
  /**
   * Логировать деактивацию устройства
   */
  static async logDeactivation(params: {
    deviceId: string;
    licenseId: string;
    userId?: string;
    ipAddress?: string;
  }): Promise<void> {
    await this.log({
      action: 'device_deactivate',
      deviceId: params.deviceId,
      licenseId: params.licenseId,
      userId: params.userId,
      ipAddress: params.ipAddress
    });
  }
  
  /**
   * Логировать обновление токена
   */
  static async logTokenRefresh(params: {
    deviceId: string;
    licenseId: string;
    ipAddress?: string;
  }): Promise<void> {
    await this.log({
      action: 'token_refresh',
      deviceId: params.deviceId,
      licenseId: params.licenseId,
      ipAddress: params.ipAddress
    });
  }
  
  /**
   * Логировать создание лицензии
   */
  static async logLicenseCreated(params: {
    licenseId: string;
    userId: string;
    details: any;
    ipAddress?: string;
  }): Promise<void> {
    await this.log({
      action: 'license_create',
      licenseId: params.licenseId,
      userId: params.userId,
      details: params.details,
      ipAddress: params.ipAddress
    });
  }
  
  /**
   * Логировать обновление лицензии
   */
  static async logLicenseUpdated(params: {
    licenseId: string;
    userId: string;
    changes: any;
    ipAddress?: string;
  }): Promise<void> {
    await this.log({
      action: 'license_update',
      licenseId: params.licenseId,
      userId: params.userId,
      details: { changes: params.changes },
      ipAddress: params.ipAddress
    });
  }
  
  /**
   * Логировать вход админа
   */
  static async logAdminLogin(params: {
    userId: string;
    email: string;
    success: boolean;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.log({
      action: params.success ? 'admin_login_success' : 'admin_login_failed',
      userId: params.userId,
      details: { email: params.email },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent
    });
  }
  
  /**
   * Получить логи по фильтрам
   */
  static async getLogs(filters?: {
    action?: string;
    userId?: string;
    deviceId?: string;
    licenseId?: string;
    limit?: number;
    offset?: number;
  }) {
    const prisma = getPrismaClient();
    
    const where: any = {};
    
    if (filters?.action) where.action = filters.action;
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.deviceId) where.deviceId = filters.deviceId;
    if (filters?.licenseId) where.licenseId = filters.licenseId;
    
    return prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true
          }
        },
        device: {
          select: {
            id: true,
            deviceName: true,
            appType: true
          }
        },
        license: {
          select: {
            id: true,
            licenseKey: true,
            plan: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 100,
      skip: filters?.offset || 0
    });
  }
  
  /**
   * Получить статистику по действиям
   */
  static async getActionStats(days: number = 30) {
    const prisma = getPrismaClient();
    
    const since = new Date();
    since.setDate(since.getDate() - days);
    
    const stats = await prisma.auditLog.groupBy({
      by: ['action'],
      where: {
        createdAt: {
          gte: since
        }
      },
      _count: true
    });
    
    return stats.map(stat => ({
      action: stat.action,
      count: stat._count
    }));
  }
}
