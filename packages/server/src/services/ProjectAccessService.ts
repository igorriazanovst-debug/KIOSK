// packages/server/src/services/ProjectAccessService.ts
// Единая проверка "лицензия владеет проектом ИЛИ имеет активный грант" —
// используется везде, где нужно решить, может ли licenseId работать с
// projectId (активация плеера, живое обновление контента, переподключение
// устройства). Раньше эта проверка была продублирована по месту в каждом
// контроллере; вынесена сюда, когда появился третий вызывающий.
//
// builds.js (packages/server/src/routes/builds.js) — не TS-файл, копируется
// в dist как есть без компиляции tsc — держит свою локальную копию этой же
// логики (licenseOwnsOrIsGrantedProject) вместо импорта отсюда, чтобы не
// городить ESM/CJS interop ради одной проверки.

import { getPrismaClient } from '../config/database';

export class ProjectAccessService {
  static async licenseHasAccess(licenseId: string, projectId: string): Promise<boolean> {
    const prisma = getPrismaClient();
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { licenseId },
          { grants: { some: { licenseId, revokedAt: null } } }
        ]
      }
    });
    return !!project;
  }
}
