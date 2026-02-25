// packages/shared/src/types/token.ts

import { AppType, Plan } from './index';

export interface JWTPayload {
  // License info
  licenseId: string;
  organizationId: string;
  plan: Plan;
  
  // Device info
  deviceId: string;
  app: AppType;
  
  // Features
  features: string[];
  
  // Token metadata
  iat: number; // Issued at
  exp: number; // Expires at
  jti: string; // JWT ID (для отзыва)
}

export interface TokenRefreshRequest {
  deviceId: string;
  oldToken: string;
}

export interface TokenRefreshResponse {
  success: boolean;
  token?: string;
  expiresAt?: Date;
  error?: string;
  errorCode?: string;
}

export interface TokenValidationRequest {
  token: string;
  deviceId: string;
}

export interface TokenValidationResponse {
  valid: boolean;
  payload?: JWTPayload;
  error?: string;
}

export enum TokenErrorCode {
  InvalidToken = 'INVALID_TOKEN',
  ExpiredToken = 'EXPIRED_TOKEN',
  RevokedToken = 'REVOKED_TOKEN',
  LicenseExpired = 'LICENSE_EXPIRED',
  LicenseSuspended = 'LICENSE_SUSPENDED',
  DeviceDeactivated = 'DEVICE_DEACTIVATED'
}
