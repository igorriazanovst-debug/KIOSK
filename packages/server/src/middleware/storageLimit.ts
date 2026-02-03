// packages/server/src/middleware/storageLimit.ts
import { Request, Response, NextFunction } from 'express';
import { ProjectService } from '../services/ProjectService';

/**
 * Middleware для проверки лимита хранилища перед загрузкой файла
 */
export const checkStorageLimit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.client) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    // Получаем размер загружаемого файла
    const fileSize = req.headers['content-length'];
    if (!fileSize) {
      return res.status(400).json({
        error: 'Content-Length header required'
      });
    }

    const fileSizeBytes = parseInt(fileSize, 10);

    // Проверяем лимит
    const storageCheck = await ProjectService.checkStorageLimit(
      req.client.licenseId,
      fileSizeBytes
    );

    if (!storageCheck.allowed) {
      return res.status(413).json({
        error: 'Storage limit exceeded',
        message: 'Your storage limit has been reached',
        details: {
          currentUsage: storageCheck.currentUsage,
          limit: storageCheck.limit,
          remaining: storageCheck.remaining,
          requestedSize: fileSizeBytes
        }
      });
    }

    // Добавляем информацию о хранилище в request для логирования
    (req as any).storageCheck = storageCheck;

    next();
  } catch (error) {
    console.error('Storage limit check error:', error);
    return res.status(500).json({
      error: 'Failed to check storage limit',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Middleware для логирования информации о хранилище после успешной загрузки
 */
export const logStorageUsage = (req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json.bind(res);

  res.json = function (body: any) {
    // Если запрос успешный, добавляем информацию о хранилище
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const storageCheck = (req as any).storageCheck;
      if (storageCheck) {
        body.storage = {
          used: storageCheck.currentUsage,
          limit: storageCheck.limit,
          remaining: storageCheck.remaining,
          usedPercentage: Math.round((storageCheck.currentUsage / storageCheck.limit) * 100)
        };
      }
    }

    return originalJson(body);
  };

  next();
};
