// packages/server/src/controllers/DeviceReassignController.ts
// Удалённое переподключение уже активированного устройства к другой
// лицензии — без повторного ввода email/пароля на самом устройстве.
//
// Зачем: если плеер активировали не под той учёткой (например, под личным
// рабочим аккаунтом администратора вместо выделенного клиентского), раньше
// единственным способом всё исправить было деактивировать устройство и
// попросить кого-то на месте заново ввести email/пароль в окне активации.
// Если физического/удалённого доступа к конкретному устройству нет — это
// невозможно. Здесь сервер сам выпускает новый токен под целевую лицензию и
// передаёт его устройству по уже открытому WebSocket-соединению (heartbeat),
// поэтому переподключение работает только пока устройство онлайн.

import { Request, Response } from 'express';
import { AppType } from '@kiosk/shared';
import { getPrismaClient } from '../config/database';
import { DeviceService } from '../services/DeviceService';
import { TokenService } from '../services/TokenService';
import { AuditService } from '../services/AuditService';
import { ProjectAccessService } from '../services/ProjectAccessService';
import { ApiError } from '../middleware/errorHandler';
import type { WebSocket } from 'ws';

// Отправляет фрейм и ждёт подтверждения записи в сокет (а не просто
// проверяет readyState заранее) — readyState может стать неактуальным за
// время между проверкой и вызовом send из-за await'ов между ними.
function sendWs(ws: WebSocket, payload: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.send(JSON.stringify(payload), (err?: Error) => {
      if (err) reject(err); else resolve();
    });
  });
}

export class DeviceReassignController {
  /**
   * POST /api/admin/devices/:id/reassign
   * body: { licenseId, projectId? } — projectId по умолчанию берётся с самого
   * устройства (Device.projectId), если явно не передан другой.
   */
  static async reassign(req: Request, res: Response) {
    const { id } = req.params;
    const { licenseId, projectId: bodyProjectId } = req.body;

    const prisma = getPrismaClient();

    const device = await prisma.device.findUnique({ where: { id } });
    if (!device) throw ApiError.notFound('Device not found');

    // Плеер (packages/player/electron/main.js) — единственный клиент, который
    // умеет обрабатывать WS-сообщение device:reassign. У редактора такого
    // обработчика нет, а лимит мест ниже считается по player-местам.
    if (device.appType !== 'PLAYER') {
      return res.status(400).json({
        success: false,
        error: 'Remote reassign is only supported for PLAYER devices'
      });
    }

    const targetLicense = await prisma.license.findUnique({ where: { id: licenseId } });
    if (!targetLicense) throw ApiError.notFound('Target license not found');
    if (targetLicense.status !== 'ACTIVE') {
      return res.status(409).json({
        success: false,
        error: `Target license is ${targetLicense.status.toLowerCase()}, cannot reassign a device to it`
      });
    }

    const projectId = bodyProjectId || device.projectId;
    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'projectId is required — this device has no project on record to fall back to'
      });
    }

    const hasAccess = await ProjectAccessService.licenseHasAccess(licenseId, projectId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Target license does not have access to this project — grant it access first'
      });
    }

    if (device.licenseId !== licenseId) {
      const limitsCheck = await DeviceService.checkDeviceLimits(licenseId, AppType.Player);
      if (!limitsCheck.canActivate) {
        return res.status(403).json({
          success: false,
          error: `Target license player seat limit reached: ${limitsCheck.activeCount}/${limitsCheck.limit}`
        });
      }
    }

    const { getDeviceSockets, isDeviceSocketVerified } = await import('../app');
    const ws = getDeviceSockets().get(device.deviceId);
    if (!ws || ws.readyState !== 1 /* WebSocket.OPEN */) {
      return res.status(409).json({
        success: false,
        error: 'Device is not currently connected — it must be online to receive the new token'
      });
    }
    if (!isDeviceSocketVerified(device.deviceId)) {
      return res.status(409).json({
        success: false,
        error: 'Device connection is not verified (it may be running a player build older than this feature) — remote reassign is unavailable until it reconnects with an updated build'
      });
    }

    const previousLicenseId = device.licenseId;
    const previousProjectId = device.projectId;

    // Новый токен выпускаем и пытаемся ДОСТАВИТЬ до того, как трогаем что-либо
    // ещё. Если доставка не удастся — ничего на сервере не поменяется, старый
    // токен останется рабочим, админ может просто повторить попытку. Отзыв
    // старых токенов и обновление Device в БД — только ПОСЛЕ подтверждённой
    // записи сообщения в сокет (см. sendWs), а не наоборот.
    const { token, expiresAt } = await TokenService.createToken({
      licenseId: targetLicense.id,
      organizationId: targetLicense.organizationId,
      deviceId: device.deviceId,
      plan: targetLicense.plan.toLowerCase() as any,
      appType: AppType.Player
    });

    try {
      await sendWs(ws, { type: 'device:reassign', token, expiresAt, projectId });
    } catch (sendErr: any) {
      return res.status(502).json({
        success: false,
        error: 'Failed to deliver the new token to the device (it may have just disconnected) — nothing was changed, you can retry'
      });
    }

    await TokenService.revokeDeviceTokens(device.deviceId);

    await prisma.device.update({
      where: { id: device.id },
      data: { licenseId, projectId }
    });

    // Отдельные записи под обеими лицензиями — чтобы событие было видно и из
    // истории лицензии, у которой устройство забрали, а не только у той,
    // которой его отдали.
    await AuditService.logLicenseUpdated({
      licenseId,
      userId: req.user!.id,
      changes: {
        action: 'device_reassign',
        reassignedDeviceId: device.id,
        fromLicenseId: previousLicenseId,
        fromProjectId: previousProjectId,
        toProjectId: projectId
      },
      ipAddress: req.ip
    });
    if (previousLicenseId !== licenseId) {
      await AuditService.logLicenseUpdated({
        licenseId: previousLicenseId,
        userId: req.user!.id,
        changes: {
          action: 'device_reassign',
          reassignedDeviceId: device.id,
          toLicenseId: licenseId,
          fromProjectId: previousProjectId,
          toProjectId: projectId
        },
        ipAddress: req.ip
      });
    }

    res.json({
      success: true,
      data: { deviceId: device.id, licenseId, projectId, expiresAt }
    });
  }
}
