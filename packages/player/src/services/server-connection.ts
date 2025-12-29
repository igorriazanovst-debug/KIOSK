/**
 * Server Connection Service for Player
 * Handles WebSocket connection, device registration, and project deployment
 */

import { v4 as uuidv4 } from 'uuid';

interface ServerConfig {
  url: string;
  enabled: boolean;
  deviceId: string;
  deviceName: string;
}

interface ProjectDeployment {
  type: 'deployment:start';
  taskId: string;
  deviceId: string;
  projectData: any;
}

type MessageHandler = (data: any) => void;

class ServerConnection {
  private ws: WebSocket | null = null;
  private config: ServerConfig;
  private reconnectTimeout: number = 5000;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private isConnecting: boolean = false;

  constructor() {
    // Load config from localStorage or use defaults
    const saved = localStorage.getItem('kiosk-player-server-config');
    this.config = saved
      ? JSON.parse(saved)
      : {
          url: 'ws://localhost:3001',
          enabled: false,
          deviceId: this.generateDeviceId(),
          deviceName: this.generateDeviceName(),
        };
  }

  /**
   * Initialize connection
   */
  init(config?: Partial<ServerConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
      this.saveConfig();
    }

    if (this.config.enabled) {
      this.connect();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): ServerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ServerConfig>) {
    this.config = { ...this.config, ...config };
    this.saveConfig();

    if (this.config.enabled && !this.isConnected()) {
      this.connect();
    } else if (!this.config.enabled && this.isConnected()) {
      this.disconnect();
    }
  }

  /**
   * Save config to localStorage
   */
  private saveConfig() {
    localStorage.setItem('kiosk-player-server-config', JSON.stringify(this.config));
  }

  /**
   * Generate unique device ID
   */
  private generateDeviceId(): string {
    const stored = localStorage.getItem('kiosk-device-id');
    if (stored) return stored;

    const id = `player-${uuidv4()}`;
    localStorage.setItem('kiosk-device-id', id);
    return id;
  }

  /**
   * Generate device name
   */
  private generateDeviceName(): string {
    const hostname = window.location.hostname || 'Unknown';
    return `Kiosk Player (${hostname})`;
  }

  /**
   * Get device information
   */
  private getDeviceInfo() {
    return {
      id: this.config.deviceId,
      name: this.config.deviceName,
      os: navigator.platform || 'Unknown',
      version: '3.0.0',
      ipAddress: 'N/A', // Will be set by server from connection
    };
  }

  /**
   * Connect to WebSocket server
   */
  private connect() {
    if (this.isConnecting || this.isConnected()) {
      return;
    }

    this.isConnecting = true;

    try {
      console.log('[Server] Connecting to:', this.config.url);
      this.ws = new WebSocket(this.config.url);

      this.ws.onopen = () => {
        console.log('[Server] Connected');
        this.isConnecting = false;
        this.emit('connected', {});

        // Register device
        this.registerDevice();

        // Start heartbeat
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[Server] Message:', data.type);
          this.handleMessage(data);
        } catch (error) {
          console.error('[Server] Failed to parse message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[Server] Error:', error);
        this.isConnecting = false;
      };

      this.ws.onclose = () => {
        console.log('[Server] Disconnected');
        this.isConnecting = false;
        this.stopHeartbeat();
        this.emit('disconnected', {});
        this.scheduleReconnect();
      };
    } catch (error) {
      console.error('[Server] Connection failed:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Schedule reconnection
   */
  private scheduleReconnect() {
    if (!this.config.enabled || this.reconnectTimer) {
      return;
    }

    console.log(`[Server] Reconnecting in ${this.reconnectTimeout / 1000}s`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectTimeout);
  }

  /**
   * Register device with server
   */
  private registerDevice() {
    const deviceInfo = this.getDeviceInfo();

    this.send({
      type: 'device:register',
      ...deviceInfo,
    });

    console.log('[Server] Device registered:', deviceInfo.name);
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat() {
    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(() => {
      this.send({
        type: 'device:heartbeat',
        deviceId: this.config.deviceId,
      });
      console.log('[Server] Heartbeat sent');
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Send message to server
   */
  private send(data: any): boolean {
    if (!this.isConnected()) {
      console.warn('[Server] Not connected, cannot send message');
      return false;
    }

    try {
      this.ws!.send(JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('[Server] Failed to send message:', error);
      return false;
    }
  }

  /**
   * Send log to server
   */
  sendLog(level: 'info' | 'warning' | 'error', message: string, data?: any) {
    this.send({
      type: 'device:log',
      deviceId: this.config.deviceId,
      level,
      message,
      logData: data,
    });
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: any) {
    this.emit(data.type, data);
    this.emit('message', data);
  }

  /**
   * Register message handler
   */
  on(type: string, handler: MessageHandler) {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    this.messageHandlers.get(type)!.push(handler);
  }

  /**
   * Unregister message handler
   */
  off(type: string, handler: MessageHandler) {
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Emit message to handlers
   */
  private emit(type: string, data: any) {
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error('[Server] Handler error:', error);
        }
      });
    }
  }
}

// Export singleton instance
export const serverConnection = new ServerConnection();
