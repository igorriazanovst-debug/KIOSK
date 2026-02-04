import { AppType, Plan } from './index';
export interface JWTPayload {
    licenseId: string;
    organizationId: string;
    plan: Plan;
    deviceId: string;
    app: AppType;
    features: string[];
    iat: number;
    exp: number;
    jti: string;
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
export declare enum TokenErrorCode {
    InvalidToken = "INVALID_TOKEN",
    ExpiredToken = "EXPIRED_TOKEN",
    RevokedToken = "REVOKED_TOKEN",
    LicenseExpired = "LICENSE_EXPIRED",
    LicenseSuspended = "LICENSE_SUSPENDED",
    DeviceDeactivated = "DEVICE_DEACTIVATED"
}
//# sourceMappingURL=token.d.ts.map