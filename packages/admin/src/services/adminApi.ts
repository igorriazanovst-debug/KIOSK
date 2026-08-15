const BASE_URL = import.meta.env.VITE_LICENSE_SERVER_URL || 'http://localhost:3001';

// download_url / etc. from the server are origin-relative — callers rendering
// them as links (e.g. build artifact downloads) must prefix with this.
export function getApiBaseUrl(): string {
  return BASE_URL;
}

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
  expiredLicenses?: number;
  totalDevices: number;
  activeDevices: number;
  editorDevices: number;
  playerDevices: number;
  recentActivations?: number;
  recentDeactivations?: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  [key: string]: string | number | undefined;
}

export interface AvailableProject {
  id: string;
  name: string;
  updatedAt: string;
  licenseId: string;
  accessType: 'own' | 'granted';
  grantId?: string;
  grantedAt?: string;
}

export interface AdminProjectListItem {
  id: string;
  name: string;
  licenseId: string;
  updatedAt: string;
  license?: { organization?: { name: string } };
}

export interface LicenseDetails extends License {
  availableProjects: AvailableProject[];
  devices: Device[];
}

export interface BuildArtifact {
  file_name: string;
  download_url: string;
  file_size: string;
  label: string;
}

export type BuildPlatform = 'win' | 'deb' | 'rpm';

export interface BuildStatus {
  id: string;
  status: 'queued' | 'building' | 'completed' | 'failed';
  progress: number;
  message?: string;
  files?: BuildArtifact[];
  download_url?: string;
  error?: string;
}

export interface LicenseUserAccount {
  id: string;
  email: string;
  role: 'OWNER' | 'MEMBER';
  createdAt: string;
  updatedAt: string;
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
    const d = res.stats || res.data || res;
    // Нормализуем структуру { licenses:{}, devices:{} } -> плоский Stats
    if (d && d.devices && d.licenses) {
      return {
        totalLicenses:  d.licenses.total  ?? 0,
        activeLicenses: d.licenses.active ?? 0,
        expiredLicenses:d.licenses.expired ?? 0,
        totalDevices:   d.devices.total   ?? 0,
        activeDevices:  d.devices.active  ?? 0,
        editorDevices:  d.devices.editor  ?? 0,
        playerDevices:  d.devices.player  ?? 0,
      };
    }
    return d;
  },

  // Licenses
  async getLicenses(token: string, params?: PaginationParams): Promise<{ licenses: License[]; total: number }> {
    const res = await request<any>('GET', '/api/admin/licenses', token, undefined, params);
    return { licenses: res.licenses || res.data || [], total: res.total ?? (res.licenses || res.data || []).length };
  },

  async getLicenseById(token: string, id: string): Promise<LicenseDetails> {
    const res = await request<any>('GET', `/api/admin/licenses/${id}`, token);
    return res.license || res.data || res;
  },

  // Projects / ProjectGrant
  async listProjects(token: string, search?: string): Promise<AdminProjectListItem[]> {
    const res = await request<any>('GET', '/api/admin/projects', token, undefined, search ? { search } : undefined);
    return res.data || [];
  },

  async grantProject(token: string, projectId: string, licenseId: string): Promise<void> {
    await request<any>('POST', `/api/admin/projects/${projectId}/grants`, token, { licenseId });
  },

  async revokeGrant(token: string, projectId: string, licenseId: string): Promise<void> {
    await request<any>('DELETE', `/api/admin/projects/${projectId}/grants/${licenseId}`, token);
  },

  // Build a distributable for a specific license (без входа под клиентом)
  async buildForLicense(
    token: string,
    licenseId: string,
    projectId: string,
    appName?: string,
    platform: BuildPlatform = 'win'
  ): Promise<{ build_id: string; status_url: string }> {
    const res = await request<any>('POST', `/api/builds/for-license/${licenseId}`, token, {
      projectId,
      appName,
      platform
    });
    return res.data;
  },

  async getBuildStatus(token: string, buildId: string): Promise<BuildStatus> {
    const res = await request<any>('GET', `/api/builds/${buildId}`, token);
    return res.data;
  },

  // License user accounts (client login: email/password/role)
  async listLicenseUsers(token: string, licenseId: string): Promise<LicenseUserAccount[]> {
    const res = await request<any>('GET', `/api/admin/licenses/${licenseId}/users`, token);
    return res.data || [];
  },

  async createLicenseUser(
    token: string,
    licenseId: string,
    email: string,
    role: 'OWNER' | 'MEMBER' = 'MEMBER'
  ): Promise<{ id: string; email: string; role: string; tempPassword: string }> {
    const res = await request<any>('POST', `/api/admin/licenses/${licenseId}/users`, token, { email, role });
    return res.data;
  },

  async updateLicenseUser(
    token: string,
    id: string,
    data: { email?: string; role?: 'OWNER' | 'MEMBER'; resetPassword?: boolean }
  ): Promise<{ id: string; email: string; role: string; tempPassword: string | null }> {
    const res = await request<any>('PATCH', `/api/admin/license-users/${id}`, token, data);
    return res.data;
  },

  async deleteLicenseUser(token: string, id: string): Promise<void> {
    await request<any>('DELETE', `/api/admin/license-users/${id}`, token);
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

  async getOnlineDevices(token: string): Promise<{ data: any[]; total: number }> {
    const res = await request<any>('GET', '/api/admin/devices/online', token);
    return { data: res.data || [], total: res.total ?? 0 };
  },

  async deleteDevice(token: string, id: string): Promise<void> {
    await request<any>('DELETE', `/api/admin/devices/${id}`, token);
  },

  // Remote reassign — moves an already-activated device to a different
  // license (and optionally project) without re-entering credentials on the
  // device itself. Requires the device to be online right now.
  async reassignDevice(
    token: string,
    deviceId: string,
    licenseId: string,
    projectId?: string
  ): Promise<{ licenseId: string; projectId: string }> {
    const res = await request<any>('POST', `/api/admin/devices/${deviceId}/reassign`, token, { licenseId, projectId });
    return res.data;
  },

  // Audit Logs
  async getAuditLogs(token: string, params?: PaginationParams): Promise<{ logs: AuditLog[]; total: number }> {
    const res = await request<any>('GET', '/api/admin/audit', token, undefined, params);
    return { logs: res.logs || res.data || [], total: res.total ?? (res.logs || res.data || []).length };
  },
};

// ─── Client Invite ────────────────────────────────────────────────────────────

export interface InviteResult {
  email: string;
  tempPassword: string;
  organizationName: string;
  plan: string;
  licenseKey: string;
  licenseId: string;
  organizationId: string;
  validUntil: string;
}

export const clientApi = {
  async inviteClient(
    token: string,
    data: { email: string; plan: string; organizationName: string; validUntil?: string }
  ): Promise<InviteResult> {
    const res = await request<any>('POST', '/api/admin/invite', token, data);
    return res.data || res;
  },
};
