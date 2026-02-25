export declare enum AppType {
    Editor = "editor",
    Player = "player"
}
export declare enum DeviceStatus {
    Active = "active",
    Deactivated = "deactivated"
}
export interface Device {
    id: string;
    deviceId: string;
    licenseId: string;
    appType: AppType;
    deviceName: string;
    osInfo: string;
    status: DeviceStatus;
    activatedAt: Date;
    deactivatedAt?: Date;
    lastSeenAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
export interface CreateDeviceInput {
    deviceId: string;
    licenseId: string;
    appType: AppType;
    deviceName: string;
    osInfo: string;
}
export interface DeviceActivationRequest {
    licenseKey: string;
    deviceId: string;
    appType: AppType;
    deviceName: string;
    osInfo: string;
}
export interface DeviceActivationResponse {
    success: boolean;
    token?: string;
    expiresAt?: Date;
    error?: string;
    errorCode?: string;
}
//# sourceMappingURL=device.d.ts.map