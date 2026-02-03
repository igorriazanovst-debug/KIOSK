// packages/server/src/middleware/authClient.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

const publicKey = fs.readFileSync(path.join(__dirname, '../../keys/public.key'), 'utf8');

interface ClientJWTPayload {
  licenseId: string;
  organizationId: string;
  userId?: string;
  type: 'client';
}

// Расширяем Request для TypeScript
declare global {
  namespace Express {
    interface Request {
      client?: ClientJWTPayload;
    }
  }
}

/**
 * Middleware для проверки JWT токена клиента
 */
export const authenticateClient = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Missing or invalid authorization header'
      });
    }

    const token = authHeader.substring(7);

    try {
      const payload = jwt.verify(token, publicKey, {
        algorithms: ['RS256']
      }) as ClientJWTPayload;

      // Проверяем что это токен клиента (не админа)
      if (payload.type !== 'client') {
        return res.status(403).json({
          error: 'Invalid token type',
          message: 'This endpoint requires a client token'
        });
      }

      // Добавляем payload в request
      req.client = payload;
      next();
    } catch (jwtError: any) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Token expired',
          message: 'Your session has expired. Please login again.'
        });
      }

      return res.status(401).json({
        error: 'Invalid token',
        message: 'Failed to authenticate token'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred during authentication'
    });
  }
};

/**
 * Опциональная аутентификация (не требует токен, но если есть - проверяет)
 */
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Токена нет - продолжаем без аутентификации
      return next();
    }

    const token = authHeader.substring(7);

    try {
      const payload = jwt.verify(token, publicKey, {
        algorithms: ['RS256']
      }) as ClientJWTPayload;

      if (payload.type === 'client') {
        req.client = payload;
      }
    } catch (jwtError) {
      // Токен невалидный - игнорируем и продолжаем
      console.warn('Invalid token in optional auth:', jwtError);
    }

    next();
  } catch (error) {
    console.error('Optional auth error:', error);
    next();
  }
};
