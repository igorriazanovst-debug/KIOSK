// packages/player/src/services/LicenseService.ts
// License management service for Player (Electron app)

import type {
  ActivationRequest,
  ActivationResponse,
  ValidationRequest,
  ValidationResponse,
  RefreshRequest,
  RefreshResponse,
  DeactivationRequest,
  DeactivationResponse,
  LicenseToken,
  LicenseStatus,
  PlanFeatures
} from '@kiosk/shared';
import { getLicenseStatus, getPlanFeatures } from '@kiosk/shared';

/**
 * License Service for Player
 * Manages license activation, validation, and token refresh in Electron
 */
export class LicenseService {
  private static readonly API_BASE =
    import.meta.env.VITE_LICENSE_SERVER_URL || 'http://localhost:3001';
  private static readonly STORAGE_KEY = 'kiosk_license_token';
  private static readonly DEVICE_ID_KEY = 'kiosk_device_id';
  private static readonly OFFLINE_GRACE_PERIOD = 7 * 24 * 60 * 60 * 1000; // 7 days

  /**
   * Activate device with license key
   */
  static async activate(
    licenseKey: string,
    deviceName?: string
  ): Promise<ActivationResponse> {
    const deviceId = this.getDeviceId();
    const osInfo = await this.getOsInfo();

    const request: ActivationRequest = {
      licenseKey,
      deviceId,
      appType: 'player',
      deviceName: deviceName || `Player-${deviceId.slice(0, 8)}`,
      osInfo
    };

    const response = await fetch(`${this.API_BASE}/api/license/activate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Activation failed: ${response.status}`);
    }

    if (data.success && data.token) {
      // Store token
      this.storeToken({
        token: data.token,
        expiresAt: data.expiresAt,
        deviceId,
        plan: data.license.plan,
        appType: 'PLAYER',
        features: this.extractFeatures(data.license.plan),
        licenseId: data.license.id
      });

      // Mark as last validated online
      localStorage.setItem('kiosk_last_online_check', new Date().toISOString());
    }

