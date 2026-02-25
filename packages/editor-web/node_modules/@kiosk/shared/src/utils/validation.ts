// packages/shared/src/utils/validation.ts

import { AppType, Plan } from '../types';

/**
 * Генерирует случайный license key в формате XXXX-XXXX-XXXX-XXXX
 */
export function generateLicenseKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segments = 4;
  const segmentLength = 4;
  
  const result: string[] = [];
  
  for (let i = 0; i < segments; i++) {
    let segment = '';
    for (let j = 0; j < segmentLength; j++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    result.push(segment);
  }
  
  return result.join('-');
}

/**
 * Проверяет формат license key
 */
export function isValidLicenseKeyFormat(key: string): boolean {
  const pattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  return pattern.test(key);
}

/**
 * Проверяет валидность email
 */
export function isValidEmail(email: string): boolean {
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern.test(email);
}

/**
 * Проверяет что дата не истекла
 */
export function isDateValid(date: Date): boolean {
  return date.getTime() > Date.now();
}

/**
 * Проверяет что план существует
 */
export function isValidPlan(plan: string): plan is Plan {
  return Object.values(Plan).includes(plan as Plan);
}

/**
 * Проверяет что тип приложения существует
 */
export function isValidAppType(appType: string): appType is AppType {
  return Object.values(AppType).includes(appType as AppType);
}

/**
 * Валидирует deviceId (должен быть непустой и разумной длины)
 */
export function isValidDeviceId(deviceId: string): boolean {
  return deviceId.length >= 10 && deviceId.length <= 256;
}

/**
 * Санитизация строки (убирает опасные символы)
 */
export function sanitizeString(input: string): string {
  return input.replace(/[<>'"]/g, '');
}
