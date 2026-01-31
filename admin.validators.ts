// packages/server/src/validators/admin.validators.ts

import { body, param, query } from 'express-validator';

/**
 * Валидаторы для входа админа
 */
export const loginValidators = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  
  body('password')
    .isString()
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
];

/**
 * Валидаторы для создания лицензии
 */
export const createLicenseValidators = [
  body('organizationId')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Organization ID is required')
    .isUUID()
    .withMessage('Organization ID must be a valid UUID'),
  
  body('plan')
    .isString()
    .toUpperCase()
    .isIn(['BASIC', 'PRO', 'MAX'])
    .withMessage('Plan must be BASIC, PRO, or MAX'),
  
  body('validUntil')
    .isISO8601()
    .withMessage('Valid until must be a valid date')
    .custom((value) => {
      const date = new Date(value);
      if (date <= new Date()) {
        throw new Error('Valid until must be in the future');
      }
      return true;
    }),
  
  body('seatsEditor')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Seats editor must be a positive integer'),
  
  body('seatsPlayer')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Seats player must be a positive integer')
];

/**
 * Валидаторы для обновления лицензии
 */
export const updateLicenseValidators = [
  param('id')
    .isUUID()
    .withMessage('License ID must be a valid UUID'),
  
  body('status')
    .optional()
    .isString()
    .toUpperCase()
    .isIn(['ACTIVE', 'SUSPENDED', 'EXPIRED', 'CANCELLED'])
    .withMessage('Status must be ACTIVE, SUSPENDED, EXPIRED, or CANCELLED'),
  
  body('validUntil')
    .optional()
    .isISO8601()
    .withMessage('Valid until must be a valid date'),
  
  body('plan')
    .optional()
    .isString()
    .toUpperCase()
    .isIn(['BASIC', 'PRO', 'MAX'])
    .withMessage('Plan must be BASIC, PRO, or MAX')
];

/**
 * Валидаторы для получения списка лицензий
 */
export const getLicensesValidators = [
  query('status')
    .optional()
    .isString()
    .toUpperCase()
    .isIn(['ACTIVE', 'SUSPENDED', 'EXPIRED', 'CANCELLED'])
    .withMessage('Status must be ACTIVE, SUSPENDED, EXPIRED, or CANCELLED'),
  
  query('plan')
    .optional()
    .isString()
    .toUpperCase()
    .isIn(['BASIC', 'PRO', 'MAX'])
    .withMessage('Plan must be BASIC, PRO, or MAX'),
  
  query('search')
    .optional()
    .isString()
    .trim(),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

/**
 * Валидаторы для получения списка устройств
 */
export const getDevicesValidators = [
  query('status')
    .optional()
    .isString()
    .toUpperCase()
    .isIn(['ACTIVE', 'DEACTIVATED'])
    .withMessage('Status must be ACTIVE or DEACTIVATED'),
  
  query('appType')
    .optional()
    .isString()
    .toUpperCase()
    .isIn(['EDITOR', 'PLAYER'])
    .withMessage('App type must be EDITOR or PLAYER'),
  
  query('licenseId')
    .optional()
    .isUUID()
    .withMessage('License ID must be a valid UUID'),
  
  query('search')
    .optional()
    .isString()
    .trim(),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

/**
 * Валидаторы для параметров UUID
 */
export const uuidParamValidators = [
  param('id')
    .isUUID()
    .withMessage('ID must be a valid UUID')
];

/**
 * Валидаторы для audit logs
 */
export const getAuditLogsValidators = [
  query('action')
    .optional()
    .isString()
    .trim(),
  
  query('userId')
    .optional()
    .isUUID()
    .withMessage('User ID must be a valid UUID'),
  
  query('licenseId')
    .optional()
    .isUUID()
    .withMessage('License ID must be a valid UUID'),
  
  query('deviceId')
    .optional()
    .isString()
    .trim(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage('Limit must be between 1 and 500'),
  
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer')
];
