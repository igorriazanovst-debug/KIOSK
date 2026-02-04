// packages/editor/src/services/LicenseService.ts
// License management service for Editor

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
 * License Service for Editor
 * Manages license activation, validation, and token refresh
 */
export class LicenseService {
  private static readonly API_BASE =
    import.meta.env.VITE_LICENSE_SERVER_URL || 'http://localhost:3001';
  private static readonly STORAGE_KEY = 'kiosk_license_token';
  private static readonly DEVICE_ID_KEY = 'kiosk_device_id';

  /**
   * Activate device with license key
   */
  static async activate(
    licenseKey: string,
    deviceName?: string
  ): Promise<ActivationResponse> {
    const deviceId = this.getDeviceId();
    const osInfo = this.getOsInfo();

    const request: ActivationRequest = {
      licenseKey,
      deviceId,
      appType: 'editor',
      deviceName: deviceName || `Editor-${deviceId.slice(0, 8)}`,
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
        appType: 'EDITOR',
        features: this.extractFeatures(data.license.plan),
        licenseId: data.license.id
      });
    }

    return data;
  }

  /**
   * Validate current token
   */
  static async validate(): Promise<boolean> {
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
        body: JSON.stringify(request)
      });

      const data: ValidationResponse = await response.json();

      if (!response.ok || !data.valid) {
        // Invalid token - clear storage
        this.clearToken();
        return false;
      }

      return true;
    } catch (error) {
      console.error('[LicenseService] Validation error:', error);
      return false;
    }
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
   */
  static getDeviceId(): string {
    let deviceId = localStorage.getItem(this.DEVICE_ID_KEY);

    if (!deviceId) {
      deviceId = `editor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
   * Get OS info for activation
   */
  private static getOsInfo() {
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
}
