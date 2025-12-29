/**
 * Server Settings Component for Player
 * Configure server connection settings
 */

import React, { useState, useEffect } from 'react';
import { serverConnection } from '../services/server-connection';
import './ServerSettings.css';

export const ServerSettings: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [config, setConfig] = useState(serverConnection.getConfig());
  const [isConnected, setIsConnected] = useState(serverConnection.isConnected());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const checkConnection = () => {
      setIsConnected(serverConnection.isConnected());
    };

    const interval = setInterval(checkConnection, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSave = () => {
    setIsSaving(true);

    // Update configuration
    serverConnection.updateConfig(config);

    setTimeout(() => {
      setIsSaving(false);
      alert('✅ Settings saved!');
      onClose();
    }, 500);
  };

  const handleTestConnection = () => {
    if (!config.enabled) {
      alert('⚠️ Please enable server integration first');
      return;
    }

    // Try to connect
    const testConfig = { ...config, enabled: true };
    serverConnection.updateConfig(testConfig);

    setTimeout(() => {
      if (serverConnection.isConnected()) {
        alert('✅ Connection successful!');
      } else {
        alert('❌ Connection failed. Check URL and server status.');
      }
    }, 2000);
  };

  return (
    <div className="server-settings-overlay">
      <div className="server-settings-modal">
        <div className="modal-header">
          <h2>Server Settings</h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-content">
          {/* Enable/Disable */}
          <div className="setting-group">
            <label>
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) =>
                  setConfig({ ...config, enabled: e.target.checked })
                }
              />
              <span>Enable Server Integration</span>
            </label>
            <p className="setting-description">
              Connect to backend server to receive project deployments
            </p>
          </div>

          {/* Server URL */}
          <div className="setting-group">
            <label htmlFor="server-url">Server URL</label>
            <input
              id="server-url"
              type="text"
              value={config.url}
              onChange={(e) => setConfig({ ...config, url: e.target.value })}
              placeholder="ws://localhost:3001"
              disabled={!config.enabled}
            />
            <p className="setting-description">
              WebSocket server address (e.g., ws://192.168.1.100:3001)
            </p>
          </div>

          {/* Device Name */}
          <div className="setting-group">
            <label htmlFor="device-name">Device Name</label>
            <input
              id="device-name"
              type="text"
              value={config.deviceName}
              onChange={(e) =>
                setConfig({ ...config, deviceName: e.target.value })
              }
              placeholder="Kiosk Player"
              disabled={!config.enabled}
            />
            <p className="setting-description">
              Name shown in Device Manager on server
            </p>
          </div>

          {/* Device ID (read-only) */}
          <div className="setting-group">
            <label htmlFor="device-id">Device ID</label>
            <input
              id="device-id"
              type="text"
              value={config.deviceId}
              disabled
              style={{ fontFamily: 'monospace', fontSize: '12px' }}
            />
            <p className="setting-description">
              Unique device identifier (auto-generated)
            </p>
          </div>

          {/* Connection Status */}
          {config.enabled && (
            <div className="connection-status">
              <div className={`status-indicator ${isConnected ? 'online' : 'offline'}`}>
                <span className="status-dot"></span>
                <span className="status-text">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="button-secondary" onClick={onClose}>
            Cancel
          </button>
          {config.enabled && (
            <button
              className="button-test"
              onClick={handleTestConnection}
              disabled={isSaving}
            >
              Test Connection
            </button>
          )}
          <button
            className="button-primary"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};
