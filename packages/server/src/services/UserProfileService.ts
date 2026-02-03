// packages/server/src/services/UserProfileService.ts
import { getPrismaClient } from '../config/database';

export class UserProfileService {
  /**
   * Получить или создать профиль пользователя
   */
  static async getOrCreateProfile(userId: string) {
    const prisma = getPrismaClient();

    let profile = await prisma.userProfile.findUnique({
      where: { userId }
    });

    if (!profile) {
      profile = await prisma.userProfile.create({
        data: { userId }
      });
    }

    return profile;
  }

  /**
   * Обновить настройки профиля
   */
  static async updateProfile(
    userId: string,
    updates: {
      autoSaveInterval?: number;
      theme?: string;
      language?: string;
    }
  ) {
    const prisma = getPrismaClient();

    return prisma.userProfile.upsert({
      where: { userId },
      update: updates,
      create: {
        userId,
        ...updates
      }
    });
  }

  /**
   * Обновить статистику (вызывается при создании/удалении проектов)
   */
  static async updateStats(userId: string) {
    const prisma = getPrismaClient();

    const projects = await prisma.project.findMany({
      where: { createdByUserId: userId },
      select: {
        totalStorageUsed: true
      }
    });

    const totalProjects = projects.length;
    const totalStorageUsed = projects.reduce(
      (sum, p) => sum + Number(p.totalStorageUsed),
      0
    );

    return prisma.userProfile.update({
      where: { userId },
      data: {
        totalProjects,
        totalStorageUsed: BigInt(totalStorageUsed)
      }
    });
  }

  /**
   * Получить профиль с информацией о пользователе
   */
  static async getProfileWithUser(userId: string) {
    const prisma = getPrismaClient();

    const profile = await this.getOrCreateProfile(userId);
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: {
          include: {
            licenses: {
              select: {
                plan: true,
                storageLimit: true,
                status: true
              }
            }
          }
        }
      }
    });

    return {
      profile,
      user
    };
  }
}
