// packages/shared/src/types/license-client.ts
// Types for License integration in Editor and Player

/**
 * License activation request
 */
export interface ActivationRequest {
  licenseKey: string;
  deviceId: string;
  appType: 'editor' | 'player';
  deviceName: string;
  osInfo?: {
    platform: string;
    release: string;
    arch: string;
  };
}

/**
 * License activation response
 */
export interface ActivationResponse {
  success: boolean;
  token: string;
  expiresAt: string;
  device: {
    id: string;
    deviceId: string;
    appType: 'EDITOR' | 'PLAYER';
    deviceName: string;
    status: string;
  };
  license: {
    id: string;
    plan: 'BASIC' | 'PRO' | 'MAX';
    seatsEditor: number;
    seatsPlayer: number;
    validUntil: string;
  };
  message?: string;
}

/**
 * Token validation request
 */
export interface ValidationRequest {
  token: string;
  deviceId: string;
}

/**
 * Token validation response
 */
export interface ValidationResponse {
  valid: boolean;
  payload?: {
    licenseId: string;
    organizationId: string;
    deviceId: string;
    plan: 'basic' | 'pro' | 'max';
    app: 'editor' | 'player';
    features: string[];
    expiresAt: string;
  };
  error?: string;
}

/**
 * Token refresh request
 */
export interface RefreshRequest {
  deviceId: string;
  oldToken: string;
}

/**
 * Token refresh response
 */
export interface RefreshResponse {
  success: boolean;
  token: string;
  expiresAt: string;
  error?: string;
}

/**
 * Deactivation request
 */
export interface DeactivationRequest {
  deviceId: string;
  licenseKey: string;
}

/**
 * Deactivation response
 */
export interface DeactivationResponse {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * License token data (stored locally)
 */
export interface LicenseToken {
  token: string;
  expiresAt: string;
  deviceId: string;
  plan: 'BASIC' | 'PRO' | 'MAX';
  appType: 'EDITOR' | 'PLAYER';
  features: string[];
  licenseId: string;
}

/**
 * License info (UI display)
 */
export interface LicenseInfo {
  plan: 'BASIC' | 'PRO' | 'MAX';
  features: string[];
  validUntil: string;
  seatsEditor: number;
  seatsPlayer: number;
  status: 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';
}

/**
 * License error types
 */
export enum LicenseError {
  INVALID_KEY = 'INVALID_KEY',
  EXPIRED = 'EXPIRED',
  SEAT_LIMIT = 'SEAT_LIMIT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  DEACTIVATED = 'DEACTIVATED',
  UNKNOWN = 'UNKNOWN'
}

/**
 * License error messages
 */
export const LICENSE_ERROR_MESSAGES: Record<LicenseError, string> = {
  [LicenseError.INVALID_KEY]: 'Invalid license key',
  [LicenseError.EXPIRED]: 'License has expired',
  [LicenseError.SEAT_LIMIT]: 'Maximum devices reached for this license',
  [LicenseError.NETWORK_ERROR]: 'Cannot connect to license server',
  [LicenseError.DEACTIVATED]: 'Device was deactivated',
  [LicenseError.UNKNOWN]: 'An unknown error occurred'
};

/**
 * Plan features mapping
 */
export interface PlanFeatures {
  editPredefinedTemplates: boolean;
  createCustomTemplates: boolean;
  advancedExport: boolean;
  cloudStorage: boolean;
  teamCollaboration: boolean;
  prioritySupport: boolean;
  maxEditorDevices: number;
  maxPlayerDevices: number;
}

/**
 * Plan features constants
 */
export const PLAN_FEATURES: Record<'BASIC' | 'PRO' | 'MAX', PlanFeatures> = {
  BASIC: {
    editPredefinedTemplates: true,
    createCustomTemplates: false,
    advancedExport: false,
    cloudStorage: false,
    teamCollaboration: false,
    prioritySupport: false,
    maxEditorDevices: 1,
    maxPlayerDevices: 3
  },
  PRO: {
    editPredefinedTemplates: true,
    createCustomTemplates: true,
    advancedExport: true,
    cloudStorage: true,
    teamCollaboration: true,
    prioritySupport: true,
    maxEditorDevices: 5,
    maxPlayerDevices: 10
  },
  MAX: {
    editPredefinedTemplates: true,
    createCustomTemplates: true,
    advancedExport: true,
    cloudStorage: true,
    teamCollaboration: true,
    prioritySupport: true,
    maxEditorDevices: 20,
    maxPlayerDevices: 50
  }
};

/**
 * Get features for a plan
 */
export function getPlanFeatures(plan: 'BASIC' | 'PRO' | 'MAX'): PlanFeatures {
  return PLAN_FEATURES[plan];
}

/**
 * Check if feature is available
 */
export function hasFeature(
  plan: 'BASIC' | 'PRO' | 'MAX',
  feature: keyof PlanFeatures
): boolean {
  const features = PLAN_FEATURES[plan];
  return features[feature] as boolean;
}

/**
 * License status helper
 */
export interface LicenseStatus {
  isLicensed: boolean;
  isExpired: boolean;
  expiresIn: number; // days
  needsRefresh: boolean; // true if < 24 hours
}

/**
 * Calculate license status
 */
export function getLicenseStatus(token: LicenseToken): LicenseStatus {
  const now = new Date().getTime();
  const expiresAt = new Date(token.expiresAt).getTime();
  const diff = expiresAt - now;
  const daysRemaining = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hoursRemaining = Math.floor(diff / (1000 * 60 * 60));
  
  return {
    isLicensed: diff > 0,
    isExpired: diff <= 0,
    expiresIn: daysRemaining,
    needsRefresh: hoursRemaining < 24
  };
}
