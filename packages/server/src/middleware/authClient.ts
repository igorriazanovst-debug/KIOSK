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
  type: 'client' | 'license_user';
}

declare global {
  namespace Express {
    interface Request {
      client?: ClientJWTPayload;
    }
  }
}

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
      }) as any;

      // Принимаем токены типа 'client' (лицензионный ключ) и 'license_user' (email+password)
      if (payload.type !== 'client' && payload.type !== 'license_user') {
        return res.status(403).json({
          error: 'Invalid token type',
          message: 'This endpoint requires a client or license_user token'
        });
      }

      // Нормализуем payload в единый формат req.client
      req.client = {
        licenseId: payload.licenseId,
        organizationId: payload.organizationId,
        userId: payload.userId || payload.licenseUserId,
        type: payload.type,
      };

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

export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);

    try {
      const payload = jwt.verify(token, publicKey, {
        algorithms: ['RS256']
      }) as any;

      if (payload.type === 'client' || payload.type === 'license_user') {
        req.client = {
          licenseId: payload.licenseId,
          organizationId: payload.organizationId,
          userId: payload.userId || payload.licenseUserId,
          type: payload.type,
        };
      }
    } catch (jwtError) {
      console.warn('Invalid token in optional auth:', jwtError);
    }

    next();
  } catch (error) {
    console.error('Optional auth error:', error);
    next();
  }
};
