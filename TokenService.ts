// packages/server/src/services/TokenService.ts

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { JWTPayload, AppType, Plan } from '@kiosk/shared';
import { getJWTConfig } from '../config/jwt';
import { getPrismaClient } from '../config/database';
import { getAllFeaturesForToken } from '../config/features';

export class TokenService {
  /**
   * Создать JWT токен для устройства
   */
  static async createToken(params: {
    licenseId: string;
    organizationId: string;
    deviceId: string;
    plan: Plan;
    appType: AppType;
  }): Promise<{ token: string; expiresAt: Date }> {
    const config = getJWTConfig();
    const prisma = getPrismaClient();
    
    // Находим устройство по deviceId чтобы получить его UUID
    const device = await prisma.device.findUnique({
      where: { deviceId: params.deviceId }
    });
    
    if (!device) {
      throw new Error('Device not found');
    }
    
    // Генерируем уникальный JWT ID
    const jti = crypto.randomUUID();
    
    // Получаем features для плана и типа приложения
    const features = getAllFeaturesForToken(
      params.plan,
      params.appType === AppType.Editor ? 'EDITOR' : 'PLAYER'
    );
    
    // Создаём payload
    const now = Math.floor(Date.now() / 1000);
    const payload: JWTPayload = {
      licenseId: params.licenseId,
      organizationId: params.organizationId,
      deviceId: params.deviceId,
      plan: params.plan,
      app: params.appType,
      features,
      iat: now,
      exp: now + this.getExpiresInSeconds(config.expiresIn),
      jti
    };
    
    // Подписываем токен
    const token = jwt.sign(payload, config.privateKey, {
      algorithm: config.algorithm
    });
    
    // Вычисляем дату истечения
    const expiresAt = new Date((payload.exp) * 1000);
    
    // Сохраняем токен в БД для возможности отзыва
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
    
    await prisma.token.create({
      data: {
        deviceId: device.id,  // Используем UUID из БД, а не строку deviceId
        jti,
        tokenHash,
        expiresAt
      }
    });
    
    return { token, expiresAt };
  }
  
  /**
   * Проверить токен
   */
  static async verifyToken(token: string): Promise<JWTPayload | null> {
    try {
      const config = getJWTConfig();
      const prisma = getPrismaClient();
      
      // Проверяем подпись и парсим
      const payload = jwt.verify(token, config.publicKey, {
        algorithms: [config.algorithm]
      }) as JWTPayload;
      
      // Проверяем что токен не отозван
      const tokenRecord = await prisma.token.findUnique({
        where: { jti: payload.jti }
      });
      
      if (!tokenRecord || tokenRecord.revoked) {
        return null;
      }
      
      return payload;
    } catch (error) {
      console.error('Token verification failed:', error);
      return null;
    }
  }
  
  /**
   * Отозвать токен
   */
  static async revokeToken(jti: string): Promise<void> {
    const prisma = getPrismaClient();
    
    await prisma.token.update({
      where: { jti },
      data: {
        revoked: true,
        revokedAt: new Date()
      }
    });
  }
  
  /**
   * Отозвать все токены устройства
   */
  static async revokeDeviceTokens(deviceId: string): Promise<void> {
    const prisma = getPrismaClient();
    
    await prisma.token.updateMany({
      where: {
        deviceId,
        revoked: false
      },
      data: {
        revoked: true,
        revokedAt: new Date()
      }
    });
  }
  
  /**
   * Очистить истёкшие токены
   */
  static async cleanupExpiredTokens(): Promise<number> {
    const prisma = getPrismaClient();
    
    const result = await prisma.token.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });
    
    return result.count;
  }
  
  /**
   * Преобразовать строку времени в секунды
   */
  private static getExpiresInSeconds(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid expiresIn format: ${expiresIn}`);
    }
    
    const [, value, unit] = match;
    const num = parseInt(value, 10);
    
    switch (unit) {
      case 's': return num;
      case 'm': return num * 60;
      case 'h': return num * 60 * 60;
      case 'd': return num * 60 * 60 * 24;
      default: throw new Error(`Unknown time unit: ${unit}`);
    }
  }
}
