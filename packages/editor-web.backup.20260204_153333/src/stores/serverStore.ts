/**
 * Server Settings Store
 * Manages server configuration and connection state
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient, ServerConfig } from '../services/api-client';
import { wsClient } from '../services/websocket-client';

interface ServerState {
  // Configuration
  config: ServerConfig;
  
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  lastError: string | null;
  
  // Server info
  serverVersion: string | null;
  serverUptime: number | null;
  
  // Actions
  setConfig: (config: Partial<ServerConfig>) => void;
  connect: () => Promise<void>;
  disconnect: () => void;
  checkConnection: () => Promise<boolean>;
}

export const useServerStore = create<ServerState>()(
  persist(
    (set, get) => ({
      // Initial state
      config: {
        url: 'http://localhost:3001',
        enabled: false,
      },
      isConnected: false,
      isConnecting: false,
      lastError: null,
      serverVersion: null,
      serverUptime: null,

      // Update configuration
      setConfig: (newConfig) => {
        const config = { ...get().config, ...newConfig };
        set({ config });
        
        // Initialize clients with new config
        apiClient.init(config);
        
        if (config.enabled) {
          wsClient.init(config.url, true);
        } else {
          wsClient.disconnect();
        }
      },

      // Connect to server
      connect: async () => {
        const { config } = get();
        
        if (!config.enabled) {
          set({ lastError: 'Server integration is disabled' });
          return;
        }

        set({ isConnecting: true, lastError: null });

        try {
          // Initialize API client
          apiClient.init(config);
          
          // Check health
          const health = await apiClient.checkHealth();
          
          if (health.success && health.data) {
            set({
              isConnected: true,
              isConnecting: false,
              serverVersion: health.data.version,
              serverUptime: health.data.uptime,
              lastError: null,
            });
            
            // Initialize WebSocket - convert http:// to ws://
            const wsUrl = config.url.replace(/^http/, 'ws');
            wsClient.init(wsUrl, true);
            
            console.log('✅ Connected to server:', config.url);
            console.log('🔌 WebSocket URL:', wsUrl);
          } else {
            throw new Error(health.error || 'Connection failed');
          }
        } catch (error: any) {
          console.error('❌ Server connection failed:', error);
          set({
            isConnected: false,
            isConnecting: false,
            lastError: error.message || 'Connection failed',
          });
        }
      },

      // Disconnect from server
      disconnect: () => {
        wsClient.disconnect();
        set({
          isConnected: false,
          serverVersion: null,
          serverUptime: null,
        });
      },

      // Check if connection is alive
      checkConnection: async () => {
        const { config } = get();
        
        if (!config.enabled) {
          return false;
        }

        try {
          const health = await apiClient.checkHealth();
          
          if (health.success) {
            set({
              isConnected: true,
              serverVersion: health.data?.version || null,
              serverUptime: health.data?.uptime || null,
            });
            return true;
          } else {
            set({ isConnected: false });
            return false;
          }
        } catch (error) {
          set({ isConnected: false });
          return false;
        }
      },
    }),
    {
      name: 'kiosk-server-settings',
      partialize: (state) => ({
        config: state.config,
      }),
    }
  )
);
