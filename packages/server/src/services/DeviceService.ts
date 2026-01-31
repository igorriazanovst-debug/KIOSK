// packages/server/src/services/DeviceService.ts

import { AppType, DeviceStatus } from '@kiosk/shared';
import { getPrismaClient } from '../config/database';

export class DeviceService {
  /**
   * Найти устройство по deviceId
   */
  static async findByDeviceId(deviceId: string) {
    const prisma = getPrismaClient();
    return prisma.device.findUnique({
      where: { deviceId },
      include: {
        license: {
          include: {
            organization: true
          }
        }
      }
    });
  }
  
  /**
   * Создать новое устройство
   */
  static async createDevice(params: {
    deviceId: string;
    licenseId: string;
    appType: AppType;
    deviceName: string;
    osInfo?: any;
  }) {
    const prisma = getPrismaClient();
    
    return prisma.device.create({
      data: {
        deviceId: params.deviceId,
        licenseId: params.licenseId,
        appType: params.appType === AppType.Editor ? 'EDITOR' : 'PLAYER',
        deviceName: params.deviceName,
        osInfo: params.osInfo,
        status: 'ACTIVE',
        lastSeenAt: new Date()
      },
      include: {
        license: {
          include: {
            organization: true
          }
        }
      }
    });
  }
  
  /**
   * Обновить lastSeenAt для устройства
   */
  static async updateLastSeen(deviceId: string): Promise<void> {
    const prisma = getPrismaClient();
    
    await prisma.device.update({
      where: { deviceId },
      data: {
        lastSeenAt: new Date()
      }
    });
  }
  
  /**
   * Деактивировать устройство
   */
  static async deactivateDevice(deviceId: string): Promise<void> {
    const prisma = getPrismaClient();
    
    await prisma.device.update({
      where: { deviceId },
      data: {
        status: 'DEACTIVATED',
        deactivatedAt: new Date()
      }
    });
  }
  
  /**
   * Проверить лимиты устройств для лицензии
   */
  static async checkDeviceLimits(licenseId: string, appType: AppType): Promise<{
    canActivate: boolean;
    activeCount: number;
    limit: number;
  }> {
    const prisma = getPrismaClient();
    
    // Получаем лицензию с лимитами
    const license = await prisma.license.findUnique({
      where: { id: licenseId }
    });
    
    if (!license) {
      throw new Error('License not found');
    }
    
    // Считаем активные устройства
    const activeCount = await prisma.device.count({
      where: {
        licenseId,
        appType: appType === AppType.Editor ? 'EDITOR' : 'PLAYER',
        status: 'ACTIVE'
      }
    });
    
    // Определяем лимит
    const limit = appType === AppType.Editor 
      ? license.seatsEditor 
      : license.seatsPlayer;
    
    return {
      canActivate: activeCount < limit,
      activeCount,
      limit
    };
  }
  
  /**
   * Получить все устройства лицензии
   */
  static async getLicenseDevices(licenseId: string) {
    const prisma = getPrismaClient();
    
    return prisma.device.findMany({
      where: { licenseId },
      orderBy: { activatedAt: 'desc' }
    });
  }
  
  /**
   * Получить статистику устройств для организации
   */
  static async getOrganizationDeviceStats(organizationId: string) {
    const prisma = getPrismaClient();
    
    const devices = await prisma.device.findMany({
      where: {
        license: {
          organizationId
        }
      },
      include: {
        license: true
      }
    });
    
    const activeEditors = devices.filter(
      d => d.appType === 'EDITOR' && d.status === 'ACTIVE'
    ).length;
    
    const activePlayers = devices.filter(
      d => d.appType === 'PLAYER' && d.status === 'ACTIVE'
    ).length;
    
    const totalDevices = devices.length;
    
    return {
      totalDevices,
      activeEditors,
      activePlayers,
      deactivated: devices.filter(d => d.status === 'DEACTIVATED').length
    };
  }
}
