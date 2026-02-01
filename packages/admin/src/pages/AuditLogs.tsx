import React, { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { adminApi, AuditLog } from '../services/adminApi';
import './AuditLogs.css';

const ACTION_COLORS: Record<string, string> = {
  DEVICE_ACTIVATED: '#22c55e',
  DEVICE_DEACTIVATED: '#ef4444',
  TOKEN_REFRESHED: '#3b82f6',
  LICENSE_CREATED: '#8b5cf6',
  LICENSE_UPDATED: '#f59e0b',
  ADMIN_LOGIN: '#6366f1',
  ADMIN_LOGIN_FAILED: '#dc2626',
};

export function AuditLogs() {
  const { token } = useAuthStore();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const LIMIT = 20;

  const fetchLogs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params: any = { page, limit: LIMIT };
      if (search) params.search = search;
      if (actionFilter) params.action = actionFilter;
      const res = await adminApi.getAuditLogs(token, params);
      setLogs(res.logs);
      setTotal(res.total);
    } catch (err: any) {
      console.error('Fetch audit logs error:', err);
    } finally {
      setLoading(false);
    }
  }, [token, page, search, actionFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    setPage(1);
  }, [search, actionFilter]);

  const totalPages = Math.ceil(total / LIMIT);

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Get unique actions from current page for filter (or use known set)
  const knownActions = [
    'DEVICE_ACTIVATED',
    'DEVICE_DEACTIVATED',
    'TOKEN_REFRESHED',
    'LICENSE_CREATED',
    'LICENSE_UPDATED',
    'ADMIN_LOGIN',
    'ADMIN_LOGIN_FAILED',
  ];

  return (
    <div className="audit-page">
      {/* Toolbar */}
      <div className="page-toolbar">
        <div className="toolbar-left">
          <input
            type="text"
            className="search-input"
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="filter-select"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <option value="">All actions</option>
            {knownActions.map((a) => (
              <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
        <span className="total-count">{total} entries</span>
      </div>

      {/* Logs Table */}
      <div className="table-wrapper">
        <table className="audit-table">
          <thead>
            <tr>
              <th className="col-time">Time</th>
              <th className="col-action">Action</th>
              <th className="col-device">Device</th>
              <th className="col-license">License</th>
              <th className="col-ip">IP</th>
              <th className="col-expand"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="loading-cell">Loading...</td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-cell">No audit logs found</td>
              </tr>
            ) : (
              logs.map((log) => {
                const isExpanded = expandedId === log.id;
                const actionColor = ACTION_COLORS[log.action] || '#94a3b8';
                return (
                  <React.Fragment key={log.id}>
                    <tr className={isExpanded ? 'row-expanded' : ''}>
                      <td className="col-time">{formatDateTime(log.createdAt)}</td>
                      <td className="col-action">
                        <span className="action-badge" style={{ borderLeftColor: actionColor }}>
                          {log.action.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="col-device">
                        {log.deviceId ? <code>{log.deviceId.slice(0, 18)}{log.deviceId.length > 18 ? '…' : ''}</code> : <span className="muted">—</span>}
                      </td>
                      <td className="col-license">
                        {log.licenseId ? <code>{log.licenseId.slice(0, 8)}…</code> : <span className="muted">—</span>}
                      </td>
                      <td className="col-ip">
                        <span className="muted">{log.ipAddress || '—'}</span>
                      </td>
                      <td className="col-expand">
                        {log.details && (
                          <button
                            className="expand-btn"
                            onClick={() => setExpandedId(isExpanded ? null : log.id)}
                          >
                            {isExpanded ? '▲' : '▼'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {isExpanded && log.details && (
                      <tr className="details-row">
                        <td colSpan={6}>
                          <div className="details-content">
                            <pre>{JSON.stringify(log.details, null, 2)}</pre>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
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
