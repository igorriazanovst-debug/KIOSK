import React, { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { adminApi } from '../services/adminApi';
import './Online.css';

interface OnlineDevice {
  id: string;
  deviceId: string;
  deviceName: string;
  appType: 'EDITOR' | 'PLAYER';
  status: string;
  lastSeenAt: string;
  wsOnline: boolean;
  ipAddress: string | null;
  license?: {
    id: string;
    licenseKey: string;
    plan: string;
    organization?: { name: string };
  };
  project?: { id: string; name: string } | null;
}

function secsAgo(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
}

function lastSeenLabel(iso: string, wsOnline: boolean) {
  const s = secsAgo(iso);
  if (wsOnline) return { label: 'WS Online', cls: 'ws' };
  if (s < 60) return { label: `${s}s ago`, cls: 'recent' };
  if (s < 120) return { label: `${Math.floor(s/60)}m ago`, cls: 'recent' };
  return { label: `${Math.floor(s/60)}m ago`, cls: 'stale' };
}

function DeviceTable({ devices, title, icon }: { devices: OnlineDevice[]; title: string; icon: string }) {
  if (devices.length === 0) return (
    <div className="online-section">
      <h2 className="online-section-title">{icon} {title} <span className="online-count">0</span></h2>
      <div className="online-empty">No devices online</div>
    </div>
  );
  return (
    <div className="online-section">
      <h2 className="online-section-title">{icon} {title} <span className="online-count">{devices.length}</span></h2>
      <div className="online-table-wrap">
        <table className="online-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>IP Address</th>
              <th>License</th>
              <th>Organization</th>
              <th>Project</th>
              <th>Plan</th>
              <th>Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {devices.map(d => {
              const ls = lastSeenLabel(d.lastSeenAt, d.wsOnline);
              return (
                <tr key={d.id}>
                  <td className="dev-name">{d.deviceName}</td>
                  <td className="dev-ip">{d.ipAddress ? <code>{d.ipAddress}</code> : <span className="no-ip">—</span>}</td>
                  <td><code className="lic-key">{d.license?.licenseKey ?? '—'}</code></td>
                  <td>{d.license?.organization?.name ?? '—'}</td>
                  <td>{d.project?.name ?? '—'}</td>
                  <td><span className={`plan-badge plan-${d.license?.plan?.toLowerCase() ?? 'unknown'}`}>{d.license?.plan ?? '—'}</span></td>
                  <td><span className={`ls-badge ls-${ls.cls}`}>{ls.label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Online() {
  const { token } = useAuthStore();
  const [devices, setDevices] = useState<OnlineDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetch = useCallback(async () => {
    if (!token) return;
    try {
      const res = await (window.fetch as any)(
        (import.meta as any).env.VITE_LICENSE_SERVER_URL
          ? `${(import.meta as any).env.VITE_LICENSE_SERVER_URL}/api/admin/devices/online`
          : '/api/admin/devices/online',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setDevices(data.data || []);
      setLastRefresh(new Date());
    } catch {}
    setLoading(false);
  }, [token]);

  useEffect(() => { fetch(); }, [fetch]);
  useEffect(() => {
    const t = setInterval(fetch, 30_000);
    return () => clearInterval(t);
  }, [fetch]);

  const players  = devices.filter(d => d.appType === 'PLAYER');
  const editors  = devices.filter(d => d.appType === 'EDITOR');

  return (
    <div className="online-page">
      <div className="online-header">
        <div className="online-dot-row">
          <span className="pulse-dot" />
          <span className="online-subtitle">Live — refreshes every 30s</span>
        </div>
        <div className="online-meta">
          Last refresh: {lastRefresh.toLocaleTimeString()}
          <button className="refresh-btn" onClick={fetch}>↻ Refresh</button>
        </div>
      </div>

      {loading ? (
        <div className="online-loading">Loading...</div>
      ) : (
        <>
          <DeviceTable devices={players} title="Player Devices" icon="▶️" />
          <DeviceTable devices={editors} title="Editor Devices"  icon="✏️" />
          <DeviceTable devices={devices} title="All Online"       icon="🖥️" />
        </>
      )}
    </div>
  );
}
