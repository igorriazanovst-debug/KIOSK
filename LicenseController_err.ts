// packages/server/src/controllers/LicenseController.ts

import { Request, Response } from 'express';
import { AppType } from '@kiosk/shared';
import { LicenseService } from '../services/LicenseService';
import { DeviceService } from '../services/DeviceService';
import { TokenService } from '../services/TokenService';
import { AuditService } from '../services/AuditService';
import { ApiError } from '../middleware/errorHandler';

export class LicenseController {
  /**
   * POST /api/license/activate
   * Активировать устройство с license key
   */
  static async activate(req: Request, res: Response) {
    const { licenseKey, deviceId, appType, deviceName, osInfo } = req.body;
    
    // Проверить что лицензия существует и валидна
    const licenseCheck = await LicenseService.validateLicense(licenseKey);
    
    if (!licenseCheck.valid) {
      throw ApiError.badRequest(licenseCheck.error || 'Invalid license');
    }
    
    const license = licenseCheck.license!;
    
    // Проверить что устройство не активировано уже
    const existingDevice = await DeviceService.findByDeviceId(deviceId);
    
    if (existingDevice) {
      // Устройство уже активировано
      if (existingDevice.status === 'DEACTIVATED') {
        throw ApiError.forbidden('Device was deactivated. Contact support to reactivate.');
      }
      
      // Если устройство уже активировано - вернуть новый токен
      const { token, expiresAt } = await TokenService.createToken({
        licenseId: existingDevice.licenseId,
        organizationId: license.organizationId,
        deviceId: existingDevice.deviceId,
        plan: license.plan.toLowerCase() as any,
        appType: existingDevice.appType === 'EDITOR' ? AppType.Editor : AppType.Player
      });
      
      await DeviceService.updateLastSeen(deviceId);
      
      await AuditService.logActivation({
        deviceId,
        licenseId: license.id,
        appType: existingDevice.appType,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
      
      return res.json({
        success: true,
        token,
        expiresAt,
        message: 'Device already activated, new token issued'
      });
    }
    
    // Проверить лимиты устройств
    const appTypeEnum = appType === 'editor' ? AppType.Editor : AppType.Player;
    const limitsCheck = await DeviceService.checkDeviceLimits(license.id, appTypeEnum);
    
    if (!limitsCheck.canActivate) {
      throw ApiError.forbidden(
        `License limit reached: ${limitsCheck.activeCount}/${limitsCheck.limit} ${appType} devices active`
      );
    }
    
    // Создать новое устройство
    const device = await DeviceService.createDevice({
      deviceId,
      licenseId: license.id,
      appType: appTypeEnum,
      deviceName,
      osInfo
    });
    
    // Создать JWT токен
    const { token, expiresAt } = await TokenService.createToken({
      licenseId: license.id,
      organizationId: license.organizationId,
      deviceId: device.deviceId,
      plan: license.plan.toLowerCase() as any,
      appType: appTypeEnum
    });
    
    // Audit log
    await AuditService.logActivation({
      deviceId: device.deviceId,
      licenseId: license.id,
      appType,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    res.status(201).json({
      success: true,
      token,
      expiresAt,
      device: {
        id: device.id,
        deviceId: device.deviceId,
        appType: device.appType,
        deviceName: device.deviceName
      },
      license: {
        plan: license.plan,
        validUntil: license.validUntil
      }
    });
  }
  
  /**
   * POST /api/license/refresh
   * Обновить токен устройства
   */
  static async refresh(req: Request, res: Response) {
    const { deviceId, oldToken } = req.body;
    
    // Проверить старый токен
    const payload = await TokenService.verifyToken(oldToken);
    
    if (!payload) {
      throw ApiError.unauthorized('Invalid or expired token');
    }
    
    // Проверить что deviceId совпадает
    if (payload.deviceId !== deviceId) {
      throw ApiError.forbidden('Device ID mismatch');
    }
    
    // Найти устройство
    const device = await DeviceService.findByDeviceId(deviceId);
    
    if (!device) {
      throw ApiError.notFound('Device not found');
    }
    
    if (device.status === 'DEACTIVATED') {
      throw ApiError.forbidden('Device is deactivated');
    }
    
    // Проверить лицензию
    const licenseCheck = await LicenseService.validateLicense(device.license.licenseKey);
    
    if (!licenseCheck.valid) {
      throw ApiError.forbidden(licenseCheck.error || 'License is no longer valid');
    }
    
    // Создать новый токен
    const { token, expiresAt } = await TokenService.createToken({
      licenseId: device.licenseId,
      organizationId: device.license.organizationId,
      deviceId: device.deviceId,
      plan: device.license.plan.toLowerCase() as any,
      appType: device.appType === 'EDITOR' ? AppType.Editor : AppType.Player
    });
    
    // Обновить last seen
    await DeviceService.updateLastSeen(deviceId);
    
    // Audit log
    await AuditService.logTokenRefresh({
      deviceId: device.deviceId,
      licenseId: device.licenseId,
      ipAddress: req.ip
    });
    
    res.json({
      success: true,
      token,
      expiresAt
    });
  }
  
  /**
   * POST /api/license/validate
   * Проверить валидность токена
   */
  static async validate(req: Request, res: Response) {
    const { token, deviceId } = req.body;
    
    // Проверить токен
    const payload = await TokenService.verifyToken(token);
    
    if (!payload) {
      return res.json({
        valid: false,
        error: 'Invalid or expired token'
      });
    }
    
    // Проверить что deviceId совпадает
    if (payload.deviceId !== deviceId) {
      return res.json({
        valid: false,
        error: 'Device ID mismatch'
      });
    }
    
    // Найти устройство
    const device = await DeviceService.findByDeviceId(deviceId);
    
    if (!device) {
      return res.json({
        valid: false,
        error: 'Device not found'
      });
    }
    
    if (device.status === 'DEACTIVATED') {
      return res.json({
        valid: false,
        error: 'Device is deactivated'
      });
    }
    
    // Проверить лицензию
    const license = device.license;
    
    if (license.status !== 'ACTIVE') {
      return res.json({
        valid: false,
        error: `License is ${license.status.toLowerCase()}`
      });
    }
    
    const now = new Date();
    if (now > license.validUntil) {
      return res.json({
        valid: false,
        error: 'License expired'
      });
    }
    
    res.json({
      valid: true,
      payload: {
        licenseId: payload.licenseId,
        deviceId: payload.deviceId,
        plan: payload.plan,
        app: payload.app,
        features: payload.features,
        expiresAt: new Date(payload.exp * 1000)
      }
    });
  }
  
  /**
   * POST /api/license/deactivate
   * Деактивировать устройство
   */
  static async deactivate(req: Request, res: Response) {
    const { deviceId, licenseKey } = req.body;
    
    // Проверить лицензию
    const licenseCheck = await LicenseService.validateLicense(licenseKey);
    
    if (!licenseCheck.valid) {
      throw ApiError.badRequest('Invalid license key');
    }
    
    // Найти устройство
    const device = await DeviceService.findByDeviceId(deviceId);
    
    if (!device) {
      throw ApiError.notFound('Device not found');
    }
    
    // Проверить что устройство принадлежит этой лицензии
    if (device.licenseId !== licenseCheck.license!.id) {
      throw ApiError.forbidden('Device does not belong to this license');
    }
    
    // Деактивировать
    await DeviceService.deactivateDevice(deviceId);
    
    // Отозвать все токены устройства
    await TokenService.revokeDeviceTokens(deviceId);
    
    // Audit log
    await AuditService.logDeactivation({
      deviceId,
      licenseId: device.licenseId,
      ipAddress: req.ip
    });
    
    res.json({
      success: true,
      message: 'Device deactivated successfully'
    });
  }
}
