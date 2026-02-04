// packages/shared/src/types/license-client.ts
// Types for License integration in Editor and Player

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

export interface ActivationResponse {
  success: boolean;
  token: string;
  expiresAt: string;
  device: {
    id: string;
    deviceId: string;
    appType: 'EDITOR' | 'PLAYER';
    deviceName: string;
  };
  license: {
    plan: 'BASIC' | 'PRO' | 'MAX';
    validUntil: string;
  };
  message?: string;
}

export interface ValidationRequest {
  token: string;
  deviceId: string;
}

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

export interface RefreshRequest {
  deviceId: string;
  oldToken: string;
}

export interface RefreshResponse {
  success: boolean;
  token: string;
  expiresAt: string;
  error?: string;
}

export interface DeactivationRequest {
  deviceId: string;
  licenseKey: string;
}

export interface DeactivationResponse {
  success: boolean;
  message: string;
  error?: string;
}

export interface LicenseToken {
  token: string;
  expiresAt: string;
  deviceId: string;
  plan: 'BASIC' | 'PRO' | 'MAX';
  appType: 'EDITOR' | 'PLAYER';
  features: string[];
  licenseId: string;
}

export enum LicenseError {
  INVALID_KEY = 'INVALID_KEY',
  EXPIRED = 'EXPIRED',
  SEAT_LIMIT = 'SEAT_LIMIT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  DEACTIVATED = 'DEACTIVATED',
  UNKNOWN = 'UNKNOWN'
}

export const LICENSE_ERROR_MESSAGES: Record<LicenseError, string> = {
  [LicenseError.INVALID_KEY]: 'Invalid license key',
  [LicenseError.EXPIRED]: 'License has expired',
  [LicenseError.SEAT_LIMIT]: 'Maximum devices reached for this license',
  [LicenseError.NETWORK_ERROR]: 'Cannot connect to license server',
  [LicenseError.DEACTIVATED]: 'Device was deactivated. Contact support.',
  [LicenseError.UNKNOWN]: 'An unknown error occurred'
};
