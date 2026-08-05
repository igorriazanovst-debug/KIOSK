import React, { useEffect, useState, useCallback } from 'react';
import { adminApi, LicenseUserAccount } from '../services/adminApi';

interface LicenseUserAccountsProps {
  token: string;
  licenseId: string;
}

// Пароль, сгенерированный при создании аккаунта или сбросе — показываем один
// раз и не сохраняем; админ должен скопировать/передать его клиенту сразу.
interface RevealedPassword {
  forUserId: string | 'new';
  email: string;
  password: string;
}

export function LicenseUserAccounts({ token, licenseId }: LicenseUserAccountsProps) {
  const [users, setUsers] = useState<LicenseUserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<RevealedPassword | null>(null);

  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'OWNER' | 'MEMBER'>('MEMBER');
  const [creating, setCreating] = useState(false);

  const [editedEmail, setEditedEmail] = useState<Record<string, string>>({});
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await adminApi.listLicenseUsers(token, licenseId);
      setUsers(list);
    } catch (err: any) {
      setError(err.message || 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, [token, licenseId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!newEmail.trim()) return;
    setCreating(true);
    try {
      const result = await adminApi.createLicenseUser(token, licenseId, newEmail.trim(), newRole);
      setRevealed({ forUserId: 'new', email: result.email, password: result.tempPassword });
      setNewEmail('');
      setNewRole('MEMBER');
      await load();
    } catch (err: any) {
      alert('Failed to create account: ' + (err.message || 'Unknown error'));
    } finally {
      setCreating(false);
    }
  };

  const handleSaveEmail = async (user: LicenseUserAccount) => {
    const email = (editedEmail[user.id] ?? user.email).trim();
    if (!email || email === user.email) return;
    setBusyUserId(user.id);
    try {
      await adminApi.updateLicenseUser(token, user.id, { email });
      // Сервер применяет express-validator normalizeEmail() (lowercase и т.п.) —
      // сбрасываем локальную правку, иначе она больше никогда не совпадёт с
      // нормализованным user.email из load(), и каждый следующий blur этого
      // поля будет слать лишний no-op PATCH.
      setEditedEmail((prev) => {
        const { [user.id]: _removed, ...rest } = prev;
        return rest;
      });
      await load();
    } catch (err: any) {
      alert('Failed to update email: ' + (err.message || 'Unknown error'));
    } finally {
      setBusyUserId(null);
    }
  };

  const handleRoleChange = async (user: LicenseUserAccount, role: 'OWNER' | 'MEMBER') => {
    if (role === user.role) return;
    setBusyUserId(user.id);
    try {
      await adminApi.updateLicenseUser(token, user.id, { role });
      await load();
    } catch (err: any) {
      alert('Failed to update role: ' + (err.message || 'Unknown error'));
    } finally {
      setBusyUserId(null);
    }
  };

  const handleResetPassword = async (user: LicenseUserAccount) => {
    if (!confirm(`Reset password for ${user.email}? Their old password stops working immediately.`)) return;
    setBusyUserId(user.id);
    try {
      const result = await adminApi.updateLicenseUser(token, user.id, { resetPassword: true });
      if (result.tempPassword) {
        setRevealed({ forUserId: user.id, email: user.email, password: result.tempPassword });
      }
    } catch (err: any) {
      alert('Failed to reset password: ' + (err.message || 'Unknown error'));
    } finally {
      setBusyUserId(null);
    }
  };

  const handleDelete = async (user: LicenseUserAccount) => {
    if (!confirm(`Delete account ${user.email}? This cannot be undone.`)) return;
    setBusyUserId(user.id);
    try {
      await adminApi.deleteLicenseUser(token, user.id);
      await load();
    } catch (err: any) {
      alert('Failed to delete account: ' + (err.message || 'Unknown error'));
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <div>
      {loading && <div className="loading-cell">Loading...</div>}
      {error && <div className="form-error">{error}</div>}

      {!loading && (
        <>
          <ul className="project-list">
            {users.length === 0 && <li className="empty-cell">No accounts yet</li>}
            {users.map((u) => (
              <li key={u.id} className="project-row account-row">
                <input
                  type="text"
                  className="account-email-input"
                  value={editedEmail[u.id] ?? u.email}
                  onChange={(e) => setEditedEmail((prev) => ({ ...prev, [u.id]: e.target.value }))}
                  onBlur={() => handleSaveEmail(u)}
                  disabled={busyUserId === u.id}
                />
                <select
                  value={u.role}
                  disabled={busyUserId === u.id}
                  onChange={(e) => handleRoleChange(u, e.target.value as 'OWNER' | 'MEMBER')}
                >
                  <option value="OWNER">Owner</option>
                  <option value="MEMBER">Member</option>
                </select>
                <button
                  className="btn-secondary btn-small"
                  disabled={busyUserId === u.id}
                  onClick={() => handleResetPassword(u)}
                >
                  Reset password
                </button>
                <button
                  className="btn-danger btn-small"
                  disabled={busyUserId === u.id}
                  onClick={() => handleDelete(u)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>

          {revealed && (
            <div className="build-status">
              New password for {revealed.email}: <code>{revealed.password}</code>
              <button className="btn-secondary btn-small" onClick={() => setRevealed(null)}>Dismiss</button>
            </div>
          )}

          <div className="grant-picker">
            <input
              type="text"
              placeholder="new-client@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
            <select value={newRole} onChange={(e) => setNewRole(e.target.value as 'OWNER' | 'MEMBER')}>
              <option value="MEMBER">Member</option>
              <option value="OWNER">Owner</option>
            </select>
            <button className="btn-primary btn-small" disabled={!newEmail.trim() || creating} onClick={handleCreate}>
              {creating ? 'Adding...' : 'Add account'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
