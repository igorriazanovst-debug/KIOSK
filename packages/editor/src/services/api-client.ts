/**
 * API Client for Kiosk Content Platform Server v3.0
 * Handles all HTTP requests to the backend server
 */

export interface ServerConfig {
  url: string;
  enabled: boolean;
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  data: any;
  category?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface MediaFile {
  id: string;
  name: string;
  type: 'image' | 'video' | 'audio';
  file_path: string;
  file_size: number;
  mime_type: string;
  width?: number;
  height?: number;
  duration?: number;
  thumbnail?: string;
  tags?: string[];
  url: string;
  created_at: string;
}

export interface Device {
  id: string;
  name: string;
  type: string;
  os?: string;
  version?: string;
  ip_address?: string;
  status: 'online' | 'offline' | 'error';
  last_seen: string;
  current_project_id?: string;
  settings?: any;
  created_at: string;
  updated_at: string;
}

export interface DeploymentTask {
  id: string;
  project_id: string;
  project_name?: string;
  device_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  error?: string;
  created_at: string;
  completed_at?: string;
}

class ApiClient {
  private baseUrl: string = 'http://localhost:3001';
  private enabled: boolean = false;

  /**
   * Initialize API client
   */
  init(config: ServerConfig) {
    this.baseUrl = config.url.replace(/\/$/, ''); // Remove trailing slash
    this.enabled = config.enabled;
  }

  /**
   * Check if server integration is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get current server URL
   */
  getServerUrl(): string {
    return this.baseUrl;
  }

  /**
   * Generic request handler
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    if (!this.enabled) {
      return { success: false, error: 'Server integration is disabled' };
    }

    try {
      const url = `${this.baseUrl}${endpoint}`;
      console.log(`[API] ${options.method || 'GET'} ${url}`);
      
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      console.log(`[API] Response status: ${response.status}`);

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('[API] Response is not JSON:', contentType);
        const text = await response.text();
        console.error('[API] Response body:', text);
        return { success: false, error: 'Server returned non-JSON response' };
      }

      const data = await response.json();
      console.log('[API] Response data:', data);

      if (!response.ok) {
        return { success: false, error: data.error || `HTTP ${response.status}` };
      }

      return data;
    } catch (error: any) {
      console.error('[API] Request failed:', error);
      return { success: false, error: error.message || 'Network error' };
    }
  }

  // ==================== HEALTH CHECK ====================

  /**
   * Check server health
   */
  async checkHealth(): Promise<{
    success: boolean;
    data?: { status: string; version: string; uptime: number };
    error?: string;
  }> {
    try {
      const url = `${this.baseUrl}/api/health`;
      console.log('[API] GET', url);
      
      const response = await fetch(url);
      console.log('[API] Health response status:', response.status);
      
      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }
      
      const data = await response.json();
      console.log('[API] Health data:', data);
      
      // Health endpoint returns data directly, not wrapped in {success, data}
      return {
        success: true,
        data: data
      };
    } catch (error: any) {
      console.error('[API] Health check failed:', error);
      return { success: false, error: error.message || 'Network error' };
    }
  }

  // ==================== TEMPLATES ====================

