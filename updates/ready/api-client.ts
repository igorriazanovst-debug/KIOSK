/**
 * API Client для Kiosk License Server
 * Полная интеграция с Backend API (13 эндпоинтов)
 * 
 * @version 2.0.0
 * @author Kiosk Platform Team
 */

// ==================== TYPES ====================

export interface AuthResponse {
  token: string;
  expiresAt: string;
  license: {
    id: string;
    licenseKey: string;
    plan: 'BASIC' | 'PRO' | 'MAX';
    storageLimit: number;
    organization: {
      id: string;
      name: string;
    };
  };
  userProfile?: {
    id: string;
    userId: string;
    autoSaveInterval: number;
    theme: string;
    language: string;
  };
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  licenseId: string;
  organizationId: string;
  createdByUserId?: string;
  projectData: any; // JSON проекта
  canvasWidth: number;
  canvasHeight: number;
  canvasBackground: string;
  version: number;
  thumbnail?: string;
  tags: string[];
  totalFiles: number;
  totalStorageUsed: number;
  viewCount: number;
  isPublished: boolean;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  lastEditedAt: string;
}

export interface ProjectFile {
  id: string;
  projectId: string;
  fileName: string;
  fileType: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'OTHER';
  mimeType: string;
  fileSize: number;
  storagePath: string;
  url: string;
  width?: number;
  height?: number;
  duration?: number;
  thumbnail?: string;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StorageStats {
  used: number;
  limit: number;
  remaining: number;
  usedPercentage: number;
  plan: string;
  projectCount: number;
  fileCount: number;
}

export interface ProjectFilters {
  search?: string;
  tags?: string[];
  isPublished?: boolean;
  page?: number;
  limit?: number;
}

export interface CreateProjectData {
  name: string;
  description?: string;
  projectData?: any;
  canvasWidth?: number;
  canvasHeight?: number;
  canvasBackground?: string;
  tags?: string[];
  thumbnail?: string;
}

export interface UpdateProjectData {
  name?: string;
  description?: string;
  projectData?: any;
  canvasWidth?: number;
  canvasHeight?: number;
  canvasBackground?: string;
  tags?: string[];
  thumbnail?: string;
  isPublished?: boolean;
}

// ==================== API CLIENT ====================

class ApiClient {
  private baseUrl: string = 'http://31.192.110.121:3001';
  private token: string | null = null;
  
  // Activity tracking для auto-logout
  private lastActivity: number = Date.now();
  private inactivityTimer: NodeJS.Timeout | null = null;
  private readonly INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 минут

  constructor() {
    // Загрузить токен из localStorage
    this.loadToken();
    // Запустить мониторинг активности
    this.startActivityMonitoring();
  }

  // ==================== AUTHENTICATION ====================

