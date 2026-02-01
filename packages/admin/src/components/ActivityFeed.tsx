import React from 'react';
import { AuditLog } from '../services/adminApi';
import './ActivityFeed.css';

const ACTION_ICONS: Record<string, string> = {
  DEVICE_ACTIVATED: '✅',
  DEVICE_DEACTIVATED: '❌',
  TOKEN_REFRESHED: '🔄',
  LICENSE_CREATED: '📝',
  LICENSE_UPDATED: '✏️',
  ADMIN_LOGIN: '🔐',
  ADMIN_LOGIN_FAILED: '⚠️',
};

const ACTION_COLORS: Record<string, string> = {
  DEVICE_ACTIVATED: '#22c55e',
  DEVICE_DEACTIVATED: '#ef4444',
  TOKEN_REFRESHED: '#3b82f6',
  LICENSE_CREATED: '#8b5cf6',
  LICENSE_UPDATED: '#f59e0b',
  ADMIN_LOGIN: '#6366f1',
  ADMIN_LOGIN_FAILED: '#dc2626',
};

interface ActivityFeedProps {
  logs: AuditLog[];
}

export function ActivityFeed({ logs }: ActivityFeedProps) {
  if (logs.length === 0) {
    return <div className="activity-feed activity-feed--empty">No recent activity</div>;
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 60_000) return 'Just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  };

  return (
    <div className="activity-feed">
      {logs.map((log) => {
        const icon = ACTION_ICONS[log.action] || '●';
        const color = ACTION_COLORS[log.action] || '#94a3b8';
        const label = log.action.replace(/_/g, ' ').toLowerCase();

        return (
          <div className="activity-item" key={log.id}>
            <div className="activity-icon" style={{ color }}>{icon}</div>
            <div className="activity-content">
              <span className="activity-action" style={{ color }}>{label}</span>
              {log.deviceId && (
                <span className="activity-detail">
                  device: <code>{log.deviceId.slice(0, 14)}…</code>
                </span>
              )}
              {log.ipAddress && (
                <span className="activity-detail">ip: {log.ipAddress}</span>
              )}
            </div>
            <span className="activity-time">{formatTime(log.createdAt)}</span>
          </div>
        );
      })}
    </div>
  );
}
