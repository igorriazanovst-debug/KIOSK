// packages/server/src/middleware/auth.ts

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getJWTConfig } from '../config/jwt';
import { getPrismaClient } from '../config/database';

// Расширяем Request для добавления user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

/**
 * Middleware для проверки JWT токена админа
 */
export const authenticateAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No authorization token provided'
      });
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer '
    const config = getJWTConfig();
    
    // Verify token
    const decoded = jwt.verify(token, config.publicKey, {
      algorithms: [config.algorithm]
    }) as any;
    
    // Check if user exists and is admin
    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true
      }
    });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }
    
    if (user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Access denied: Admin role required'
      });
    }
    
    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role
    };
    
    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired'
      });
    }
    
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

/**
 * Опциональная аутентификация (не требует токен, но если есть - проверяет)
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    
    const token = authHeader.substring(7);
    const config = getJWTConfig();
    const decoded = jwt.verify(token, config.publicKey, {
      algorithms: [config.algorithm]
    }) as any;
    
    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true
      }
    });
    
    if (user) {
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role
      };
    }
    
    next();
  } catch (error) {
    // Если токен невалиден - просто продолжаем без user
    next();
  }
};
