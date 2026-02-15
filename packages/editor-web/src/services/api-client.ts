/**
 * API Client - Session Management with Activity Tracking
 * Токен хранится в sessionStorage и удаляется при закрытии браузера
 * Автоматический выход через 30 минут неактивности с предупреждением за 2 минуты
 */

import { logger } from '../utils/logger';

// ==================== TYPES ====================

export interface AuthResponse {
  success: boolean;
  token: string;
  expiresIn: number;
  license: {
    licenseKey: string;
    organizationId: string;
    organizationName: string;
    plan: 'BASIC' | 'PRO' | 'MAX';
    validFrom?: string;
    validUntil?: string;
    maxDevices: number;
    features: string[];
  };
  user?: {
    id: string;
    email?: string;
  };
}

export interface ProjectResponse {
  success: boolean;
  project: Project;
}

export interface ProjectsListResponse {
  success: boolean;
  projects: Project[];
  total: number;
  page: number;
  limit: number;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  projectData: any;
  canvasWidth: number;
  canvasHeight: number;
  canvasBackground?: string;
  tags?: string[];
  thumbnail?: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
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

export interface ProjectFile {
  id: string;
  fileName: string;
  fileType: string;
  mimeType: string;
  fileSize: number;
  url: string;
  width?: number;
  height?: number;
  duration?: number;
  createdAt: string;
}

export interface StorageStats {
  used: number;
  limit: number;
  remaining: number;
  usedPercentage: number;
  totalFiles: number;
}

// ==================== API CLIENT ====================

class ApiClient {
  // ==================== DEBUG CONFIGURATION ====================
  // Для отладки: измените на true и укажите время в минутах
  private readonly DEBUG_MODE = false;
  private readonly DEBUG_INACTIVITY_MINUTES = 3; // Для отладки: 3 минуты
  
  // ==================== PRODUCTION CONFIGURATION ====================
  private baseUrl: string = '';

  getBaseUrl(): string {
    return this.baseUrl;
  }

  private token: string | null = null;
  private organizationName: string | null = null;
  private plan: string | null = null;

  private lastActivity: number = Date.now();
  private inactivityTimer: NodeJS.Timeout | null = null;
  private warningTimer: NodeJS.Timeout | null = null;
  
  private readonly INACTIVITY_TIMEOUT = this.DEBUG_MODE ? this.DEBUG_INACTIVITY_MINUTES * 60 * 1000 : 60 * 60 * 1000;
  private readonly WARNING_TIME = this.DEBUG_MODE ? (this.DEBUG_INACTIVITY_MINUTES - 2) * 60 * 1000 : 58 * 60 * 1000;

  constructor() {
    this.loadToken();
    this.startActivityMonitoring();
  }

  // ==================== TOKEN MANAGEMENT ====================

