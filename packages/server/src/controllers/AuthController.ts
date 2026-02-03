// packages/server/src/controllers/AuthController.ts
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { getPrismaClient } from '../config/database';
import { createAuditLog } from '../services/AuditService';

const privateKey = fs.readFileSync(path.join(__dirname, '../../keys/private.key'), 'utf8');

export class AuthController {
  /**
   * POST /api/auth/license
   * Вход по ключу лицензии
   */
  static async loginWithLicense(req: Request, res: Response) {
    try {
      const { licenseKey } = req.body;

      if (!licenseKey) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'License key is required'
        });
      }

      const prisma = getPrismaClient();

      // Находим лицензию
      const license = await prisma.license.findUnique({
        where: { licenseKey },
        include: {
          organization: {
            include: {
              owner: {
                select: {
                  id: true,
                  email: true
                }
              }
            }
          }
        }
      });

      if (!license) {
        return res.status(401).json({
          error: 'Invalid license',
          message: 'License key not found'
        });
      }

      // Проверяем статус лицензии
      if (license.status !== 'ACTIVE') {
        return res.status(403).json({
          error: 'License inactive',
          message: `License is ${license.status.toLowerCase()}`,
          status: license.status
        });
      }

      // Проверяем срок действия
      const now = new Date();
      if (now < license.validFrom || now > license.validUntil) {
        return res.status(403).json({
          error: 'License expired',
          message: 'License is not currently valid',
          validFrom: license.validFrom,
          validUntil: license.validUntil
        });
      }

      // Генерируем JWT токен для клиента
      const tokenPayload = {
        licenseId: license.id,
        organizationId: license.organizationId,
        userId: license.organization.owner.id,
        type: 'client',
        plan: license.plan
      };

      const token = jwt.sign(tokenPayload, privateKey, {
        algorithm: 'RS256',
        expiresIn: '7d', // Токен клиента живёт 7 дней
        issuer: 'kiosk-license-server',
        subject: licenseKey
      });

      // Логируем вход
      await createAuditLog({
        action: 'client_login',
        licenseId: license.id,
        details: {
          licenseKey: licenseKey.substring(0, 4) + '****',
          organizationId: license.organizationId,
          plan: license.plan
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      // Возвращаем токен и информацию о лицензии
      return res.json({
        success: true,
        token,
        expiresIn: 604800, // 7 дней в секундах
        license: {
          id: license.id,
          plan: license.plan,
          organizationId: license.organizationId,
          organizationName: license.organization.name,
          validFrom: license.validFrom,
          validUntil: license.validUntil,
          storageLimit: Number(license.storageLimit),
          seatsEditor: license.seatsEditor,
          seatsPlayer: license.seatsPlayer
        },
        user: {
          id: license.organization.owner.id,
          email: license.organization.owner.email
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An error occurred during login'
      });
    }
  }

  /**
   * POST /api/auth/refresh
   * Обновить токен
   */
  static async refreshToken(req: Request, res: Response) {
    try {
      if (!req.client) {
        return res.status(401).json({
          error: 'Authentication required'
        });
      }

      const prisma = getPrismaClient();

      // Проверяем что лицензия всё ещё активна
      const license = await prisma.license.findUnique({
        where: { id: req.client.licenseId },
        include: {
          organization: {
            include: {
              owner: {
                select: {
                  id: true,
                  email: true
                }
              }
            }
          }
        }
      });

      if (!license || license.status !== 'ACTIVE') {
        return res.status(403).json({
          error: 'License inactive',
          message: 'Your license is no longer active'
        });
      }

      // Генерируем новый токен
      const tokenPayload = {
        licenseId: license.id,
        organizationId: license.organizationId,
        userId: license.organization.owner.id,
        type: 'client',
        plan: license.plan
      };

      const token = jwt.sign(tokenPayload, privateKey, {
        algorithm: 'RS256',
        expiresIn: '7d',
        issuer: 'kiosk-license-server'
      });

      return res.json({
        success: true,
        token,
        expiresIn: 604800
      });

    } catch (error) {
      console.error('Token refresh error:', error);
      return res.status(500).json({
        error: 'Failed to refresh token',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/auth/verify
   * Проверить валидность токена
   */
  static async verifyToken(req: Request, res: Response) {
    try {
      if (!req.client) {
        return res.status(401).json({
          error: 'Authentication required'
        });
      }

      const prisma = getPrismaClient();

      // Получаем актуальную информацию о лицензии
      const license = await prisma.license.findUnique({
        where: { id: req.client.licenseId },
        include: {
          organization: true
        }
      });

      if (!license) {
        return res.status(404).json({
          error: 'License not found'
        });
      }

      return res.json({
        valid: true,
        license: {
          id: license.id,
          plan: license.plan,
          status: license.status,
          organizationId: license.organizationId,
          organizationName: license.organization.name,
          storageLimit: Number(license.storageLimit)
        }
      });

    } catch (error) {
      console.error('Token verification error:', error);
      return res.status(500).json({
        error: 'Verification failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
