import React, { useEffect, useState, useRef } from 'react';
import { apiClient } from '../services/api-client';
import { X, RefreshCw, Monitor, Wifi, WifiOff } from 'lucide-react';
import './DeviceMonitorDialog.css';

interface Device {
  id: string;
  name: string;
  status: string;
  ip_address: string;
  os: string;
  version: string;
  last_seen: string;
}

interface DeviceMonitorDialogProps {
  onClose: () => void;
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return '—';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}с назад`;
  if (diff < 3600) return `${Math.floor(diff / 60)}м назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}ч назад`;
  return `${Math.floor(diff / 86400)}д назад`;
}

const DeviceMonitorDialog: React.FC<DeviceMonitorDialogProps> = ({ onClose }) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    try {
      const res = await fetch('/api/devices', {
        headers: { 'Authorization': `Bearer ${apiClient.getToken()}` }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDevices(data.data || []);
      setLastUpdate(new Date());
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 15000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const online = devices.filter(d => d.status === 'online');
  const offline = devices.filter(d => d.status !== 'online');

  return (
    <div className="dm-overlay" onClick={(e) => { if ((e.target as HTMLElement).classList.contains('dm-overlay')) onClose(); }}>
      <div className="dm-dialog">
        <div className="dm-header">
          <div className="dm-title">
            <Monitor size={18} />
            <span>Устройства</span>
            <span className="dm-count online">{online.length} онлайн</span>
            {offline.length > 0 && <span className="dm-count offline">{offline.length} офлайн</span>}
          </div>
          <div className="dm-header-actions">
            {lastUpdate && <span className="dm-last-update">обновлено {timeAgo(lastUpdate.toISOString())}</span>}
            <button className="dm-icon-btn" onClick={load} title="Обновить"><RefreshCw size={15} /></button>
            <button className="dm-icon-btn" onClick={onClose}><X size={15} /></button>
          </div>
        </div>

        <div className="dm-body">
          {loading && <div className="dm-loading">Загрузка...</div>}
          {error && <div className="dm-error">Ошибка: {error}</div>}
          {!loading && !error && devices.length === 0 && (
            <div className="dm-empty">
              <Monitor size={32} opacity={0.3} />
              <p>Нет подключённых устройств</p>
              <small>Запустите плеер — он автоматически появится здесь</small>
            </div>
          )}
          {!loading && devices.length > 0 && (
            <table className="dm-table">
              <thead>
                <tr>
                  <th>Статус</th>
                  <th>Устройство</th>
                  <th>IP</th>
                  <th>ОС</th>
                  <th>Последняя активность</th>
                </tr>
              </thead>
              <tbody>
                {[...online, ...offline].map(d => (
                  <tr key={d.id} className={d.status === 'online' ? 'row-online' : 'row-offline'}>
                    <td>
                      {d.status === 'online'
                        ? <span className="status-badge online"><Wifi size={12} /> онлайн</span>
                        : <span className="status-badge offline"><WifiOff size={12} /> офлайн</span>
                      }
                    </td>
                    <td className="cell-name">{d.name || d.id.slice(0, 12)}</td>
                    <td className="cell-mono">{d.ip_address || '—'}</td>
                    <td className="cell-mono">{d.os || '—'}</td>
                    <td className="cell-time">{timeAgo(d.last_seen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="dm-footer">Автообновление каждые 15 сек</div>
      </div>
    </div>
  );
};

export default DeviceMonitorDialog;
