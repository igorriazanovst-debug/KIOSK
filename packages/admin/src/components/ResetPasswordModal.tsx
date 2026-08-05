import React, { useEffect, useState, useCallback } from 'react';
import './CreateLicenseModal.css';

const BASE = import.meta.env.VITE_LICENSE_SERVER_URL || '';

interface ResetPasswordModalProps { token: string; onClose: () => void; }
interface OrgOption { id: string; name: string; }
interface OrgUser { email: string; role: string; type: string; licenseKey?: string | null; }
interface ResetResult { email: string; tempPassword: string; account: string; role?: string; }

export function ResetPasswordModal({ token, onClose }: ResetPasswordModalProps) {
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(true);
  const [orgId, setOrgId] = useState('');

  const [users, setUsers] = useState<OrgUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  const [useCustom, setUseCustom] = useState(false);
  const [customPass, setCustomPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResetResult | null>(null);

  useEffect(() => {
    (async () => {
      setOrgsLoading(true);
      try {
        const res = await fetch(`${BASE}/api/admin/organizations`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setOrgs((data.data || []) as OrgOption[]);
      } catch { setOrgs([]); }
      finally { setOrgsLoading(false); }
    })();
  }, [token]);

  const loadUsers = useCallback(async (id: string) => {
    setUserEmail('');
    if (!id) { setUsers([]); return; }
    setUsersLoading(true);
    try {
      const res = await fetch(`${BASE}/api/admin/organizations/${id}/users`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setUsers((data.data || []) as OrgUser[]);
    } catch { setUsers([]); }
    finally { setUsersLoading(false); }
  }, [token]);

  const onOrgChange = (id: string) => { setOrgId(id); loadUsers(id); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEmail) { setError('Выберите пользователя'); return; }
    if (useCustom && customPass.trim().length < 6) { setError('Пароль минимум 6 символов'); return; }
    setLoading(true); setError(null);
    try {
      const body: any = { email: userEmail };
      if (useCustom) body.newPassword = customPass.trim();
      const res = await fetch(`${BASE}/api/admin/users/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setResult(data.data || data);
    } catch (err: any) {
      setError(err.message || 'Не удалось сбросить пароль');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2>Сброс пароля</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        {!result ? (
          <form className="modal-body" onSubmit={submit}>
            <div className="form-group">
              <label>Организация</label>
              <select value={orgId} onChange={(e) => onOrgChange(e.target.value)} disabled={orgsLoading}>
                <option value="">{orgsLoading ? 'Загрузка…' : '— выберите организацию —'}</option>
                {orgs.map((o) => (<option key={o.id} value={o.id}>{o.name}</option>))}
              </select>
            </div>

            <div className="form-group">
              <label>Пользователь</label>
              <select value={userEmail} onChange={(e) => setUserEmail(e.target.value)} disabled={!orgId || usersLoading}>
                <option value="">
                  {!orgId ? '— сначала выберите организацию —'
                    : usersLoading ? 'Загрузка…'
                    : users.length ? '— выберите пользователя —'
                    : 'нет пользователей'}
                </option>
                {users.map((u) => (
                  <option key={u.email} value={u.email}>
                    {u.email} · {u.role}{u.licenseKey ? ` · ${u.licenseKey}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={useCustom} onChange={(e) => setUseCustom(e.target.checked)} style={{ width: 'auto' }} />
                Задать пароль вручную
              </label>
            </div>
            {useCustom && (
              <div className="form-group">
                <label>Новый пароль</label>
                <input type="text" value={customPass} onChange={(e) => setCustomPass(e.target.value)} placeholder="минимум 6 символов" />
              </div>
            )}

            {error && <div className="form-error">{error}</div>}

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={onClose}>Отмена</button>
              <button type="submit" className="btn-primary" disabled={loading || !userEmail}>{loading ? 'Сброс…' : 'Сбросить пароль'}</button>
            </div>
          </form>
        ) : (
          <div className="modal-body">
            <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '14px 16px' }}>
              <strong style={{ color: '#22c55e' }}>✓ Пароль сброшен</strong>
              <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.8 }}>
                <div><b>Email:</b> {result.email}</div>
                <div><b>Тип аккаунта:</b> {result.account}{result.role ? ` (${result.role})` : ''}</div>
                <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(0,0,0,0.3)', borderRadius: 6, display: 'inline-block' }}>
                  <b>Новый пароль:</b>{' '}
                  <code style={{ fontSize: 15, color: '#fbbf24' }}>{result.tempPassword}</code>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>(сохрани — повторно не покажется)</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-primary" onClick={onClose}>Готово</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
