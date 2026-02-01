const BASE_URL = import.meta.env.VITE_LICENSE_SERVER_URL || 'http://localhost:3001';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface License {
  id: string;
  licenseKey: string;
  organizationId: string;
  plan: 'BASIC' | 'PRO' | 'MAX';
  status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED';
  seatsEditor: number;
  seatsPlayer: number;
  validFrom: string;
  validUntil: string;
  createdAt: string;
  updatedAt: string;
  organization?: { id: string; name: string };
  _deviceCount?: number;
}

export interface Device {
  id: string;
  deviceId: string;
  licenseId: string;
  appType: 'EDITOR' | 'PLAYER';
  deviceName: string;
  osInfo: string;
  status: 'ACTIVE' | 'DEACTIVATED';
  activatedAt: string;
  deactivatedAt: string | null;
  lastSeenAt: string;
  license?: { id: string; licenseKey: string; plan: string };
}

export interface AuditLog {
  id: string;
  action: string;
  userId: string | null;
  deviceId: string | null;
  licenseId: string | null;
  details: Record<string, any> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface Stats {
  totalLicenses: number;
  activeLicenses: number;
  totalDevices: number;
  activeDevices: number;
  editorDevices: number;
  playerDevices: number;
  recentActivations: number;
  recentDeactivations: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  [key: string]: string | number | undefined;
}

// ─── Helper ──────────────────────────────────────────────────────────────────

async function request<T>(
  method: string,
  path: string,
  token?: string | null,
  body?: any,
  params?: PaginationParams
): Promise<T> {
  const url = new URL(path, BASE_URL);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const adminApi = {
  // Auth
  async login(
    email: string,
    password: string
  ): Promise<{ token: string; user: { id: string; email: string; role: string } }> {
    const res = await request<any>('POST', '/api/admin/login', null, { email, password });
    return res;
  },

  // Stats
  async getStats(token: string): Promise<Stats> {
    const res = await request<any>('GET', '/api/admin/stats', token);
    return res.stats || res.data || res;
  },

  // Licenses
  async getLicenses(token: string, params?: PaginationParams): Promise<{ licenses: License[]; total: number }> {
    const res = await request<any>('GET', '/api/admin/licenses', token, undefined, params);
    return { licenses: res.licenses || res.data || [], total: res.total ?? (res.licenses || res.data || []).length };
  },

  async getLicenseById(token: string, id: string): Promise<License> {
    const res = await request<any>('GET', `/api/admin/licenses/${id}`, token);
    return res.license || res.data || res;
  },

  async createLicense(
    token: string,
    data: {
      organizationId: string;
      plan: string;
      seatsEditor: number;
      seatsPlayer: number;
      validUntil: string;
    }
  ): Promise<License> {
    const res = await request<any>('POST', '/api/admin/licenses', token, data);
    return res.license || res.data || res;
  },

  async updateLicense(
    token: string,
    id: string,
    data: Partial<{
      plan: string;
      status: string;
      seatsEditor: number;
      seatsPlayer: number;
      validUntil: string;
    }>
  ): Promise<License> {
    const res = await request<any>('PATCH', `/api/admin/licenses/${id}`, token, data);
    return res.license || res.data || res;
  },

  // Devices
  async getDevices(token: string, params?: PaginationParams): Promise<{ devices: Device[]; total: number }> {
    const res = await request<any>('GET', '/api/admin/devices', token, undefined, params);
    return { devices: res.devices || res.data || [], total: res.total ?? (res.devices || res.data || []).length };
  },

  async deleteDevice(token: string, id: string): Promise<void> {
    await request<any>('DELETE', `/api/admin/devices/${id}`, token);
  },

  // Audit Logs
  async getAuditLogs(token: string, params?: PaginationParams): Promise<{ logs: AuditLog[]; total: number }> {
    const res = await request<any>('GET', '/api/admin/audit', token, undefined, params);
    return { logs: res.logs || res.data || [], total: res.total ?? (res.logs || res.data || []).length };
  },
};