    return data;
  }

  /**
   * Validate current token (with offline mode support)
   */
  static async validate(allowOffline: boolean = true): Promise<boolean> {
    const token = this.getToken();
    if (!token) return false;

    const deviceId = this.getDeviceId();

    const request: ValidationRequest = {
      token: token.token,
      deviceId
    };

    try {
      const response = await fetch(`${this.API_BASE}/api/license/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      const data: ValidationResponse = await response.json();

      if (!response.ok || !data.valid) {
        // Invalid token - clear storage
        this.clearToken();
        return false;
      }

      // Mark as last validated online
      localStorage.setItem('kiosk_last_online_check', new Date().toISOString());

      return true;
    } catch (error) {
      console.error('[LicenseService] Validation error:', error);

      // Offline mode: check if grace period is still valid
      if (allowOffline) {
        return this.isOfflineModeValid();
      }

      return false;
    }
  }

  /**
   * Check if offline mode is valid (within grace period)
   */
  static isOfflineModeValid(): boolean {
    const token = this.getToken();
    if (!token) return false;

    const lastOnlineCheck = localStorage.getItem('kiosk_last_online_check');
    if (!lastOnlineCheck) return false;

    const lastCheck = new Date(lastOnlineCheck).getTime();
    const now = new Date().getTime();
    const timeSinceLastCheck = now - lastCheck;

    // Check if within grace period
    if (timeSinceLastCheck > this.OFFLINE_GRACE_PERIOD) {
      console.warn('[LicenseService] Offline grace period expired');
      return false;
    }

    // Check if token itself is not expired
    const status = getLicenseStatus(token);
    if (status.isExpired) {
      console.warn('[LicenseService] Token expired');
      return false;
    }

    console.log(
      `[LicenseService] Offline mode valid (${Math.floor(
        (this.OFFLINE_GRACE_PERIOD - timeSinceLastCheck) / (1000 * 60 * 60 * 24)
      )} days remaining)`
    );
    return true;
  }

  /**
   * Refresh token before expiration
   */
  static async refresh(): Promise<void> {
    const token = this.getToken();
    if (!token) {
      throw new Error('No token to refresh');
    }

    const deviceId = this.getDeviceId();

    const request: RefreshRequest = {
      deviceId,
      oldToken: token.token
    };

    const response = await fetch(`${this.API_BASE}/api/license/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    const data: RefreshResponse = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Token refresh failed');
    }

    // Update stored token
    this.storeToken({
      ...token,
      token: data.token,
      expiresAt: data.expiresAt
    });

    // Update last online check
    localStorage.setItem('kiosk_last_online_check', new Date().toISOString());
  }

  /**
   * Deactivate current device
   */
  static async deactivate(licenseKey: string): Promise<void> {
    const deviceId = this.getDeviceId();

    const request: DeactivationRequest = {
      deviceId,
      licenseKey
    };

    const response = await fetch(`${this.API_BASE}/api/license/deactivate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    const data: DeactivationResponse = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Deactivation failed');
    }

    // Clear local storage
    this.clearToken();
    localStorage.removeItem('kiosk_last_online_check');
  }

  /**
   * Get stored token
   */
  static getToken(): LicenseToken | null {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) return null;

    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }

  /**
   * Store token in localStorage
   */
  private static storeToken(token: LicenseToken): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(token));
  }

  /**
   * Clear stored token
   */
  private static clearToken(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * Get or generate device ID
   * For Electron, try to use machine ID if available
   */
  static getDeviceId(): string {
    let deviceId = localStorage.getItem(this.DEVICE_ID_KEY);

    if (!deviceId) {
      // Try to use Electron machine ID if available
      if (window.electronAPI && window.electronAPI.getMachineId) {
        try {
          const machineId = window.electronAPI.getMachineId();
          deviceId = `player-${machineId}`;
        } catch (error) {
          console.warn('[LicenseService] Could not get machine ID:', error);
        }
      }

      // Fallback to random ID
      if (!deviceId) {
        deviceId = `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }

      localStorage.setItem(this.DEVICE_ID_KEY, deviceId);
    }

    return deviceId;
  }

  /**
   * Check if device is licensed
   */
  static isLicensed(): boolean {
    const token = this.getToken();
    if (!token) return false;

    const status = getLicenseStatus(token);
    return status.isLicensed;
  }

  /**
   * Get license status
   */
  static getLicenseStatus(): LicenseStatus | null {
    const token = this.getToken();
    if (!token) return null;

    return getLicenseStatus(token);
  }

  /**
   * Get license features
   */
  static getFeatures(): string[] {
    const token = this.getToken();
    return token?.features || [];
  }

  /**
   * Check if feature is available
   */
  static hasFeature(feature: keyof PlanFeatures): boolean {
    const token = this.getToken();
    if (!token) return false;

    const features = getPlanFeatures(token.plan);
    return features[feature] as boolean;
  }

  /**
   * Get plan name
   */
  static getPlan(): 'BASIC' | 'PRO' | 'MAX' | null {
    const token = this.getToken();
    return token?.plan || null;
  }

  /**
   * Extract features from plan
   */
  private static extractFeatures(plan: 'BASIC' | 'PRO' | 'MAX'): string[] {
    const features = getPlanFeatures(plan);
    const result: string[] = [];

    if (features.editPredefinedTemplates) result.push('edit_predefined_templates');
    if (features.createCustomTemplates) result.push('create_custom_templates');
    if (features.advancedExport) result.push('advanced_export');
    if (features.cloudStorage) result.push('cloud_storage');
    if (features.teamCollaboration) result.push('team_collaboration');
    if (features.prioritySupport) result.push('priority_support');

    return result;
  }

  /**
   * Get OS info for activation (Electron version)
   */
  private static async getOsInfo() {
    if (window.electronAPI && window.electronAPI.getSystemInfo) {
      try {
        return await window.electronAPI.getSystemInfo();
      } catch (error) {
        console.warn('[LicenseService] Could not get system info:', error);
      }
    }

    // Fallback to browser API
    return {
      platform: navigator.platform,
      release: navigator.userAgent,
      arch: navigator.userAgent.includes('x64') ? 'x64' : 'x86'
    };
  }

  /**
   * Check if token needs refresh (< 24 hours)
   */
  static needsRefresh(): boolean {
    const status = this.getLicenseStatus();
    return status ? status.needsRefresh : false;
  }

  /**
   * Auto-refresh token if needed
   */
  static async autoRefresh(): Promise<void> {
    if (!this.isLicensed()) return;

    if (this.needsRefresh()) {
      try {
        await this.refresh();
        console.log('[LicenseService] Token auto-refreshed');
      } catch (error) {
        console.error('[LicenseService] Auto-refresh failed:', error);
      }
    }
  }

  /**
   * Start auto-refresh interval (every 6 hours)
   */
  static startAutoRefresh(): () => void {
    const interval = setInterval(() => {
      this.autoRefresh();
    }, 6 * 60 * 60 * 1000); // 6 hours

    // Run once immediately
    this.autoRefresh();

    // Return cleanup function
    return () => clearInterval(interval);
  }

  /**
   * Validate on startup (Player-specific)
   * Checks online first, falls back to offline mode if needed
   */
  static async validateOnStartup(): Promise<{
    valid: boolean;
    mode: 'online' | 'offline' | 'none';
    message?: string;
  }> {
    const token = this.getToken();

    if (!token) {
      return {
        valid: false,
        mode: 'none',
        message: 'No license found. Please activate a license key.'
      };
    }

    // Try online validation first
    try {
      const isValid = await this.validate(false);
      if (isValid) {
        return {
          valid: true,
          mode: 'online',
          message: 'License validated online'
        };
      }
    } catch (error) {
      console.warn('[LicenseService] Online validation failed, trying offline mode');
    }

    // Fall back to offline mode
    if (this.isOfflineModeValid()) {
      const status = this.getLicenseStatus();
      return {
        valid: true,
        mode: 'offline',
        message: `Running in offline mode (${status?.expiresIn} days remaining)`
      };
    }

    return {
      valid: false,
      mode: 'none',
      message: 'License validation failed. Please connect to the internet.'
    };
  }
}
