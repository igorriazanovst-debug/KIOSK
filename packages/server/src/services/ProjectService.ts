// packages/server/src/services/ProjectService.ts
import { getPrismaClient } from '../config/database';

export class ProjectService {
  /**
   * Создать новый проект
   */
  static async createProject(params: {
    name: string;
    description?: string;
    licenseId: string;
    organizationId: string;
    createdByUserId: string;
    projectData: any;
    canvasWidth?: number;
    canvasHeight?: number;
    canvasBackground?: string;
    tags?: string[];
  }) {
    const prisma = getPrismaClient();

    const project = await prisma.project.create({
      data: {
        name: params.name,
        description: params.description,
        licenseId: params.licenseId,
        organizationId: params.organizationId,
        createdByUserId: params.createdByUserId,
        projectData: params.projectData,
        canvasWidth: params.canvasWidth || 1920,
        canvasHeight: params.canvasHeight || 1080,
        canvasBackground: params.canvasBackground || '#1a1a1a',
        tags: params.tags || []
      },
      include: {
        license: true,
        organization: true,
        createdByUser: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });

    return project;
  }

  /**
   * Получить список проектов организации
   */
  static async getProjectsByOrganization(organizationId: string, filters?: {
    search?: string;
    tags?: string[];
    isPublished?: boolean;
  }) {
    const prisma = getPrismaClient();

    const where: any = {
      organizationId
    };

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    if (filters?.tags && filters.tags.length > 0) {
      where.tags = {
        hasSome: filters.tags
      };
    }

    if (filters?.isPublished !== undefined) {
      where.isPublished = filters.isPublished;
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        createdByUser: {
          select: {
            id: true,
            email: true
          }
        },
        _count: {
          select: {
            files: true
          }
        }
      },
      orderBy: {
        lastEditedAt: 'desc'
      }
    });

    return projects;
  }

  /**
   * Получить проект по ID
   */
  static async getProjectById(projectId: string, organizationId: string) {
    const prisma = getPrismaClient();

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId
      },
      include: {
        license: true,
        organization: true,
        createdByUser: {
          select: {
            id: true,
            email: true
          }
        },
        files: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    return project;
  }

  /**
   * Обновить проект
   */
  static async updateProject(
    projectId: string,
    organizationId: string,
    updates: {
      name?: string;
      description?: string;
      projectData?: any;
      canvasWidth?: number;
      canvasHeight?: number;
      canvasBackground?: string;
      tags?: string[];
      thumbnail?: string;
      isPublished?: boolean;
    }
  ) {
    const prisma = getPrismaClient();

    // Проверяем что проект принадлежит организации
    const existing = await this.getProjectById(projectId, organizationId);
    if (!existing) {
      throw new Error('Project not found or access denied');
    }

    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        ...updates,
        lastEditedAt: new Date(),
        publishedAt: updates.isPublished && !existing.isPublished ? new Date() : existing.publishedAt
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });

    return project;
  }

  /**
   * Удалить проект
   */
  static async deleteProject(projectId: string, organizationId: string) {
    const prisma = getPrismaClient();

    // Проверяем что проект принадлежит организации
    const existing = await this.getProjectById(projectId, organizationId);
    if (!existing) {
      throw new Error('Project not found or access denied');
    }

    // Удаляем проект (файлы удалятся каскадно благодаря onDelete: Cascade)
    await prisma.project.delete({
      where: { id: projectId }
    });

    return { success: true };
  }

  /**
   * Обновить статистику проекта (размер, количество файлов)
   */
  static async updateProjectStats(projectId: string) {
    const prisma = getPrismaClient();

    const files = await prisma.projectFile.findMany({
      where: { projectId },
      select: { fileSize: true }
    });

    const totalFiles = files.length;
    const totalStorageUsed = files.reduce((sum, f) => sum + Number(f.fileSize), 0);

    return prisma.project.update({
      where: { id: projectId },
      data: {
        totalFiles,
        totalStorageUsed: BigInt(totalStorageUsed)
      }
    });
  }

  /**
   * Проверить лимит хранилища для лицензии
   */
  static async checkStorageLimit(licenseId: string, additionalSize: number): Promise<{
    allowed: boolean;
    currentUsage: number;
    limit: number;
    remaining: number;
  }> {
    const prisma = getPrismaClient();

    const license = await prisma.license.findUnique({
      where: { id: licenseId },
      include: {
        projects: {
          select: {
            totalStorageUsed: true
          }
        }
      }
    });

    if (!license) {
      throw new Error('License not found');
    }

    const currentUsage = license.projects.reduce(
      (sum, p) => sum + Number(p.totalStorageUsed),
      0
    );

    const limit = Number(license.storageLimit);
    const newUsage = currentUsage + additionalSize;
    const allowed = newUsage <= limit;

    return {
      allowed,
      currentUsage,
      limit,
      remaining: Math.max(0, limit - currentUsage)
    };
  }

  /**
   * Увеличить счётчик просмотров
   */
  static async incrementViewCount(projectId: string) {
    const prisma = getPrismaClient();

    return prisma.project.update({
      where: { id: projectId },
      data: {
        viewCount: {
          increment: 1
        }
      }
    });
  }
}
