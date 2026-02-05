"use strict";
// packages/shared/src/utils/validation.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateLicenseKey = generateLicenseKey;
exports.isValidLicenseKeyFormat = isValidLicenseKeyFormat;
exports.isValidEmail = isValidEmail;
exports.isDateValid = isDateValid;
exports.isValidPlan = isValidPlan;
exports.isValidAppType = isValidAppType;
exports.isValidDeviceId = isValidDeviceId;
exports.sanitizeString = sanitizeString;
const types_1 = require("../types");
/**
 * Генерирует случайный license key в формате XXXX-XXXX-XXXX-XXXX
 */
function generateLicenseKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segments = 4;
    const segmentLength = 4;
    const result = [];
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
function isValidLicenseKeyFormat(key) {
    const pattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    return pattern.test(key);
}
/**
 * Проверяет валидность email
 */
function isValidEmail(email) {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return pattern.test(email);
}
/**
 * Проверяет что дата не истекла
 */
function isDateValid(date) {
    return date.getTime() > Date.now();
}
/**
 * Проверяет что план существует
 */
function isValidPlan(plan) {
    return Object.values(types_1.Plan).includes(plan);
}
/**
 * Проверяет что тип приложения существует
 */
function isValidAppType(appType) {
    return Object.values(types_1.AppType).includes(appType);
}
/**
 * Валидирует deviceId (должен быть непустой и разумной длины)
 */
function isValidDeviceId(deviceId) {
    return deviceId.length >= 10 && deviceId.length <= 256;
}
/**
 * Санитизация строки (убирает опасные символы)
 */
function sanitizeString(input) {
    return input.replace(/[<>'"]/g, '');
}
