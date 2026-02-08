// packages/server/src/controllers/FileController.ts
import { Request, Response } from 'express';
import { FileService } from '../services/FileService';
import { ProjectService } from '../services/ProjectService';
import { createAuditLog } from '../services/AuditService';
import fs from 'fs/promises';

export class FileController {
      /**
   * GET /api/projects/:projectId/files/:fileId
   * Скачать файл (публичный доступ)
   * 
   * Этот метод НЕ проверяет req.client, так как используется для:
   * 1. <video> элементов в браузере (не могут передать токен)
   * 2. <img> элементов для изображений
   * 3. Любых медиа-файлов, которые браузер загружает напрямую
   * 
   * Безопасность обеспечивается через:
   * - UUID файла (сложно угадать)
   * - Привязка к projectId (дополнительная проверка)
   */
  static async downloadFile(req: Request, res: Response) {
    try {
      const { projectId, fileId } = req.params;

      // Ищем файл без проверки organizationId (публичный доступ)
      const file = await FileService.getFileById(fileId, projectId);

      if (!file) {
        return res.status(404).json({
          error: 'File not found',
          message: 'File does not exist'
        });
      }

      // Получаем путь к файлу на диске
      const filePath = FileService.getFilePath(file.storagePath);

      // Проверяем что файл существует
      const fs = require('fs').promises;
      try {
        await fs.access(filePath);
      } catch {
        return res.status(404).json({
          error: 'File not found on disk',
          message: 'The file exists in database but not on disk'
        });
      }

      // Увеличиваем счётчик использования (асинхронно, не блокируем ответ)
      FileService.incrementUsageCount(fileId).catch(console.error);

      // Устанавливаем заголовки для корректного отображения медиа
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.fileName)}"`);
      res.setHeader('Content-Length', file.fileSize.toString());
      
      // CORS заголовки для кросс-доменных запросов (если нужно)
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      
      // Cache control для оптимизации загрузки
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 год
      
      // Поддержка Range requests для видео (перемотка)
      res.setHeader('Accept-Ranges', 'bytes');

      // Отправляем файл
      return res.sendFile(filePath);

    } catch (error) {
      console.error('Download file error:', error);
      return res.status(500).json({
        error: 'Failed to download file',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  /**
   * DELETE /api/projects/:projectId/files/:fileId
   * Удалить файл
   */
  static async deleteFile(req: Request, res: Response) {
    try {
      if (!req.client) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { projectId, fileId } = req.params;

      await FileService.deleteFile(fileId, projectId, req.client.organizationId);

      // Обновляем статистику проекта
      await ProjectService.updateProjectStats(projectId);

      await createAuditLog({
        action: 'file_deleted',
        userId: req.client.userId,
        licenseId: req.client.licenseId,
        details: {
          projectId,
          fileId
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.json({
        success: true,
        message: 'File deleted successfully'
      });

    } catch (error) {
      console.error('Delete file error:', error);

      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({
          error: 'File not found',
          message: error.message
        });
      }

      return res.status(500).json({
        error: 'Failed to delete file',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/storage/stats
   * Получить статистику использования хранилища
   */
  static async getStorageStats(req: Request, res: Response) {
    try {
      if (!req.client) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const stats = await FileService.getStorageStats(req.client.organizationId);

      return res.json({
        success: true,
        storage: {
          used: stats.totalStorage,
          limit: stats.storageLimit,
          remaining: stats.remaining,
          usedPercentage: Math.round((stats.totalStorage / stats.storageLimit) * 100),
          totalFiles: stats.totalFiles
        },
        projects: stats.projects
      });

    } catch (error) {
      console.error('Get storage stats error:', error);
      return res.status(500).json({
        error: 'Failed to get storage stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
