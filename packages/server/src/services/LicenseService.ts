// packages/server/src/services/LicenseService.ts

import { Plan, LicenseStatus, generateLicenseKey } from '@kiosk/shared';
import { getPrismaClient } from '../config/database';

export class LicenseService {
  /**
   * Создать новую лицензию
   */
  static async createLicense(params: {
    organizationId: string;
    plan: Plan;
    seatsEditor: number;
    seatsPlayer: number;
    validFrom: Date;
    validUntil: Date;
  }) {
    const prisma = getPrismaClient();
    
    // Генерируем уникальный ключ
    let licenseKey: string;
    let isUnique = false;
    
    while (!isUnique) {
      licenseKey = generateLicenseKey();
      const existing = await prisma.license.findUnique({
        where: { licenseKey }
      });
      isUnique = !existing;
    }
    
    return prisma.license.create({
      data: {
        licenseKey: licenseKey!,
        organizationId: params.organizationId,
        plan: params.plan.toUpperCase() as 'BASIC' | 'PRO' | 'MAX',
        status: 'ACTIVE',
        seatsEditor: params.seatsEditor,
        seatsPlayer: params.seatsPlayer,
        validFrom: params.validFrom,
        validUntil: params.validUntil
      },
      include: {
        organization: true
      }
    });
  }
  
  /**
   * Найти лицензию по ключу
   */
  static async findByKey(licenseKey: string) {
    const prisma = getPrismaClient();
    
    return prisma.license.findUnique({
      where: { licenseKey },
      include: {
        organization: true,
        devices: true
      }
    });
  }
  
  /**
   * Проверить валидность лицензии
   */
  static async validateLicense(licenseKey: string): Promise<{
    valid: boolean;
    license?: any;
    error?: string;
  }> {
    const license = await this.findByKey(licenseKey);
    
    if (!license) {
      return { valid: false, error: 'License not found' };
    }
    
    if (license.status !== 'ACTIVE') {
      return { valid: false, error: `License is ${license.status.toLowerCase()}` };
    }
    
    const now = new Date();
    if (now < license.validFrom) {
      return { valid: false, error: 'License not yet valid' };
    }
    
    if (now > license.validUntil) {
      // Автоматически помечаем как истёкшую
      await this.updateLicenseStatus(license.id, 'EXPIRED' as LicenseStatus);
      return { valid: false, error: 'License expired' };
    }
    
    return { valid: true, license };
  }
  
  /**
   * Обновить статус лицензии
   */
  static async updateLicenseStatus(licenseId: string, status: LicenseStatus) {
    const prisma = getPrismaClient();
    
    return prisma.license.update({
      where: { id: licenseId },
      data: {
        status: status.toUpperCase() as 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED'
      }
    });
  }
  
  /**
   * Обновить лицензию
   */
  static async updateLicense(
    licenseId: string,
    updates: {
      plan?: Plan;
      seatsEditor?: number;
      seatsPlayer?: number;
      validUntil?: Date;
      status?: LicenseStatus;
    }
  ) {
    const prisma = getPrismaClient();
    
    const data: any = {};
    
    if (updates.plan) {
      data.plan = updates.plan.toUpperCase();
    }
    if (updates.seatsEditor !== undefined) {
      data.seatsEditor = updates.seatsEditor;
    }
    if (updates.seatsPlayer !== undefined) {
      data.seatsPlayer = updates.seatsPlayer;
    }
    if (updates.validUntil) {
      data.validUntil = updates.validUntil;
    }
    if (updates.status) {
      data.status = updates.status.toUpperCase();
    }
    
    return prisma.license.update({
      where: { id: licenseId },
      data,
      include: {
        organization: true,
        devices: true
      }
    });
  }
  
  /**
   * Получить все лицензии организации
   */
  static async getOrganizationLicenses(organizationId: string) {
    const prisma = getPrismaClient();
    
    return prisma.license.findMany({
      where: { organizationId },
      include: {
        devices: {
          where: { status: 'ACTIVE' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
  
  /**
   * Получить все лицензии (админ)
   */
  static async getAllLicenses(filters?: {
    status?: LicenseStatus;
    plan?: Plan;
  }) {
    const prisma = getPrismaClient();
    
    const where: any = {};
    
    if (filters?.status) {
      where.status = filters.status.toUpperCase();
    }
    if (filters?.plan) {
      where.plan = filters.plan.toUpperCase();
    }
    
    return prisma.license.findMany({
      where,
      include: {
        organization: true,
        devices: {
          where: { status: 'ACTIVE' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
  
  /**
   * Получить статистику лицензий
   */
  static async getLicenseStats() {
    const prisma = getPrismaClient();
    
    const [total, active, expired, suspended] = await Promise.all([
      prisma.license.count(),
      prisma.license.count({ where: { status: 'ACTIVE' } }),
      prisma.license.count({ where: { status: 'EXPIRED' } }),
      prisma.license.count({ where: { status: 'SUSPENDED' } })
    ]);
    
    const byPlan = await prisma.license.groupBy({
      by: ['plan'],
      _count: true
    });
    
    return {
      total,
      active,
      expired,
      suspended,
      byPlan: byPlan.reduce((acc, item) => {
        acc[item.plan.toLowerCase()] = item._count;
        return acc;
      }, {} as Record<string, number>)
    };
  }
}
