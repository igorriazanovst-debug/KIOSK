// packages/server/src/controllers/ProjectGrantController.ts
// Управление доступом лицензий к чужим проектам (ProjectGrant) — выделено из
// AdminController, чтобы не превышать лимит файла в 800 строк.

import { Request, Response } from 'express';
import { getPrismaClient } from '../config/database';
import { AuditService } from '../services/AuditService';
import { ApiError } from '../middleware/errorHandler';

export class ProjectGrantController {
  /**
   * GET /api/admin/projects
   * Список проектов в системе (для выбора при выдаче гранта).
   * Поддерживает ?search= — без него отдаёт только 200 последних по updatedAt.
   */
  static async listProjects(req: Request, res: Response) {
    const prisma = getPrismaClient();
    const { search } = req.query;

    const projects = await prisma.project.findMany({
      where: search
        ? { name: { contains: String(search), mode: 'insensitive' } }
        : undefined,
      select: {
        id: true,
        name: true,
        licenseId: true,
        updatedAt: true,
        license: {
          select: { organization: { select: { name: true } } }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: 200
    });

    res.json({ success: true, data: projects });
  }

  /**
   * POST /api/admin/projects/:projectId/grants
   * Выдать (или восстановить отозванный) доступ лицензии к проекту
   */
  static async createGrant(req: Request, res: Response) {
    const { projectId } = req.params;
    const { licenseId } = req.body;

    const prisma = getPrismaClient();

    const [project, license] = await Promise.all([
      prisma.project.findUnique({ where: { id: projectId } }),
      prisma.license.findUnique({ where: { id: licenseId } })
    ]);

    if (!project) throw ApiError.notFound('Project not found');
    if (!license) throw ApiError.notFound('License not found');

    if (project.licenseId === licenseId) {
      throw ApiError.badRequest('License already owns this project');
    }

    const grant = await prisma.projectGrant.upsert({
      where: { projectId_licenseId: { projectId, licenseId } },
      update: { revokedAt: null, grantedByUserId: req.user!.id, grantedAt: new Date() },
      create: { projectId, licenseId, grantedByUserId: req.user!.id }
    });

    await AuditService.logLicenseUpdated({
      licenseId,
      userId: req.user!.id,
      changes: { grantedProjectId: projectId },
      ipAddress: req.ip
    });

    res.json({ success: true, data: grant });
  }

  /**
   * DELETE /api/admin/projects/:projectId/grants/:licenseId
   * Отозвать доступ лицензии к проекту (soft-revoke, история сохраняется)
   */
  static async revokeGrant(req: Request, res: Response) {
    const { projectId, licenseId } = req.params;

    const prisma = getPrismaClient();
    const existing = await prisma.projectGrant.findUnique({
      where: { projectId_licenseId: { projectId, licenseId } }
    });

    if (!existing || existing.revokedAt) {
      throw ApiError.notFound('Active grant not found');
    }

    const grant = await prisma.projectGrant.update({
      where: { projectId_licenseId: { projectId, licenseId } },
      data: { revokedAt: new Date() }
    });

    await AuditService.logLicenseUpdated({
      licenseId,
      userId: req.user!.id,
      changes: { revokedProjectId: projectId },
      ipAddress: req.ip
    });

    res.json({ success: true, data: grant });
  }
}
