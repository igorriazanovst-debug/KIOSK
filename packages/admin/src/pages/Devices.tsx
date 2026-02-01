import React, { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { adminApi, Device } from '../services/adminApi';
import { Badge } from '../components/Badge';
import './Devices.css';

export function Devices() {
  const { token } = useAuthStore();
  const [devices, setDevices] = useState<Device[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const LIMIT = 15;

  const fetchDevices = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params: any = { page, limit: LIMIT };
      if (search) params.search = search;
      if (typeFilter) params.appType = typeFilter;
      const res = await adminApi.getDevices(token, params);
      setDevices(res.devices);
      setTotal(res.total);
    } catch (err: any) {
      console.error('Fetch devices error:', err);
    } finally {
      setLoading(false);
    }
  }, [token, page, search, typeFilter]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter]);

  const handleDeactivate = async (id: string) => {
    setDeactivatingId(id);
    try {
      await adminApi.deleteDevice(token!, id);
      setConfirmDelete(null);
      await fetchDevices();
    } catch (err: any) {
      alert('Deactivation failed: ' + (err.message || 'Unknown error'));
    } finally {
      setDeactivatingId(null);
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  const formatDateTime = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const getLastSeenBadge = (lastSeen: string) => {
    const diff = Date.now() - new Date(lastSeen).getTime();
    if (diff < 60_000) return { label: 'Just now', cls: 'online' };
    if (diff < 300_000) return { label: `${Math.floor(diff / 60_000)}m ago`, cls: 'online' };
    if (diff < 3_600_000) return { label: `${Math.floor(diff / 300_000) * 5}m ago`, cls: 'idle' };
    return { label: formatDateTime(lastSeen), cls: 'offline' };
  };

  return (
    <div className="devices-page">
      {/* Confirm Modal */}
      {confirmDelete && (
        <div className="confirm-overlay">
          <div className="confirm-modal">
            <h3>Deactivate Device</h3>
            <p>This will permanently deactivate the device. The seat will be freed for reuse.</p>
            <div className="confirm-actions">
              <button className="btn-danger" onClick={() => handleDeactivate(confirmDelete)} disabled={!!deactivatingId}>
                {deactivatingId ? 'Deactivating...' : 'Confirm Deactivate'}
              </button>
              <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="page-toolbar">
        <div className="toolbar-left">
          <input
            type="text"
            className="search-input"
            placeholder="Search devices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="filter-select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All types</option>
            <option value="EDITOR">Editor</option>
            <option value="PLAYER">Player</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table className="devices-table">
          <thead>
            <tr>
              <th>Device Name</th>
              <th>Device ID</th>
              <th>Type</th>
              <th>Status</th>
              <th>Last Seen</th>
              <th>Activated</th>
              <th>License</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="loading-cell">Loading...</td>
              </tr>
            ) : devices.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty-cell">No devices found</td>
              </tr>
            ) : (
              devices.map((dev) => {
                const lastSeen = getLastSeenBadge(dev.lastSeenAt);
                return (
                  <tr key={dev.id} className={dev.status === 'DEACTIVATED' ? 'row-deactivated' : ''}>
                    <td className="device-name">{dev.deviceName}</td>
                    <td>
                      <code className="device-id">{dev.deviceId.slice(0, 20)}{dev.deviceId.length > 20 ? '…' : ''}</code>
                    </td>
                    <td>
                      <Badge type="appType" value={dev.appType} />
                    </td>
                    <td>
                      <Badge type="deviceStatus" value={dev.status} />
                    </td>
                    <td>
                      <span className={`last-seen ${lastSeen.cls}`}>{lastSeen.label}</span>
                    </td>
                    <td>{formatDateTime(dev.activatedAt)}</td>
                    <td>
                      {dev.license ? (
                        <code className="license-ref">{dev.license.licenseKey?.slice(0, 14)}…</code>
                      ) : (
                        <span className="muted">{dev.licenseId?.slice(0, 8)}…</span>
                      )}
                    </td>
                    <td className="actions-cell">
                      {dev.status === 'ACTIVE' && (
                        <button
                          className="btn-deactivate"
                          onClick={() => setConfirmDelete(dev.id)}
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
          <span className="page-info">
            Page {page} of {totalPages} ({total} total)
          </span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}
