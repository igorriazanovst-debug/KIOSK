// packages/server/src/validators/license.validators.ts

import { body, param, query } from 'express-validator';

/**
 * Валидаторы для активации лицензии
 */
export const activateValidators = [
  body('licenseKey')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('License key is required')
    .isLength({ min: 19, max: 19 })
    .withMessage('License key must be 19 characters'),
  
  body('deviceId')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Device ID is required')
    .isLength({ min: 1, max: 255 })
    .withMessage('Device ID must be between 1 and 255 characters'),
  
  body('appType')
    .isString()
    .trim()
    .toLowerCase()
    .isIn(['editor', 'player'])
    .withMessage('App type must be either "editor" or "player"'),
  
  body('deviceName')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Device name must not exceed 255 characters'),
  
  body('osInfo')
    .optional()
    .isObject()
    .withMessage('OS info must be an object')
];

/**
 * Валидаторы для обновления токена
 */
export const refreshValidators = [
  body('deviceId')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Device ID is required'),
  
  body('oldToken')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Old token is required')
];

/**
 * Валидаторы для проверки токена
 */
export const validateValidators = [
  body('token')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Token is required'),
  
  body('deviceId')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Device ID is required')
];

/**
 * Валидаторы для деактивации
 */
export const deactivateValidators = [
  body('deviceId')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Device ID is required'),
  
  body('licenseKey')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('License key is required')
];