  /**
   * Загрузить токен из sessionStorage
   */
  private loadToken(): void {
    const stored = sessionStorage.getItem('kiosk_auth_token');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        const lastActivity = data.lastActivityTime || Date.now();
        const timeSinceActivity = Date.now() - lastActivity;

        // Проверяем что прошло меньше 30 минут с последней активности
        if (timeSinceActivity < this.INACTIVITY_TIMEOUT) {
          this.token = data.token;
          this.organizationName = data.organizationName || null;
          this.plan = data.plan || null;
          this.lastActivity = Date.now(); // Обновляем время активности при загрузке
          
          this.updateActivityTime(); // Сохраняем в sessionStorage
          
          logger.info('Token loaded from sessionStorage', {
            hasToken: !!this.token,
            organization: this.organizationName,
            plan: this.plan,
            inactiveDuration: Math.round(timeSinceActivity / 1000) + 's'
          });
        } else {
          logger.warn('Session expired due to inactivity', {
            inactiveDuration: Math.round(timeSinceActivity / 1000 / 60) + ' minutes'
          });
          this.clearToken();
        }
      } catch (error) {
        logger.error('Failed to parse stored token', error);
        this.clearToken();
      }
    }
  }

  /**
   * Сохранить токен в sessionStorage
   */
  private saveToken(token: string, organizationName: string, plan: string): void {
    const data = {
      token,
      organizationName,
      plan,
      lastActivityTime: Date.now(),
      savedAt: new Date().toISOString()
    };
    
    sessionStorage.setItem('kiosk_auth_token', JSON.stringify(data));
    sessionStorage.setItem('kiosk_org_data', JSON.stringify({
      name: organizationName,
      plan: plan
    }));
    
    this.token = token;
    this.organizationName = organizationName;
    this.plan = plan;
    this.lastActivity = Date.now();
    
    logger.info('Token saved to sessionStorage', {
      organization: organizationName,
      plan: plan
    });
  }

  /**
   * Обновить время последней активности в sessionStorage
   */
  private updateActivityTime(): void {
    const stored = sessionStorage.getItem('kiosk_auth_token');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        data.lastActivityTime = Date.now();
        sessionStorage.setItem('kiosk_auth_token', JSON.stringify(data));
      } catch (error) {
        logger.error('Failed to update activity time', error);
      }
    }
  }

  /**
   * Очистить токен
   */
  private clearToken(): void {
    sessionStorage.removeItem('kiosk_auth_token');
    sessionStorage.removeItem('kiosk_org_data');
    this.token = null;
    this.organizationName = null;
    this.plan = null;
    
    logger.info('Token cleared from sessionStorage');
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
   * Получить данные организации
   */
  public getOrganizationData(): { name: string | null; plan: string | null } {
    return {
      name: this.organizationName,
      plan: this.plan
    };
  }

  // ==================== AUTHENTICATION ====================

  /**
   * POST /api/auth/license
   * Вход по ключу лицензии
   */
  public async loginWithLicense(licenseKey: string): Promise<AuthResponse> {
    logger.info('Attempting login with license key');
    
    try {
      const response = await this.request<AuthResponse>('/api/auth/license', {
        method: 'POST',
        body: JSON.stringify({ licenseKey })
      });

      if (response.token && response.license) {
        this.saveToken(
          response.token,
          response.license.organizationName,
          response.license.plan
        );
        
        logger.info('Login successful', {
          organization: response.license.organizationName,
          plan: response.license.plan
        });
      }

      return response;
    } catch (error) {
      logger.error('Login failed', error);
      throw error;
    }
  }

  /**
   * POST /api/auth/refresh
   * Обновить токен
   */
  public async refreshToken(): Promise<AuthResponse> {
    logger.info('Refreshing token');
    
    try {
      const response = await this.request<AuthResponse>('/api/auth/refresh', {
        method: 'POST',
        authenticated: true
      });

      if (response.token && response.license) {
        this.saveToken(
          response.token,
          response.license.organizationName,
          response.license.plan
        );
        
        logger.info('Token refreshed successfully');
      }

      return response;
    } catch (error) {
      logger.error('Token refresh failed', error);
      throw error;
    }
  }

  /**
   * GET /api/auth/verify
   * Проверить токен
   */
  public async verifyToken(): Promise<boolean> {
    try {
      await this.request('/api/auth/verify', {
        method: 'GET',
        authenticated: true
      });
      
      logger.info('Token verified successfully');
      return true;
    } catch (error) {
      logger.warn('Token verification failed', error);
      this.clearToken();
      return false;
    }
  }

  /**
   * Выход из системы
   */
  public logout(): void {
    logger.info('User logout');
    this.clearToken();
    this.stopActivityMonitoring();
    
    // Отправить событие logout
    window.dispatchEvent(new CustomEvent('auth:logout'));
  }

  // ==================== ACTIVITY MONITORING ====================

  /**
   * Обновить время последней активности
   */
  private updateActivity(): void {
    this.lastActivity = Date.now();
    this.updateActivityTime();
    
    // Сбросить таймеры предупреждения и выхода
    this.resetTimers();
  }

  /**
   * Сбросить таймеры
   */
  private resetTimers(): void {
    // Очистить старые таймеры
    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
    }
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }

    // Таймер предупреждения (за 2 минуты до выхода)
    this.warningTimer = setTimeout(() => {
      logger.warn('Inactivity warning - 2 minutes until logout');
      
      // Отправить событие предупреждения
      window.dispatchEvent(new CustomEvent('auth:inactivity-warning', {
        detail: { timeRemaining: 2 * 60 * 1000 }
      }));
    }, this.WARNING_TIME);

    // Таймер выхода (через 30 минут)
    this.inactivityTimer = setTimeout(() => {
      logger.warn('Session expired due to inactivity');
      this.logout();
    }, this.INACTIVITY_TIMEOUT);
  }

  /**
   * Запустить мониторинг активности
   */
  private startActivityMonitoring(): void {
    if (!this.isAuthenticated()) return;

    const events = ['mousemove', 'keypress', 'click', 'scroll', 'touchstart'];
    
    events.forEach(event => {
      window.addEventListener(event, () => this.updateActivity(), { passive: true });
    });

    // Запустить таймеры
    this.resetTimers();

    logger.info('Activity monitoring started', {
      timeout: this.INACTIVITY_TIMEOUT / 1000 / 60 + ' minutes',
      warning: this.WARNING_TIME / 1000 / 60 + ' minutes'
    });
  }

  /**
   * Остановить мониторинг активности
   */
  private stopActivityMonitoring(): void {
    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
      this.warningTimer = null;
    }
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
    
    logger.info('Activity monitoring stopped');
  }

  // ==================== PROJECTS ====================

  public async getProjects(filters?: ProjectFilters): Promise<ProjectsListResponse> {
    const params = new URLSearchParams();
    
    if (filters?.search) params.append('search', filters.search);
    if (filters?.tags) params.append('tags', filters.tags.join(','));
    if (filters?.isPublished !== undefined) params.append('isPublished', String(filters.isPublished));
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.limit) params.append('limit', String(filters.limit));

    const query = params.toString();
    const url = `/api/projects${query ? '?' + query : ''}`;

    return this.request<ProjectsListResponse>(url, {
      method: 'GET',
      authenticated: true
    });
  }

  public async createProject(data: CreateProjectData): Promise<Project> {
    const response = await this.request<ProjectResponse>('/api/projects', {
      method: 'POST',
      authenticated: true,
      body: JSON.stringify(data)
    });
    return response.project;
  }

  public async getProject(id: string): Promise<Project> {
    const response = await this.request<ProjectResponse>(`/api/projects/${id}`, {
      method: 'GET',
      authenticated: true
    });
    return response.project;
  }

  public async updateProject(id: string, data: UpdateProjectData): Promise<Project> {
    const response = await this.request<ProjectResponse>(`/api/projects/${id}`, {
      method: 'PUT',
      authenticated: true,
      body: JSON.stringify(data)
    });
    return response.project;
  }

  public async deleteProject(id: string): Promise<void> {
    await this.request(`/api/projects/${id}`, {
      method: 'DELETE',
      authenticated: true
    });
  }

  // ==================== FILES ====================

  public async getProjectFiles(projectId: string): Promise<ProjectFile[]> {
    const response = await this.request<{ files: ProjectFile[] }>(`/api/projects/${projectId}/files`, {
      method: 'GET',
      authenticated: true
    });
    return response.files;
  }

  public async uploadFile(projectId: string, file: File, onProgress?: (progress: number) => void): Promise<ProjectFile> {
    const formData = new FormData();
    formData.append('file', file);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

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

      xhr.open('POST', `/api/projects/${projectId}/files`);
      
      if (this.token) {
        xhr.setRequestHeader('Authorization', `Bearer ${this.token}`);
      }

      xhr.send(formData);
    });
  }

  public async downloadFile(projectId: string, fileId: string): Promise<Blob> {
    const response = await fetch(`/api/projects/${projectId}/files/${fileId}`, {
      method: 'GET',
      headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {}
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    return response.blob();
  }

  public async deleteFile(projectId: string, fileId: string): Promise<void> {
    await this.request(`/api/projects/${projectId}/files/${fileId}`, {
      method: 'DELETE',
      authenticated: true
    });
  }

  // ==================== STORAGE ====================

  public async getStorageStats(): Promise<StorageStats> {
    return this.request<StorageStats>('/api/storage/stats', {
      method: 'GET',
      authenticated: true
    });
  }

  // ==================== PRIVATE METHODS ====================

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
      'Content-Type': 'application/json',
    };

    if (options.authenticated && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        method: options.method,
        headers,
        body: options.body,
      });

      // Обновить активность при успешном запросе
      if (options.authenticated && response.ok) {
        this.updateActivity();
      }

      if (!response.ok) {
        if (response.status === 401) {
          logger.warn('Unauthorized - clearing token');
          this.clearToken();
          window.dispatchEvent(new CustomEvent('auth:unauthorized'));
          throw new Error('Unauthorized');
        }

        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      logger.error('Request failed', {
        endpoint,
        method: options.method,
        error
      });
      throw error;
    }
  }
}

export const apiClient = new ApiClient();
