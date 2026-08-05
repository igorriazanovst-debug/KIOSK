import React, { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { adminApi, License } from '../services/adminApi';
import { CreateLicenseModal } from '../components/CreateLicenseModal';
import { LicenseDetailModal } from '../components/LicenseDetailModal';
import { Badge } from '../components/Badge';
import '../components/CreateLicenseModal.css';
import './Licenses.css';

const BASE = import.meta.env.VITE_LICENSE_SERVER_URL || '';

interface AddUserResult { email: string; role: string; tempPassword: string; }

function AddUserModal({ license, token, onClose }: { license: License; token: string; onClose: () => void; }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('MEMBER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<AddUserResult[]>([]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${BASE}/api/admin/licenses/${license.id}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add user');
      const r = data.data || data;
      setAdded((p) => [...p, { email: r.email, role: r.role, tempPassword: r.tempPassword }]);
      setEmail('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h2>Пользователи лицензии</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 13, color: 'var(--text-secondary, #aaa)', marginBottom: 8 }}>
            {license.organization?.name || '—'} · {license.plan} · <code>{license.licenseKey}</code>
          </div>
          <form className="form-row" onSubmit={submit}>
            <div className="form-group" style={{ flex: 2 }}>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" autoFocus />
            </div>
            <div className="form-group">
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="MEMBER">Member</option>
                <option value="OWNER">Owner</option>
              </select>
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button type="submit" className="btn-primary" disabled={loading || !email.trim()}>{loading ? '…' : 'Добавить'}</button>
            </div>
          </form>
          {error && <div className="form-error">{error}</div>}
          {added.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {added.map((u, i) => (
                <div key={i} style={{ fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border, #2a2a2a)' }}>
                  {u.email} · <b>{u.role}</b> · пароль: <code style={{ color: '#fbbf24' }}>{u.tempPassword}</code>
                </div>
              ))}
              <div style={{ fontSize: 11, color: 'var(--text-muted, #888)', marginTop: 4 }}>Пароли показываются один раз — сохраните.</div>
            </div>
          )}
          <div className="modal-footer">
            <button type="button" className="btn-primary" onClick={onClose}>Готово</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Licenses() {
  const { token } = useAuthStore();
  const [licenses, setLicenses] = useState<License[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [addUserLicense, setAddUserLicense] = useState<License | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [detailLicenseId, setDetailLicenseId] = useState<string | null>(null);

  const LIMIT = 15;

  const fetchLicenses = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params: any = { page, limit: LIMIT };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await adminApi.getLicenses(token, params);
      setLicenses(res.licenses);
      setTotal(res.total);
    } catch (err: any) {
      console.error('Fetch licenses error:', err);
    } finally {
      setLoading(false);
    }
  }, [token, page, search, statusFilter]);

  useEffect(() => { fetchLicenses(); }, [fetchLicenses]);
  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    try {
      await adminApi.updateLicense(token!, id, { status: newStatus });
      await fetchLicenses();
    } catch (err: any) {
      alert('Update failed: ' + (err.message || 'Unknown error'));
    } finally {
      setUpdatingId(null);
    }
  };

  const totalPages = Math.ceil(total / LIMIT);
  const formatDate = (iso: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="licenses-page">
      <div className="page-toolbar">
        <div className="toolbar-left">
          <input type="text" className="search-input" placeholder="Search licenses..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="EXPIRED">Expired</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        <button className="btn-primary" onClick={() => setShowCreateModal(true)}>+ Create License</button>
      </div>

      <div className="table-wrapper">
        <table className="licenses-table">
          <thead>
            <tr>
              <th>Organization</th>
              <th>License Key</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Seats (Ed / Pl)</th>
              <th>Valid Until</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="loading-cell">Loading...</td></tr>
            ) : licenses.length === 0 ? (
              <tr><td colSpan={8} className="empty-cell">No licenses found</td></tr>
            ) : (
              licenses.map((lic) => (
                <tr key={lic.id}>
                  <td>{lic.organization?.name || '—'}</td>
                  <td className="key-cell"><code>{lic.licenseKey}</code></td>
                  <td><Badge type="plan" value={lic.plan} /></td>
                  <td><Badge type="status" value={lic.status} /></td>
                  <td className="seats-cell">{lic.seatsEditor} / {lic.seatsPlayer}</td>
                  <td>{formatDate(lic.validUntil)}</td>
                  <td>{formatDate(lic.createdAt)}</td>
                  <td className="actions-cell">
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <select className="status-select" value={lic.status} disabled={updatingId === lic.id} onChange={(e) => handleStatusChange(lic.id, e.target.value)}>
                        <option value="ACTIVE">Active</option>
                        <option value="SUSPENDED">Suspend</option>
                        <option value="EXPIRED">Expire</option>
                        <option value="CANCELLED">Cancel</option>
                      </select>
                      <button className="btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setAddUserLicense(lic)}>+ User</button>
                      <button className="btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setDetailLicenseId(lic.id)}>Manage</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
          <span className="page-info">Page {page} of {totalPages} ({total} total)</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next →</button>
        </div>
      )}

      {showCreateModal && token && (
        <CreateLicenseModal token={token} onClose={() => setShowCreateModal(false)} onCreated={fetchLicenses} />
      )}

      {addUserLicense && token && (
        <AddUserModal license={addUserLicense} token={token} onClose={() => setAddUserLicense(null)} />
      )}

      {/* Detail / Manage Modal */}
      {detailLicenseId && token && (
        <LicenseDetailModal
          token={token}
          licenseId={detailLicenseId}
          onClose={() => {
            setDetailLicenseId(null);
            fetchLicenses();
          }}
        />
      )}
    </div>
  );
}
