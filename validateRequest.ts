// packages/server/src/middleware/validateRequest.ts

import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';

/**
 * Middleware для обработки результатов валидации
 */
export const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.type === 'field' ? (err as any).path : undefined,
        message: err.msg
      }))
    });
  }
  
  next();
};

/**
 * Обёртка для цепочки валидаторов
 */
export const validateWith = (validators: ValidationChain[]) => {
  return [...validators, validate];
};
