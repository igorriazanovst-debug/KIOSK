// packages/server/src/services/FileService.ts
import { getPrismaClient } from '../config/database';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export class FileService {
  private static UPLOAD_DIR = process.env.UPLOAD_DIR || '/opt/kiosk/uploads';

  /**
   * Получить тип файла по MIME
   */
  private static getFileType(mimeType: string): 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'OTHER' {
    if (mimeType.startsWith('image/')) return 'IMAGE';
    if (mimeType.startsWith('video/')) return 'VIDEO';
    if (mimeType.startsWith('audio/')) return 'AUDIO';
    if (mimeType.includes('pdf') || mimeType.includes('document')) return 'DOCUMENT';
    return 'OTHER';
  }

  /**
   * Создать директорию для проекта если не существует
   */
  private static async ensureProjectDirectory(projectId: string) {
    const projectDir = path.join(this.UPLOAD_DIR, 'projects', projectId);
    await fs.mkdir(projectDir, { recursive: true });
    return projectDir;
  }

  /**
   * Загрузить файл
   */
  static async uploadFile(params: {
    projectId: string;
    organizationId: string;
    fileName: string;
    mimeType: string;
    fileBuffer: Buffer;
    width?: number;
    height?: number;
    duration?: number;
  }) {
    const prisma = getPrismaClient();

    // Проверяем что проект существует и принадлежит организации
    const project = await prisma.project.findFirst({
      where: {
        id: params.projectId,
        organizationId: params.organizationId
      }
    });

    if (!project) {
      throw new Error('Project not found or access denied');
    }

    // Генерируем уникальный ID для файла
    const fileId = crypto.randomUUID();
    const ext = path.extname(params.fileName);
    const storageName = `${fileId}${ext}`;

    // Создаём директорию проекта
    const projectDir = await this.ensureProjectDirectory(params.projectId);
    const storagePath = path.join('projects', params.projectId, storageName);
    const fullPath = path.join(this.UPLOAD_DIR, storagePath);

    // Сохраняем файл на диск
    await fs.writeFile(fullPath, params.fileBuffer);

    // Создаём запись в БД
    const file = await prisma.projectFile.create({
      data: {
        id: fileId,
        projectId: params.projectId,
        fileName: params.fileName,
        fileType: this.getFileType(params.mimeType),
        mimeType: params.mimeType,
        fileSize: BigInt(params.fileBuffer.length),
        storagePath,
        url: `/api/projects/${params.projectId}/files/${fileId}`,
        width: params.width,
        height: params.height,
        duration: params.duration
      }
    });

    return file;
  }

  /**
   * Получить список файлов проекта
   */
  static async getProjectFiles(projectId: string, organizationId: string) {
    const prisma = getPrismaClient();

    // Проверяем доступ
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId
      }
    });

    if (!project) {
      throw new Error('Project not found or access denied');
    }

    const files = await prisma.projectFile.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' }
    });

    return files;
  }

  /**
   * Получить файл по ID
   */
  static async getFileById(fileId: string, projectId: string, organizationId?: string) {
    const prisma = getPrismaClient();

    const file = await prisma.projectFile.findFirst({
      where: {
        id: fileId,
        projectId,
        project: organizationId ? { organizationId } : {}
      }
    });

    return file;
  }

  /**
   * Получить путь к файлу на диске
   */
  static getFilePath(storagePath: string): string {
    return path.join(this.UPLOAD_DIR, storagePath);
  }

  /**
   * Удалить файл
   */
  static async deleteFile(fileId: string, projectId: string, organizationId: string) {
    const prisma = getPrismaClient();

    // Получаем файл
    const file = await this.getFileById(fileId, projectId, organizationId);
    if (!file) {
      throw new Error('File not found or access denied');
    }

    // Удаляем файл с диска
    const fullPath = this.getFilePath(file.storagePath);
    try {
      await fs.unlink(fullPath);
    } catch (error) {
      console.error('Error deleting file from disk:', error);
      // Продолжаем даже если файл на диске не найден
    }

    // Удаляем запись из БД
    await prisma.projectFile.delete({
      where: { id: fileId }
    });

    return { success: true };
  }

  /**
   * Удалить все файлы проекта
   */
  static async deleteAllProjectFiles(projectId: string) {
    const prisma = getPrismaClient();

    const files = await prisma.projectFile.findMany({
      where: { projectId }
    });

    // Удаляем файлы с диска
    for (const file of files) {
      const fullPath = this.getFilePath(file.storagePath);
      try {
        await fs.unlink(fullPath);
      } catch (error) {
        console.error(`Error deleting file ${file.id}:`, error);
      }
    }

    // Удаляем директорию проекта
    const projectDir = path.join(this.UPLOAD_DIR, 'projects', projectId);
    try {
      await fs.rm(projectDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Error deleting project directory:', error);
    }

    // Удаляем записи из БД
    await prisma.projectFile.deleteMany({
      where: { projectId }
    });

    return { success: true };
  }

  /**
   * Обновить счётчик использования файла
   */
  static async incrementUsageCount(fileId: string) {
    const prisma = getPrismaClient();

    return prisma.projectFile.update({
      where: { id: fileId },
      data: {
        usageCount: {
          increment: 1
        }
      }
    });
  }

  /**
   * Получить статистику использования хранилища для организации
   */
  static async getStorageStats(organizationId: string) {
    const prisma = getPrismaClient();

    const projects = await prisma.project.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        totalStorageUsed: true,
        totalFiles: true
      }
    });

    const totalStorage = projects.reduce((sum, p) => sum + Number(p.totalStorageUsed), 0);
    const totalFiles = projects.reduce((sum, p) => sum + p.totalFiles, 0);

    // Получаем лимит из лицензии
    const license = await prisma.license.findFirst({
      where: { organizationId },
      select: { storageLimit: true }
    });

    return {
      totalStorage,
      totalFiles,
      storageLimit: license ? Number(license.storageLimit) : 0,
      remaining: license ? Math.max(0, Number(license.storageLimit) - totalStorage) : 0,
      projects: projects.map(p => ({
        id: p.id,
        name: p.name,
        storageUsed: Number(p.totalStorageUsed),
        fileCount: p.totalFiles
      }))
    };
  }
}
