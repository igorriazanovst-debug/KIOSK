import React, { useState } from 'react';

interface Props {
  currentVersion: number;
  newVersion: number;
  onDismiss: () => void;
  onUpdated: () => void;
}

const UpdateBanner: React.FC<Props> = ({ currentVersion, newVersion, onDismiss, onUpdated }) => {
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdate = () => setShowPasswordDialog(true);

  const handleConfirm = async () => {
    if (!password.trim()) return;
    setLoading(true);
    setError('');
    try {
      const verifyResult = await window.electronAPI!.verifyUpdatePassword(password);
      if (!verifyResult.success) {
        setError(verifyResult.error || 'Неверный пароль');
        setLoading(false);
        return;
      }
      const applyResult = await window.electronAPI!.applyUpdate();
      if (applyResult.success) {
        setShowPasswordDialog(false);
        onUpdated();
      } else {
        setError(applyResult.error || 'Ошибка обновления');
      }
    } catch (e: any) {
      setError(e.message || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Плашка в углу экрана */}
      <div style={{
        position: 'fixed', bottom: 24, right: 24,
        background: '#1e40af',
        color: '#fff',
        borderRadius: 10,
        padding: '14px 20px',
        display: 'flex', alignItems: 'center', gap: 16,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        zIndex: 99998,
        fontFamily: 'Arial, sans-serif',
        fontSize: 14,
        maxWidth: 360
      }}>
        <span style={{ fontSize: 22 }}>🔄</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 'bold', marginBottom: 2 }}>Доступно обновление</div>
          <div style={{ opacity: 0.8, fontSize: 12 }}>
            Версия {currentVersion} → {newVersion}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleUpdate}
            style={{
              background: '#fff', color: '#1e40af',
              border: 'none', borderRadius: 6,
              padding: '6px 14px', fontWeight: 'bold',
              cursor: 'pointer', fontSize: 13
            }}
          >
            Обновить
          </button>
          <button
            onClick={onDismiss}
            style={{
              background: 'transparent', color: 'rgba(255,255,255,0.7)',
              border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6,
              padding: '6px 10px', cursor: 'pointer', fontSize: 13
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Диалог ввода пароля */}
      {showPasswordDialog && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 99999, fontFamily: 'Arial, sans-serif'
        }}>
          <div style={{
            background: '#1e293b',
            borderRadius: 12,
            padding: '32px 40px',
            width: 380,
            boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
          }}>
            <h3 style={{ color: '#f1f5f9', margin: '0 0 8px', fontSize: 18 }}>
              Подтверждение обновления
            </h3>
            <p style={{ color: '#94a3b8', fontSize: 13, margin: '0 0 20px' }}>
              Введите пароль администратора для применения обновления
            </p>

            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConfirm()}
              placeholder="Пароль"
              disabled={loading}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 14px',
                background: '#0f172a',
                border: `2px solid ${error ? '#ef4444' : '#334155'}`,
                borderRadius: 8,
                color: '#f1f5f9',
                fontSize: 15,
                outline: 'none',
                marginBottom: 8
              }}
              autoFocus
            />

            {error && (
              <p style={{ color: '#ef4444', fontSize: 13, margin: '4px 0 12px' }}>{error}</p>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                onClick={() => { setShowPasswordDialog(false); setPassword(''); setError(''); }}
                disabled={loading}
                style={{
                  flex: 1, padding: '10px 0',
                  background: '#334155', color: '#fff',
                  border: 'none', borderRadius: 8,
                  cursor: 'pointer', fontSize: 14
                }}
              >
                Отмена
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading || !password.trim()}
                style={{
                  flex: 1, padding: '10px 0',
                  background: loading || !password.trim() ? '#334155' : '#3b82f6',
                  color: '#fff',
                  border: 'none', borderRadius: 8,
                  cursor: loading || !password.trim() ? 'not-allowed' : 'pointer',
                  fontSize: 14, fontWeight: 'bold'
                }}
              >
                {loading ? 'Проверка...' : 'Применить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UpdateBanner;
