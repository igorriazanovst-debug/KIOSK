// packages/editor/src/services/LicenseService.ts

import type {
  ActivationRequest,
  ActivationResponse,
  ValidationRequest,
  ValidationResponse,
  RefreshRequest,
  RefreshResponse,
  DeactivationRequest,
  DeactivationResponse,
  LicenseToken
} from '@kiosk/shared';

export class LicenseService {
  private static readonly API_BASE =
    import.meta.env.VITE_LICENSE_SERVER_URL || 'http://localhost:3001';
  private static readonly STORAGE_KEY = 'kiosk_license_token';
  private static readonly DEVICE_ID_KEY = 'kiosk_device_id';

  static async activate(licenseKey: string, deviceName?: string): Promise<ActivationResponse> {
    const deviceId = this.getDeviceId();
    const request: ActivationRequest = {
      licenseKey,
      deviceId,
      appType: 'editor',
      deviceName: deviceName || `Editor-${deviceId.slice(0, 8)}`,
      osInfo: this.getOsInfo()
    };

    const response = await fetch(`${this.API_BASE}/api/license/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Activation failed: ${response.status}`);

    if (data.success && data.token) {
      this.storeToken({
        token: data.token,
        expiresAt: data.expiresAt,
        deviceId,
        plan: data.license.plan,
        appType: 'EDITOR',
        features: this.extractFeaturesFromToken(data.token),
        licenseId: data.device?.id || ''
      });
    }
    return data;
  }

  static async validate(): Promise<boolean> {
    const token = this.getToken();
    if (!token) return false;

    try {
      const request: ValidationRequest = { token: token.token, deviceId: this.getDeviceId() };
      const response = await fetch(`${this.API_BASE}/api/license/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });
      const data: ValidationResponse = await response.json();
      if (!response.ok || !data.valid) { this.clearToken(); return false; }
      return true;
    } catch {
      // network error — accept locally valid token
      return this.isTokenLocallyValid();
    }
  }

  static async refresh(): Promise<void> {
    const token = this.getToken();
    if (!token) throw new Error('No token to refresh');

    const request: RefreshRequest = { deviceId: this.getDeviceId(), oldToken: token.token };
    const response = await fetch(`${this.API_BASE}/api/license/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });
    const data: RefreshResponse = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Refresh failed');

    this.storeToken({ ...token, token: data.token, expiresAt: data.expiresAt });
  }

  static async deactivate(licenseKey: string): Promise<void> {
    const request: DeactivationRequest = { deviceId: this.getDeviceId(), licenseKey };
    const response = await fetch(`${this.API_BASE}/api/license/deactivate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });
    const data: DeactivationResponse = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Deactivation failed');
    this.clearToken();
  }

  // Auto-refresh: checks every hour, refreshes 1h before expiry. Returns cleanup fn.
  static startAutoRefresh(): () => void {
    const INTERVAL = 60 * 60 * 1000;
    const BEFORE = 60 * 60 * 1000;

    const check = async () => {
      const token = this.getToken();
      if (!token) return;
      if (new Date(token.expiresAt).getTime() - Date.now() < BEFORE) {
        try { await this.refresh(); } catch (e) { console.error('[License] auto-refresh failed', e); }
      }
    };

    check();
    const id = setInterval(check, INTERVAL);
    return () => clearInterval(id);
  }

  static getToken(): LicenseToken | null {
    const s = localStorage.getItem(this.STORAGE_KEY);
    if (!s) return null;
    try { return JSON.parse(s); } catch { return null; }
  }

  static getDeviceId(): string {
    let id = localStorage.getItem(this.DEVICE_ID_KEY);
    if (!id) {
      id = `editor-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      localStorage.setItem(this.DEVICE_ID_KEY, id);
    }
    return id;
  }

  static isLicensed(): boolean {
    return !!this.getToken() && this.isTokenLocallyValid();
  }

  private static storeToken(t: LicenseToken) { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(t)); }
  private static clearToken() { localStorage.removeItem(this.STORAGE_KEY); }
  private static isTokenLocallyValid(): boolean {
    const t = this.getToken();
    return !!t && new Date(t.expiresAt).getTime() > Date.now();
  }
  private static getOsInfo() {
    return { platform: navigator.platform, release: navigator.userAgent, arch: 'unknown' };
  }
  private static extractFeaturesFromToken(jwt: string): string[] {
    try { return JSON.parse(atob(jwt.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).features || []; }
    catch { return []; }
  }
}