  /**
   * Загрузить токен из localStorage
   */
  private loadToken(): void {
    const stored = localStorage.getItem('kiosk_auth_token');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        // Проверить что токен не истёк
        if (new Date(data.expiresAt) > new Date()) {
          this.token = data.token;
        } else {
          this.clearToken();
        }
      } catch (error) {
        console.error('[API] Failed to parse stored token:', error);
        this.clearToken();
      }
    }
  }

  /**
   * Сохранить токен в localStorage
   */
  private saveToken(token: string, expiresAt: string): void {
    localStorage.setItem('kiosk_auth_token', JSON.stringify({ token, expiresAt }));
    this.token = token;
  }

  /**
   * Очистить токен
   */
  private clearToken(): void {
    localStorage.removeItem('kiosk_auth_token');
    this.token = null;
  }

  /**
   * Проверка аутентификации
   */
  public isAuthenticated(): boolean {
    return this.token !== null;
  }

  /**
   * Получить текущий токен
   */
  public getToken(): string | null {
    return this.token;
  }

  /**
   * POST /api/auth/license
   * Вход по ключу лицензии
   */
  public async loginWithLicense(licenseKey: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/api/auth/license', {
      method: 'POST',
      body: JSON.stringify({ licenseKey })
    });

    if (response.token) {
      this.saveToken(response.token, response.expiresAt);
    }

    return response;
  }

  /**
   * POST /api/auth/refresh
   * Обновить токен
   */
  public async refreshToken(): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/api/auth/refresh', {
      method: 'POST',
      authenticated: true
    });

    if (response.token) {
      this.saveToken(response.token, response.expiresAt);
    }

    return response;
  }

  /**
   * GET /api/auth/verify
   * Проверить валидность токена
   */
  public async verifyToken(): Promise<boolean> {
    try {
      await this.request('/api/auth/verify', {
        method: 'GET',
        authenticated: true
      });
      return true;
    } catch (error) {
      this.clearToken();
      return false;
    }
  }

  /**
   * Выход (очистка токена)
   */
  public logout(): void {
    this.clearToken();
    this.stopActivityMonitoring();
  }

  // ==================== PROJECTS ====================

  /**
   * GET /api/projects
   * Получить список проектов
   */
  public async getProjects(filters?: ProjectFilters): Promise<Project[]> {
    const params = new URLSearchParams();
    
    if (filters?.search) params.append('search', filters.search);
    if (filters?.tags) params.append('tags', filters.tags.join(','));
    if (filters?.isPublished !== undefined) params.append('isPublished', String(filters.isPublished));
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.limit) params.append('limit', String(filters.limit));

    const query = params.toString();
    const url = query ? `/api/projects?${query}` : '/api/projects';

    return this.request<Project[]>(url, {
      method: 'GET',
      authenticated: true
    });
  }

  /**
   * POST /api/projects
   * Создать проект
   */
  public async createProject(data: CreateProjectData): Promise<Project> {
    return this.request<Project>('/api/projects', {
      method: 'POST',
      authenticated: true,
      body: JSON.stringify(data)
    });
  }

  /**
   * GET /api/projects/:id
   * Получить проект по ID
   */
  public async getProject(id: string): Promise<Project> {
    return this.request<Project>(`/api/projects/${id}`, {
      method: 'GET',
      authenticated: true
    });
  }

  /**
   * PUT /api/projects/:id
   * Обновить проект
   */
  public async updateProject(id: string, data: UpdateProjectData): Promise<Project> {
    return this.request<Project>(`/api/projects/${id}`, {
      method: 'PUT',
      authenticated: true,
      body: JSON.stringify(data)
    });
  }

  /**
   * DELETE /api/projects/:id
   * Удалить проект
   */
  public async deleteProject(id: string): Promise<void> {
    await this.request(`/api/projects/${id}`, {
      method: 'DELETE',
      authenticated: true
    });
  }

  // ==================== FILES ====================

  /**
   * GET /api/projects/:id/files
   * Получить список файлов проекта
   */
  public async getProjectFiles(projectId: string): Promise<ProjectFile[]> {
    return this.request<ProjectFile[]>(`/api/projects/${projectId}/files`, {
      method: 'GET',
      authenticated: true
    });
  }

  /**
   * POST /api/projects/:id/files
   * Загрузить файл
   */
  public async uploadFile(projectId: string, file: File, onProgress?: (progress: number) => void): Promise<ProjectFile> {
    const formData = new FormData();
    formData.append('file', file);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Progress tracking
      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = (e.loaded / e.total) * 100;
            onProgress(progress);
          }
        });
      }

      xhr.addEventListener('load', () => {
        if (xhr.status === 200 || xhr.status === 201) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response.file || response);
          } catch (error) {
            reject(new Error('Failed to parse response'));
          }
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            reject(new Error(error.message || `Upload failed: ${xhr.status}`));
          } catch {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Network error'));
      });

      xhr.open('POST', `${this.baseUrl}/api/projects/${projectId}/files`);
      
      if (this.token) {
        xhr.setRequestHeader('Authorization', `Bearer ${this.token}`);
      }

      xhr.send(formData);
    });
  }

  /**
   * GET /api/projects/:projectId/files/:fileId
   * Скачать файл
   */
  public async downloadFile(projectId: string, fileId: string): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/api/projects/${projectId}/files/${fileId}`, {
      method: 'GET',
      headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {}
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    return response.blob();
  }

  /**
   * DELETE /api/projects/:projectId/files/:fileId
   * Удалить файл
   */
  public async deleteFile(projectId: string, fileId: string): Promise<void> {
    await this.request(`/api/projects/${projectId}/files/${fileId}`, {
      method: 'DELETE',
      authenticated: true
    });
  }

  // ==================== STORAGE ====================

  /**
   * GET /api/storage/stats
   * Получить статистику хранилища
   */
  public async getStorageStats(): Promise<StorageStats> {
    return this.request<StorageStats>('/api/storage/stats', {
      method: 'GET',
      authenticated: true
    });
  }

  // ==================== ACTIVITY MONITORING ====================

  /**
   * Обновить время последней активности
   */
  private updateActivity(): void {
    this.lastActivity = Date.now();
  }

  /**
   * Запустить мониторинг активности
   */
  private startActivityMonitoring(): void {
    // Отслеживать активность пользователя
    const events = ['mousemove', 'keypress', 'click', 'scroll', 'touchstart'];
    
    events.forEach(event => {
      window.addEventListener(event, () => this.updateActivity(), { passive: true });
    });

    // Проверять неактивность каждую минуту
    this.inactivityTimer = setInterval(() => {
      if (!this.isAuthenticated()) return;

      const inactive = Date.now() - this.lastActivity;
      
      if (inactive > this.INACTIVITY_TIMEOUT) {
        console.warn('[API] Session expired due to inactivity');
        this.logout();
        
        // Уведомить приложение о выходе
        window.dispatchEvent(new CustomEvent('auth:logout', { 
          detail: { reason: 'inactivity' } 
        }));
      }
    }, 60 * 1000); // Проверка каждую минуту
  }

  /**
   * Остановить мониторинг активности
   */
  private stopActivityMonitoring(): void {
    if (this.inactivityTimer) {
      clearInterval(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Универсальный метод для HTTP запросов
   */
  private async request<T = any>(
    endpoint: string,
    options: {
      method: string;
      body?: string;
      authenticated?: boolean;
    }
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (options.authenticated && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        method: options.method,
        headers,
        body: options.body
      });

      // Обновить активность при успешном запросе
      if (options.authenticated) {
        this.updateActivity();
      }

      const data = await response.json();

      if (!response.ok) {
        // Если 401 - токен истёк
        if (response.status === 401 && options.authenticated) {
          this.clearToken();
          window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        }

        throw new Error(data.message || data.error || `HTTP ${response.status}`);
      }

      return data;
    } catch (error: any) {
      console.error(`[API] ${options.method} ${endpoint} failed:`, error);
      throw error;
    }
  }
}

// ==================== EXPORT ====================

export const apiClient = new ApiClient();
export default apiClient;
