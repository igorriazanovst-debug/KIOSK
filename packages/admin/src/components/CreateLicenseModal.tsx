import React, { useEffect, useState, useCallback } from 'react';
import './CreateLicenseModal.css';

const BASE = import.meta.env.VITE_LICENSE_SERVER_URL || '';
const NEW = '__new__';

interface OrgOption { id: string; name: string; }
interface CreatedLicense { licenseId: string; licenseKey: string; orgLabel: string; }
interface InviteResult { email: string; role: string; tempPassword: string; }

interface CreateLicenseModalProps {
  token: string;
  onClose: () => void;
  onCreated: () => void;
}

const planDefaults: Record<string, { editor: number; player: number }> = {
  BASIC: { editor: 1, player: 3 },
  PRO: { editor: 5, player: 10 },
  MAX: { editor: 20, player: 50 },
};

export function CreateLicenseModal({ token, onClose, onCreated }: CreateLicenseModalProps) {
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(true);
  const [orgChoice, setOrgChoice] = useState<string>(NEW);
  const [newOrgName, setNewOrgName] = useState('');
  const [plan, setPlan] = useState('PRO');
  const [seatsEditor, setSeatsEditor] = useState(5);
  const [seatsPlayer, setSeatsPlayer] = useState(10);
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date(); d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedLicense | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [invited, setInvited] = useState<InviteResult[]>([]);

  const loadOrgs = useCallback(async () => {
    setOrgsLoading(true);
    try {
      const res = await fetch(`${BASE}/api/admin/licenses?limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const list = (data.data || data.licenses || []) as any[];
      const map = new Map<string, string>();
      list.forEach((l) => {
        const o = l.organization;
        if (o && o.id) map.set(o.id, o.name || o.id);
      });
      const opts = Array.from(map.entries()).map(([id, name]) => ({ id, name }));
      opts.sort((a, b) => a.name.localeCompare(b.name));
      setOrgs(opts);
      setOrgChoice(opts.length ? opts[0].id : NEW);
    } catch {
      setOrgs([]); setOrgChoice(NEW);
    } finally {
      setOrgsLoading(false);
    }
  }, [token]);

  useEffect(() => { loadOrgs(); }, [loadOrgs]);

  const handlePlanChange = (p: string) => {
    setPlan(p);
    const d = planDefaults[p];
    if (d) { setSeatsEditor(d.editor); setSeatsPlayer(d.player); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const useNew = orgChoice === NEW;
    if (useNew && !newOrgName.trim()) { setError('Введите название новой организации'); return; }
    if (!useNew && !orgChoice) { setError('Выберите организацию'); return; }

    const payload: any = {
      plan, seatsEditor, seatsPlayer,
      validUntil: new Date(validUntil).toISOString(),
    };
    if (useNew) payload.organizationName = newOrgName.trim();
    else payload.organizationId = orgChoice;

    setSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/admin/licenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const lic = data.data || data;
      setCreated({
        licenseId: lic.id,
        licenseKey: lic.licenseKey,
        orgLabel: useNew ? newOrgName.trim() : (orgs.find((o) => o.id === orgChoice)?.name || orgChoice),
      });
    } catch (err: any) {
      setError(err.message || 'Не удалось создать лицензию');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!created || !inviteEmail.trim()) return;
    setInviting(true); setInviteError(null);
    try {
      const res = await fetch(`${BASE}/api/admin/licenses/${created.licenseId}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const r = data.data || data;
      setInvited((prev) => [...prev, { email: r.email, role: r.role, tempPassword: r.tempPassword }]);
      setInviteEmail('');
    } catch (err: any) {
      setInviteError(err.message || 'Не удалось пригласить пользователя');
    } finally {
      setInviting(false);
    }
  };

  const finish = () => { onCreated(); onClose(); };

  return (
    <div className="modal-overlay" onClick={created ? undefined : onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{created ? 'Лицензия создана' : 'Новая лицензия'}</h2>
          <button className="modal-close" onClick={created ? finish : onClose}>&times;</button>
        </div>

        {!created ? (
          <form className="modal-body" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Организация</label>
              <select value={orgChoice} onChange={(e) => setOrgChoice(e.target.value)} disabled={orgsLoading}>
                <option value={NEW}>➕ Создать новую организацию</option>
                {orgs.map((o) => (<option key={o.id} value={o.id}>{o.name}</option>))}
              </select>
              {orgsLoading && <span className="form-hint">Загрузка организаций…</span>}
            </div>

            {orgChoice === NEW && (
              <div className="form-group">
                <label>Название организации</label>
                <input type="text" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} placeholder="Company Ltd." autoFocus />
              </div>
            )}

            <div className="form-group">
              <label>План</label>
              <div className="plan-options">
                {['BASIC', 'PRO', 'MAX'].map((p) => (
                  <button key={p} type="button" className={`plan-option${plan === p ? ' selected' : ''}`} onClick={() => handlePlanChange(p)}>{p}</button>
                ))}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Editor Seats</label>
                <input type="number" min={1} max={100} value={seatsEditor} onChange={(e) => setSeatsEditor(Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label>Player Seats</label>
                <input type="number" min={1} max={500} value={seatsPlayer} onChange={(e) => setSeatsPlayer(Number(e.target.value))} />
              </div>
            </div>

            <div className="form-group">
              <label>Действует до</label>
              <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} min={new Date().toISOString().split('T')[0]} />
            </div>

            {error && <div className="form-error">{error}</div>}

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={onClose}>Отмена</button>
              <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Создание…' : 'Создать лицензию'}</button>
            </div>
          </form>
        ) : (
          <div className="modal-body">
            <div className="form-group">
              <label>Организация</label>
              <div><b>{created.orgLabel}</b></div>
            </div>
            <div className="form-group">
              <label>License Key</label>
              <div><code>{created.licenseKey}</code></div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border, #333)', margin: '12px 0' }} />

            <div className="form-group"><label>Пригласить пользователей</label></div>
            <form className="form-row" onSubmit={handleInvite}>
              <div className="form-group" style={{ flex: 2 }}>
                <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="user@example.com" />
              </div>
              <div className="form-group">
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                  <option value="MEMBER">Member</option>
                  <option value="OWNER">Owner</option>
                </select>
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button type="submit" className="btn-primary" disabled={inviting || !inviteEmail.trim()}>{inviting ? '…' : 'Добавить'}</button>
              </div>
            </form>
            {inviteError && <div className="form-error">{inviteError}</div>}

            {invited.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {invited.map((u, idx) => (
                  <div key={idx} style={{ fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border, #2a2a2a)' }}>
                    {u.email} · <b>{u.role}</b> · пароль: <code style={{ color: '#fbbf24' }}>{u.tempPassword}</code>
                  </div>
                ))}
                <div style={{ fontSize: 11, color: 'var(--text-muted, #888)', marginTop: 4 }}>Пароли показываются один раз — сохраните.</div>
              </div>
            )}

            <div className="modal-footer">
              <button type="button" className="btn-primary" onClick={finish}>Готово</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
