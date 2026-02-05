import { AppType, Plan } from '../types';
/**
 * Генерирует случайный license key в формате XXXX-XXXX-XXXX-XXXX
 */
export declare function generateLicenseKey(): string;
/**
 * Проверяет формат license key
 */
export declare function isValidLicenseKeyFormat(key: string): boolean;
/**
 * Проверяет валидность email
 */
export declare function isValidEmail(email: string): boolean;
/**
 * Проверяет что дата не истекла
 */
export declare function isDateValid(date: Date): boolean;
/**
 * Проверяет что план существует
 */
export declare function isValidPlan(plan: string): plan is Plan;
/**
 * Проверяет что тип приложения существует
 */
export declare function isValidAppType(appType: string): appType is AppType;
/**
 * Валидирует deviceId (должен быть непустой и разумной длины)
 */
export declare function isValidDeviceId(deviceId: string): boolean;
/**
 * Санитизация строки (убирает опасные символы)
 */
export declare function sanitizeString(input: string): string;
//# sourceMappingURL=validation.d.ts.map