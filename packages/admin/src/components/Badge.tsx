import React from 'react';
import './Badge.css';

const BADGE_MAP: Record<string, Record<string, { bg: string; color: string }>> = {
  plan: {
    BASIC: { bg: '#dbeafe', color: '#1d4ed8' },
    PRO: { bg: '#ede9fe', color: '#6d28d9' },
    MAX: { bg: '#fef3c7', color: '#b45309' },
  },
  status: {
    ACTIVE: { bg: '#dcfce7', color: '#15803d' },
    SUSPENDED: { bg: '#fef3c7', color: '#b45309' },
    EXPIRED: { bg: '#fee2e2', color: '#dc2626' },
    CANCELLED: { bg: '#f1f5f9', color: '#64748b' },
  },
  appType: {
    EDITOR: { bg: '#ede9fe', color: '#6d28d9' },
    PLAYER: { bg: '#e0f2fe', color: '#0369a1' },
  },
  deviceStatus: {
    ACTIVE: { bg: '#dcfce7', color: '#15803d' },
    DEACTIVATED: { bg: '#f1f5f9', color: '#64748b' },
  },
};

interface BadgeProps {
  type: 'plan' | 'status' | 'appType' | 'deviceStatus';
  value: string;
}

export function Badge({ type, value }: BadgeProps) {
  const styles = BADGE_MAP[type]?.[value] || { bg: '#f1f5f9', color: '#475569' };
  const label = value.charAt(0) + value.slice(1).toLowerCase();

  return (
    <span
      className="badge"
      style={{ backgroundColor: styles.bg, color: styles.color }}
    >
      {label}
    </span>
  );
}
