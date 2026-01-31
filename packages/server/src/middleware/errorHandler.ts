// packages/server/src/middleware/errorHandler.ts

import { Request, Response, NextFunction } from 'express';

/**
 * Кастомный класс ошибки API
 */
export class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;
  
  constructor(statusCode: number, message: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    
    Error.captureStackTrace(this, this.constructor);
  }
  
  static badRequest(message: string) {
    return new ApiError(400, message);
  }
  
  static unauthorized(message: string = 'Unauthorized') {
    return new ApiError(401, message);
  }
  
  static forbidden(message: string = 'Forbidden') {
    return new ApiError(403, message);
  }
  
  static notFound(message: string = 'Not found') {
    return new ApiError(404, message);
  }
  
  static conflict(message: string) {
    return new ApiError(409, message);
  }
  
  static tooManyRequests(message: string = 'Too many requests') {
    return new ApiError(429, message);
  }
  
  static internal(message: string = 'Internal server error') {
    return new ApiError(500, message, false);
  }
}

/**
 * Middleware для обработки ошибок
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      ...(process.env.NODE_ENV === 'development' && {
        stack: err.stack
      })
    });
  }
  
  // Неожиданные ошибки
  console.error('Unhandled error:', err);
  
  return res.status(500).json({
    success: false,
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && {
      message: err.message,
      stack: err.stack
    })
  });
};

/**
 * Middleware для обработки 404
 */
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path,
    method: req.method
  });
};

/**
 * Async handler wrapper для автоматической обработки ошибок
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