  /**
   * Get all templates
   */
  async getTemplates(params?: {
    category?: string;
    search?: string;
  }): Promise<{ success: boolean; data?: Template[]; error?: string }> {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/api/templates${query ? `?${query}` : ''}`);
  }

  /**
   * Get template by ID
   */
  async getTemplate(id: string): Promise<{ success: boolean; data?: Template; error?: string }> {
    return this.request(`/api/templates/${id}`);
  }

  /**
   * Create template
   */
  async createTemplate(template: {
    name: string;
    description?: string;
    thumbnail?: string;
    data: any;
    category?: string;
    tags?: string[];
  }): Promise<{ success: boolean; data?: { id: string }; error?: string }> {
    return this.request('/api/templates', {
      method: 'POST',
      body: JSON.stringify(template),
    });
  }

  /**
   * Update template
   */
  async updateTemplate(
    id: string,
    template: Partial<Template>
  ): Promise<{ success: boolean; data?: { id: string }; error?: string }> {
    return this.request(`/api/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(template),
    });
  }

  /**
   * Delete template
   */
  async deleteTemplate(id: string): Promise<{ success: boolean; error?: string }> {
    return this.request(`/api/templates/${id}`, {
      method: 'DELETE',
    });
  }

  // ==================== MEDIA ====================

  /**
   * Get all media files
   */
  async getMedia(params?: {
    type?: 'image' | 'video' | 'audio';
    search?: string;
  }): Promise<{ success: boolean; data?: MediaFile[]; error?: string }> {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/api/media${query ? `?${query}` : ''}`);
  }

  /**
   * Get media by ID
   */
  async getMediaById(id: string): Promise<{ success: boolean; data?: MediaFile; error?: string }> {
    return this.request(`/api/media/${id}`);
  }

  /**
   * Upload media file
   */
  async uploadMedia(
    file: File,
    name?: string,
    tags?: string[]
  ): Promise<{ success: boolean; data?: MediaFile; error?: string }> {
    if (!this.enabled) {
      return { success: false, error: 'Server integration is disabled' };
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (name) formData.append('name', name);
      if (tags) formData.append('tags', JSON.stringify(tags));

      const url = `${this.baseUrl}/api/media/upload`;
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || `HTTP ${response.status}` };
      }

      return data;
    } catch (error: any) {
      console.error('Media upload failed:', error);
      return { success: false, error: error.message || 'Upload error' };
    }
  }

  /**
   * Delete media file
   */
  async deleteMedia(id: string): Promise<{ success: boolean; error?: string }> {
    return this.request(`/api/media/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get media URL
   */
  getMediaUrl(media: MediaFile): string {
    return `${this.baseUrl}${media.url}`;
  }

  // ==================== DEVICES ====================

  /**
   * Get all devices
   */
  async getDevices(params?: {
    status?: 'online' | 'offline' | 'error';
  }): Promise<{ success: boolean; data?: Device[]; error?: string }> {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/api/devices${query ? `?${query}` : ''}`);
  }

  /**
   * Get device by ID
   */
  async getDevice(id: string): Promise<{ success: boolean; data?: Device; error?: string }> {
    return this.request(`/api/devices/${id}`);
  }

  /**
   * Update device
   */
  async updateDevice(
    id: string,
    device: { name?: string; settings?: any; current_project_id?: string }
  ): Promise<{ success: boolean; data?: { id: string }; error?: string }> {
    return this.request(`/api/devices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(device),
    });
  }

  /**
   * Delete device
   */
  async deleteDevice(id: string): Promise<{ success: boolean; error?: string }> {
    return this.request(`/api/devices/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get device logs
   */
  async getDeviceLogs(
    id: string,
    params?: { limit?: number; level?: 'info' | 'warning' | 'error' }
  ): Promise<{ success: boolean; data?: any[]; error?: string }> {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/api/devices/${id}/logs${query ? `?${query}` : ''}`);
  }

  /**
   * Deploy project to device
   */
  async deployProject(
    deviceId: string,
    projectData: {
      projectId?: string;
      projectName: string;
      projectData: any;
    }
  ): Promise<{ success: boolean; data?: { taskId: string; status: string }; error?: string }> {
    return this.request(`/api/devices/${deviceId}/deploy`, {
      method: 'POST',
      body: JSON.stringify(projectData),
    });
  }

  /**
   * Get deployment task status
   */
  async getDeploymentStatus(
    deviceId: string,
    taskId: string
  ): Promise<{ success: boolean; data?: DeploymentTask; error?: string }> {
    return this.request(`/api/devices/${deviceId}/deploy/${taskId}`);
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
