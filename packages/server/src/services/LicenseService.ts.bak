// packages/server/src/services/LicenseService.ts
// PATCHED: Added optional licenseKey parameter to createLicense()

import { Plan, LicenseStatus, generateLicenseKey } from '@kiosk/shared';
import { getPrismaClient } from '../config/database';

export class LicenseService {
  /**
   * Создать новую лицензию
   * 
   * PATCHED: Added optional licenseKey parameter
   * If not provided, generates a unique one automatically
   */
  static async createLicense(params: {
    organizationId: string;
    plan: Plan | string;
    seatsEditor: number;
    seatsPlayer: number;
    validFrom: Date;
    validUntil: Date;
    licenseKey?: string; // 🆕 Optional parameter
    companyName?: string;
    contactEmail?: string;
    notes?: string;
  }) {
    const prisma = getPrismaClient();
    
    let finalLicenseKey: string;
    
    if (params.licenseKey) {
      // Use provided license key
      finalLicenseKey = params.licenseKey;
      
      // Check if it already exists
      const existing = await prisma.license.findUnique({
        where: { licenseKey: finalLicenseKey }
      });
      
      if (existing) {
        throw new Error(`License key ${finalLicenseKey} already exists`);
      }
    } else {
      // Generate unique key
      let isUnique = false;
      
      while (!isUnique) {
        finalLicenseKey = generateLicenseKey();
        const existing = await prisma.license.findUnique({
          where: { licenseKey: finalLicenseKey }
        });
        isUnique = !existing;
      }
    }
    
    // Ensure plan is uppercase for database enum
    const planUpper = (typeof params.plan === 'string' 
      ? params.plan.toUpperCase() 
      : params.plan.toUpperCase()) as 'BASIC' | 'PRO' | 'MAX';
    
    return prisma.license.create({
      data: {
        licenseKey: finalLicenseKey,
        organizationId: params.organizationId,
        plan: planUpper,
        status: 'ACTIVE',
        seatsEditor: params.seatsEditor,
        seatsPlayer: params.seatsPlayer,
        validFrom: params.validFrom,
        validUntil: params.validUntil,
        companyName: params.companyName || null,
        contactEmail: params.contactEmail || null,
        notes: params.notes || null
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
      plan?: Plan | string;
      seatsEditor?: number;
      seatsPlayer?: number;
      validUntil?: Date;
      status?: LicenseStatus | string;
      companyName?: string;
      contactEmail?: string;
      notes?: string;
    }
  ) {
    const prisma = getPrismaClient();
    
    const data: any = {};
    
    if (updates.plan) {
      data.plan = (typeof updates.plan === 'string' 
        ? updates.plan.toUpperCase() 
        : updates.plan.toUpperCase()) as 'BASIC' | 'PRO' | 'MAX';
    }
    
    if (updates.seatsEditor !== undefined) data.seatsEditor = updates.seatsEditor;
    if (updates.seatsPlayer !== undefined) data.seatsPlayer = updates.seatsPlayer;
    if (updates.validUntil) data.validUntil = updates.validUntil;
    if (updates.companyName !== undefined) data.companyName = updates.companyName;
    if (updates.contactEmail !== undefined) data.contactEmail = updates.contactEmail;
    if (updates.notes !== undefined) data.notes = updates.notes;
    
    if (updates.status) {
      data.status = (typeof updates.status === 'string' 
        ? updates.status.toUpperCase() 
        : updates.status.toUpperCase()) as 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED';
    }
    
    return prisma.license.update({
      where: { id: licenseId },
      data,
      include: {
        organization: true
      }
    });
  }
  
  /**
   * Получить лицензию по ID
   */
  static async findById(licenseId: string) {
    const prisma = getPrismaClient();
    
    return prisma.license.findUnique({
      where: { id: licenseId },
      include: {
        organization: true,
        devices: true
      }
    });
  }
  
  /**
   * Подсчитать активные устройства по типу
   */
  static async getActiveDevicesCount(licenseId: string) {
    const prisma = getPrismaClient();
    
    const [editorCount, playerCount] = await Promise.all([
      prisma.device.count({
        where: {
          licenseId,
          appType: 'EDITOR',
          status: 'ACTIVE'
        }
      }),
      prisma.device.count({
        where: {
          licenseId,
          appType: 'PLAYER',
          status: 'ACTIVE'
        }
      })
    ]);
    
    return { editorCount, playerCount };
  }
  
  /**
   * Проверить доступны ли места для активации
   */
  static async hasAvailableSeats(
    licenseId: string,
    appType: 'EDITOR' | 'PLAYER'
  ): Promise<boolean> {
    const license = await this.findById(licenseId);
    if (!license) return false;
    
    const { editorCount, playerCount } = await this.getActiveDevicesCount(licenseId);
    
    if (appType === 'EDITOR') {
      return editorCount < license.seatsEditor;
    } else {
      return playerCount < license.seatsPlayer;
    }
  }
}
