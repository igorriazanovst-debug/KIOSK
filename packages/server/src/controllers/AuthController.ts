import crypto from 'crypto';
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

      // Создаём/обновляем запись редактора в devices
      const editorDeviceId = crypto
        .createHash('sha256')
        .update(licenseKey + ((req.headers['x-real-ip'] as string) || req.ip || '') + (req.get('user-agent') || ''))
        .digest('hex')
        .slice(0, 36);
      try {
        const existingDevice = await prisma.device.findUnique({ where: { deviceId: editorDeviceId } });
        if (existingDevice) {
          await prisma.device.update({
            where: { deviceId: editorDeviceId },
            data: { 
              lastSeenAt: new Date(),
              osInfo: JSON.stringify({ userAgent: req.get('user-agent') || 'unknown', ipAddress: (req.headers['x-real-ip'] as string) || '' })
            }
          });
        } else {
          await prisma.device.create({
            data: {
              deviceId: editorDeviceId,
              licenseId: license.id,
              appType: 'EDITOR',
              deviceName: `Editor: ${licenseKey}`,
              osInfo: JSON.stringify({ userAgent: req.get('user-agent') || 'unknown', ipAddress: (req.headers['x-real-ip'] as string) || '' }),
              status: 'ACTIVE',
              lastSeenAt: new Date()
            }
          });
        }
      } catch (devErr: any) {
        console.warn('[Auth] Device upsert failed:', devErr.message);
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
  /**
   * POST /api/auth/editor-login
   * Вход в редактор по email + password (LicenseUser)
   */
  static async loginWithEmailPassword(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'email and password are required'
        });
      }

      const prisma = getPrismaClient();
      const user = await prisma.licenseUser.findUnique({
        where: { email },
        include: {
          license: {
            include: {
              organization: true,
            },
          },
        },
      });

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials', message: 'User not found' });
      }

      const bcrypt = require('bcrypt');
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials', message: 'Wrong password' });
      }

      const license = user.license;

      if (license.status !== 'ACTIVE') {
        return res.status(403).json({ error: 'License inactive', message: `License is ${license.status.toLowerCase()}` });
      }

      const now = new Date();
      if (now < license.validFrom || now > license.validUntil) {
        return res.status(403).json({ error: 'License expired', message: 'License is not currently valid' });
      }

      // Создаём/обновляем запись редактора в devices
      const editorDeviceId = crypto
        .createHash('sha256')
        .update(user.email + license.id)
        .digest('hex')
        .slice(0, 36);
      try {
        const existingDevice = await prisma.device.findUnique({ where: { deviceId: editorDeviceId } });
        if (existingDevice) {
          await prisma.device.update({
            where: { deviceId: editorDeviceId },
            data: { 
              lastSeenAt: new Date(),
              osInfo: JSON.stringify({ userAgent: req.get('user-agent') || 'unknown', ipAddress: (req.headers['x-real-ip'] as string) || '' })
            }
          });
        } else {
          await prisma.device.create({
            data: {
              deviceId: editorDeviceId,
              licenseId: license.id,
              appType: 'EDITOR',
              deviceName: `Editor: ${user.email}`,
              osInfo: JSON.stringify({ userAgent: req.get('user-agent') || 'unknown', ipAddress: (req.headers['x-real-ip'] as string) || '' }),
              status: 'ACTIVE',
              lastSeenAt: new Date()
            }
          });
        }
      } catch (devErr: any) {
        console.warn('[Auth] Editor device upsert failed:', devErr.message);
      }

      const token = jwt.sign(
        {
          licenseUserId: user.id,
          licenseId: license.id,
          organizationId: license.organizationId,
          userId: user.id,
          email: user.email,
          role: user.role,
          type: 'license_user',
          plan: license.plan,
          editorDeviceId: editorDeviceId,
        },
        privateKey,
        { algorithm: 'RS256', expiresIn: '7d', issuer: 'kiosk-license-server' }
      );

      return res.json({
        success: true,
        token,
        expiresIn: 604800,
        license: {
          id: license.id,
          plan: license.plan,
          organizationId: license.organizationId,
          organizationName: license.organization.name,
          validFrom: license.validFrom,
          validUntil: license.validUntil,
          storageLimit: Number(license.storageLimit),
          seatsEditor: license.seatsEditor,
          seatsPlayer: license.seatsPlayer,
        },
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      console.error('Editor login error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * POST /api/auth/heartbeat
   * Обновить lastSeenAt для текущего устройства
   */
  static async heartbeat(req: Request, res: Response) {
    try {
      if (!req.client) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const prisma = getPrismaClient();

      // Ищем устройство по userId (для редакторов deviceId = hash от email+ip)
      // Обновляем все EDITOR-устройства этого пользователя/лицензии
      // editorDeviceId добавлен в токен при loginWithEmailPassword
      const editorDeviceId = (req.client as any).editorDeviceId;
      if (editorDeviceId) {
        await prisma.device.updateMany({
          where: { deviceId: editorDeviceId },
          data: { lastSeenAt: new Date() }
        });
      } else {
        // fallback для старых токенов без editorDeviceId
        await prisma.device.updateMany({
          where: {
            licenseId: req.client.licenseId,
            appType: 'EDITOR',
            status: 'ACTIVE',
            deviceName: { not: { contains: '::ffff:' } }
          },
          data: { lastSeenAt: new Date() }
        });
      }

      return res.json({ success: true });
    } catch (error) {
      console.error('Heartbeat error:', error);
      return res.status(500).json({ error: 'Heartbeat failed' });
    }
  }

}