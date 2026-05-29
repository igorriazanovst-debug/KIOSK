import React, { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { adminApi } from '../services/adminApi';
import { clientApi, InviteResult } from '../services/adminApi';
import { InviteClientModal } from '../components/InviteClientModal';
import { Badge } from '../components/Badge';
import './Licenses.css';

interface ClientLicense {
  id: string;
  licenseKey: string;
  plan: string;
  status: string;
  seatsEditor: number;
  seatsPlayer: number;
  validUntil: string;
  createdAt: string;
  organization?: { id: string; name: string };
}

interface AddUserResult {
  email: string;
  role: string;
  tempPassword: string;
  organizationName: string;
  licenseId: string;
}

interface AddUserModalProps {
  license: ClientLicense;
  token: string;
  onClose: () => void;
  onSuccess: (result: AddUserResult) => void;
}

function AddUserModal({ license, token, onClose, onSuccess }: AddUserModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('MEMBER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const BASE = import.meta.env.VITE_LICENSE_SERVER_URL || '';
      const res = await fetch(`${BASE}/api/admin/licenses/${license.id}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add user');
      onSuccess(data.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h2>Add User to License</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: '4px 0 12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          Organization: <b>{license.organization?.name}</b> · Plan: <b>{license.plan}</b>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Role</label>
            <select
              className="form-select"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="MEMBER">Member</option>
              <option value="OWNER">Owner</option>
            </select>
          </div>
          {error && <div className="form-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading || !email.trim()}>
              {loading ? 'Adding...' : 'Add User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function Clients() {
  const { token } = useAuthStore();
  const [licenses, setLicenses] = useState<ClientLicense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);
  const [addUserLicense, setAddUserLicense] = useState<ClientLicense | null>(null);
  const [addUserResult, setAddUserResult] = useState<AddUserResult | null>(null);

  const fetchLicenses = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await adminApi.getLicenses(token, { page: 1, limit: 100 });
      setLicenses(res.licenses as any);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchLicenses(); }, [fetchLicenses]);

  const handleInvite = async (data: { email: string; plan: string; organizationName: string; validUntil: string }) => {
    const result = await clientApi.inviteClient(token!, data);
    setInviteResult(result);
    setShowInvite(false);
    fetchLicenses();
  };

  const handleAddUserSuccess = (result: AddUserResult) => {
    setAddUserLicense(null);
    setAddUserResult(result);
  };

  const formatDate = (iso: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="licenses-page">
      <div className="page-toolbar">
        <div className="toolbar-left">
          <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            {licenses.length} client{licenses.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button className="btn-primary" onClick={() => setShowInvite(true)}>
          + Invite Client
        </button>
      </div>

      {/* Результат создания клиента */}
      {inviteResult && (
        <div style={{
          background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: '8px', padding: '16px 20px', marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <strong style={{ color: '#22c55e' }}>✓ Client created successfully</strong>
              <div style={{ marginTop: '8px', fontSize: '13px', lineHeight: '1.8' }}>
                <div><b>Email:</b> {inviteResult.email}</div>
                <div><b>Organization:</b> {inviteResult.organizationName}</div>
                <div><b>Plan:</b> {inviteResult.plan}</div>
                <div><b>License Key:</b> <code>{inviteResult.licenseKey}</code></div>
                <div style={{ marginTop: '8px', padding: '8px 12px',
                  background: 'rgba(0,0,0,0.3)', borderRadius: '6px', display: 'inline-block' }}>
                  <b>Temporary Password:</b>{' '}
                  <code style={{ fontSize: '15px', color: '#fbbf24' }}>{inviteResult.tempPassword}</code>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                    (save now — won't be shown again)
                  </span>
                </div>
              </div>
            </div>
            <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', fontSize: '18px' }} onClick={() => setInviteResult(null)}>✕</button>
          </div>
        </div>
      )}

      {/* Результат добавления пользователя */}
      {addUserResult && (
        <div style={{
          background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
          borderRadius: '8px', padding: '16px 20px', marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <strong style={{ color: '#3b82f6' }}>✓ User added successfully</strong>
              <div style={{ marginTop: '8px', fontSize: '13px', lineHeight: '1.8' }}>
                <div><b>Email:</b> {addUserResult.email}</div>
                <div><b>Role:</b> {addUserResult.role}</div>
                <div><b>Organization:</b> {addUserResult.organizationName}</div>
                <div style={{ marginTop: '8px', padding: '8px 12px',
                  background: 'rgba(0,0,0,0.3)', borderRadius: '6px', display: 'inline-block' }}>
                  <b>Temporary Password:</b>{' '}
                  <code style={{ fontSize: '15px', color: '#fbbf24' }}>{addUserResult.tempPassword}</code>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                    (save now — won't be shown again)
                  </span>
                </div>
              </div>
            </div>
            <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', fontSize: '18px' }} onClick={() => setAddUserResult(null)}>✕</button>
          </div>
        </div>
      )}

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
              <tr><td colSpan={8} className="empty-cell">No clients yet. Click "Invite Client" to create one.</td></tr>
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
                  <td>
                    <button
                      className="btn-secondary"
                      style={{ fontSize: '12px', padding: '4px 10px' }}
                      onClick={() => setAddUserLicense(lic)}
                    >
                      + Add User
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showInvite && (
        <InviteClientModal onSubmit={handleInvite} onClose={() => setShowInvite(false)} />
      )}

      {addUserLicense && token && (
        <AddUserModal
          license={addUserLicense}
          token={token}
          onClose={() => setAddUserLicense(null)}
          onSuccess={handleAddUserSuccess}
        />
      )}
    </div>
  );
}
