/**
 * Server Settings Component
 * Allows users to configure server connection
 */

import React, { useState, useEffect } from 'react';
import { useServerStore } from '../stores/serverStore';
import './ServerSettings.css';

export const ServerSettings: React.FC = () => {
  const {
    config,
    isConnected,
    isConnecting,
    lastError,
    serverVersion,
    serverUptime,
    setConfig,
    connect,
    disconnect,
    checkConnection,
  } = useServerStore();

  const [localUrl, setLocalUrl] = useState(config.url);
  const [showSettings, setShowSettings] = useState(false);

  // Check connection on mount if enabled
  useEffect(() => {
    if (config.enabled) {
      checkConnection();
    }
  }, []);

  const handleSave = async () => {
    setConfig({ url: localUrl });
    if (config.enabled) {
      await connect();
    }
    setShowSettings(false);
  };

  const handleToggle = async () => {
    const newEnabled = !config.enabled;
    setConfig({ enabled: newEnabled });
    
    if (newEnabled) {
      await connect();
    } else {
      disconnect();
    }
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours}h ${minutes}m ${secs}s`;
  };

  return (
    <div className="server-settings">
      {/* Status Indicator */}
      <div className="server-status">
        <button
          className={`status-button ${isConnected ? 'connected' : 'disconnected'}`}
          onClick={() => setShowSettings(!showSettings)}
          title={isConnected ? 'Server connected' : 'Server disconnected'}
        >
          <span className={`status-dot ${isConnected ? 'online' : 'offline'}`}></span>
          <span>Server</span>
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="server-settings-panel">
          <div className="settings-header">
            <h3>Server Settings</h3>
            <button className="close-button" onClick={() => setShowSettings(false)}>
              ×
            </button>
          </div>

          <div className="settings-content">
            {/* Enable/Disable */}
            <div className="setting-group">
              <label>
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={handleToggle}
                  disabled={isConnecting}
                />
                <span>Enable Server Integration</span>
              </label>
              <p className="setting-description">
                Connect to backend server for templates, media library, and device management
              </p>
            </div>

            {/* Server URL */}
            <div className="setting-group">
              <label htmlFor="server-url">Server URL</label>
              <input
                id="server-url"
                type="text"
                value={localUrl}
                onChange={(e) => setLocalUrl(e.target.value)}
                placeholder="http://localhost:3001"
                disabled={!config.enabled || isConnecting}
              />
              <p className="setting-description">
                Backend server address (e.g., http://192.168.1.100 or https://server.example.com)
              </p>
            </div>

            {/* Connection Status */}
            {config.enabled && (
              <div className="connection-status">
                {isConnecting && (
                  <div className="status-message connecting">
                    <span className="spinner"></span>
                    Connecting...
                  </div>
                )}

                {!isConnecting && isConnected && (
                  <div className="status-message success">
                    <span className="icon">✓</span>
                    <div>
                      <strong>Connected</strong>
                      {serverVersion && <p>Server v{serverVersion}</p>}
                      {serverUptime !== null && <p>Uptime: {formatUptime(serverUptime)}</p>}
                    </div>
                  </div>
                )}

                {!isConnecting && !isConnected && lastError && (
                  <div className="status-message error">
                    <span className="icon">⚠</span>
                    <div>
                      <strong>Connection Failed</strong>
                      <p>{lastError}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="settings-actions">
              <button
                className="button-secondary"
                onClick={() => {
                  setLocalUrl(config.url);
                  setShowSettings(false);
                }}
              >
                Cancel
              </button>
              <button
                className="button-primary"
                onClick={handleSave}
                disabled={isConnecting || localUrl === config.url}
              >
                {isConnecting ? 'Connecting...' : 'Save & Connect'}
              </button>
            </div>

            {/* Help */}
            <div className="settings-help">
              <h4>Need Help?</h4>
              <ul>
                <li>Make sure the server is running on the specified URL</li>
                <li>Check that port 3001 (or your custom port) is accessible</li>
                <li>Verify firewall settings allow connections</li>
                <li>For remote servers, use the external IP or domain name</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
