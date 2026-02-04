/**
 * Device Manager Component
 * View and manage connected devices (players)
 */

import React, { useState, useEffect } from 'react';
import { apiClient, Device } from '../services/api-client';
import { useServerStore } from '../stores/serverStore';
import { wsClient } from '../services/websocket-client';
import { useEditorStore } from '../stores/editorStore';
import './DeviceManager.css';

interface DeviceManagerProps {
  onClose: () => void;
}

export const DeviceManager: React.FC<DeviceManagerProps> = ({ onClose }) => {
  const { isConnected } = useServerStore();
  const { project } = useEditorStore();
  
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [deploying, setDeploying] = useState<string | null>(null);
  
  // Load devices on mount
  useEffect(() => {
    if (isConnected) {
      loadDevices();
      
      // Listen for device updates via WebSocket
      const handleDeviceUpdate = () => {
        loadDevices();
      };
      
      wsClient.on('device:connected', handleDeviceUpdate);
      wsClient.on('device:disconnected', handleDeviceUpdate);
      wsClient.on('device:status', handleDeviceUpdate);
      
      return () => {
        wsClient.off('device:connected', handleDeviceUpdate);
        wsClient.off('device:disconnected', handleDeviceUpdate);
        wsClient.off('device:status', handleDeviceUpdate);
      };
    }
  }, [isConnected]);
  
  const loadDevices = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await apiClient.getDevices();
      
      if (result.success && result.data) {
        setDevices(result.data);
      } else {
        setError(result.error || 'Failed to load devices');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };
  
  const handleDeploy = async (device: Device) => {
    if (!project) {
      alert('⚠️ No project to deploy');
      return;
    }
    
    if (device.status !== 'online') {
      alert('⚠️ Device is offline. Cannot deploy.');
      return;
    }
    
    if (!confirm(`Deploy current project to "${device.name}"?`)) {
      return;
    }
    
    setDeploying(device.id);
    
    try {
      const result = await apiClient.deployProject(device.id, {
        projectName: project.name || 'Untitled Project',
        projectData: project,
      });
      
      if (result.success) {
        alert(`✅ Project deployed to "${device.name}"!`);
      } else {
        alert(`❌ Deployment failed: ${result.error}`);
      }
    } catch (err: any) {
      alert(`❌ Error: ${err.message}`);
    } finally {
      setDeploying(null);
    }
  };
  
  const handleDelete = async (device: Device, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm(`Remove device "${device.name}"?\n\nThis will unregister the device from the server.`)) {
      return;
    }
    
    try {
      const result = await apiClient.deleteDevice(device.id);
      
      if (result.success) {
        loadDevices();
        if (selectedDevice?.id === device.id) {
          setSelectedDevice(null);
        }
      } else {
        alert(`❌ Failed to delete: ${result.error}`);
      }
    } catch (err: any) {
      alert(`❌ Error: ${err.message}`);
    }
  };
  
  const handleViewLogs = async (device: Device) => {
    setSelectedDevice(device);
    
    try {
      const result = await apiClient.getDeviceLogs(device.id, { limit: 50 });
      
      if (result.success && result.data) {
        // Show logs in modal or new window
        const logsText = result.data
          .map((log: any) => `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}`)
          .join('\n');
        
        const win = window.open('', 'Device Logs', 'width=800,height=600');
        if (win) {
          win.document.write(`
            <html>
              <head>
                <title>Logs: ${device.name}</title>
                <style>
                  body { font-family: monospace; padding: 20px; }
                  pre { background: #f5f5f5; padding: 10px; border-radius: 4px; }
                </style>
              </head>
              <body>
                <h2>Device Logs: ${device.name}</h2>
                <pre>${logsText || 'No logs found'}</pre>
              </body>
            </html>
          `);
        }
      } else {
        alert(`❌ Failed to load logs: ${result.error}`);
      }
    } catch (err: any) {
      alert(`❌ Error: ${err.message}`);
    }
  };
  
  const formatLastSeen = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };
  
  // Statistics
  const stats = {
    total: devices.length,
    online: devices.filter((d) => d.status === 'online').length,
    offline: devices.filter((d) => d.status === 'offline').length,
    error: devices.filter((d) => d.status === 'error').length,
  };
  
  if (!isConnected) {
    return (
      <div className="device-manager">
        <div className="library-header">
          <h2>Device Manager</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="library-content">
          <div className="empty-state">
            <p>⚠️ Not connected to server</p>
            <p>Enable server integration in settings to manage devices.</p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="device-manager">
      <div className="library-header">
        <h2>Device Manager</h2>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      
      <div className="device-stats">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Devices</div>
        </div>
        <div className="stat-card online">
          <div className="stat-value">{stats.online}</div>
          <div className="stat-label">Online</div>
        </div>
        <div className="stat-card offline">
          <div className="stat-value">{stats.offline}</div>
          <div className="stat-label">Offline</div>
        </div>
        {stats.error > 0 && (
          <div className="stat-card error">
            <div className="stat-value">{stats.error}</div>
            <div className="stat-label">Errors</div>
          </div>
        )}
      </div>
      
      <div className="library-content">
        {loading && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading devices...</p>
          </div>
        )}
        
        {error && (
          <div className="error-state">
            <p>❌ {error}</p>
            <button onClick={loadDevices}>Retry</button>
          </div>
        )}
        
        {!loading && !error && devices.length === 0 && (
          <div className="empty-state">
            <p>📱 No devices registered</p>
            <p>Devices will appear here when players connect to the server.</p>
          </div>
        )}
        
        {!loading && !error && devices.length > 0 && (
          <div className="devices-list">
            {devices.map((device) => (
              <div
                key={device.id}
                className={`device-card ${device.status}`}
              >
                <div className="device-header">
                  <div className="device-title">
                    <span className={`status-indicator ${device.status}`}></span>
                    <h3>{device.name}</h3>
                  </div>
                  <div className="device-actions">
                    <button
                      className="action-button"
                      onClick={() => handleViewLogs(device)}
                      title="View logs"
                    >
                      📋
                    </button>
                    <button
                      className="action-button deploy"
                      onClick={() => handleDeploy(device)}
                      disabled={device.status !== 'online' || deploying === device.id || !project}
                      title="Deploy current project"
                    >
                      {deploying === device.id ? '⏳' : '🚀'}
                    </button>
                    <button
                      className="action-button delete"
                      onClick={(e) => handleDelete(device, e)}
                      title="Remove device"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                
                <div className="device-info">
                  <div className="info-row">
                    <span className="label">ID:</span>
                    <span className="value" title={device.id}>
                      {device.id.substring(0, 16)}...
                    </span>
                  </div>
                  {device.os && (
                    <div className="info-row">
                      <span className="label">OS:</span>
                      <span className="value">{device.os}</span>
                    </div>
                  )}
                  {device.version && (
                    <div className="info-row">
                      <span className="label">Version:</span>
                      <span className="value">{device.version}</span>
                    </div>
                  )}
                  {device.ip_address && (
                    <div className="info-row">
                      <span className="label">IP:</span>
                      <span className="value">{device.ip_address}</span>
                    </div>
                  )}
                  <div className="info-row">
                    <span className="label">Last Seen:</span>
                    <span className="value">{formatLastSeen(device.last_seen)}</span>
                  </div>
                  {device.current_project_id && (
                    <div className="info-row">
                      <span className="label">Current Project:</span>
                      <span className="value" title={device.current_project_id}>
                        {device.current_project_id.substring(0, 16)}...
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="library-footer">
        <p>{stats.online} online • {stats.offline} offline • {stats.total} total</p>
        <button onClick={loadDevices} className="refresh-button">
          🔄 Refresh
        </button>
      </div>
    </div>
  );
};
