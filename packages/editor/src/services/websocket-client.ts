/**
 * WebSocket Client for Kiosk Content Platform Server v3.0
 * Handles real-time updates from server
 */

export type WebSocketEventType =
  | 'device:connected'
  | 'device:disconnected'
  | 'device:status'
  | 'deployment:progress'
  | 'deployment:completed';

export interface WebSocketEvent {
  type: WebSocketEventType;
  [key: string]: any;
}

type EventCallback = (event: WebSocketEvent) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string = '';
  private enabled: boolean = false;
  private reconnectTimeout: number = 5000;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private listeners: Map<WebSocketEventType | 'all', EventCallback[]> = new Map();
  private isConnecting: boolean = false;

  /**
   * Initialize WebSocket client
   */
  init(serverUrl: string, enabled: boolean = true) {
    this.url = serverUrl.replace(/^http/, 'ws').replace(/\/$/, '');
    this.enabled = enabled;

    if (this.enabled) {
      this.connect();
    }
  }

  /**
   * Connect to WebSocket server
   */
  private connect() {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isConnecting = true;

    try {
      console.log(`[WebSocket] Connecting to ${this.url}`);
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('[WebSocket] Connected');
        this.isConnecting = false;
        this.emit('connected', {});
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[WebSocket] Message:', data);
          this.emit(data.type, data);
          this.emit('all', data);
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        this.isConnecting = false;
      };

      this.ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        this.isConnecting = false;
        this.emit('disconnected', {});
        this.scheduleReconnect();
      };
    } catch (error) {
      console.error('[WebSocket] Connection failed:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect() {
    if (!this.enabled || this.reconnectTimer) {
      return;
    }

    console.log(`[WebSocket] Reconnecting in ${this.reconnectTimeout / 1000}s`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectTimeout);
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    this.enabled = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

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
   * Send message to server
   */
  send(data: any) {
    if (!this.isConnected()) {
      console.warn('[WebSocket] Not connected, cannot send message');
      return false;
    }

    try {
      this.ws!.send(JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('[WebSocket] Failed to send message:', error);
      return false;
    }
  }

  /**
   * Listen for specific event type
   */
  on(eventType: WebSocketEventType | 'all' | 'connected' | 'disconnected', callback: EventCallback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(callback);
  }

  /**
   * Remove event listener
   */
  off(eventType: WebSocketEventType | 'all' | 'connected' | 'disconnected', callback: EventCallback) {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(eventType: string, data: any) {
    const callbacks = this.listeners.get(eventType as any);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback({ type: eventType as WebSocketEventType, ...data });
        } catch (error) {
          console.error('[WebSocket] Callback error:', error);
        }
      });
    }
  }
}

// Export singleton instance
export const wsClient = new WebSocketClient();
