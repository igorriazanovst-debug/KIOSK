import React, { useState } from 'react';

interface Props {
  onActivated: () => void;
}

const ActivationScreen: React.FC<Props> = ({ onActivated }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleActivate = async () => {
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError('');
    try {
      const result = await window.electronAPI!.activateWithCredentials(email.trim(), password);
      if (result.success) {
        onActivated();
      } else {
        setError(result.error || 'Ошибка активации');
      }
    } catch (e: any) {
      setError(e.message || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleActivate();
  };

  const inputStyle = (hasError: boolean): React.CSSProperties => ({
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px 16px',
    background: '#0f172a',
    border: `2px solid ${hasError ? '#ef4444' : '#334155'}`,
    borderRadius: 8,
    color: '#f1f5f9',
    fontSize: 15,
    outline: 'none',
    marginBottom: 12,
  });

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#0f172a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 99999, fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        background: '#1e293b',
        borderRadius: 12,
        padding: '40px 48px',
        width: 420,
        boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔐</div>
          <h2 style={{ color: '#f1f5f9', margin: 0, fontSize: 22 }}>Активация плеера</h2>
          <p style={{ color: '#94a3b8', marginTop: 8, fontSize: 14 }}>
            Введите учётные данные для запуска
          </p>
        </div>

        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Email"
          disabled={loading}
          style={inputStyle(!!error)}
          autoFocus
        />

        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Пароль"
          disabled={loading}
          style={inputStyle(!!error)}
        />

        {error && (
          <p style={{ color: '#ef4444', fontSize: 13, textAlign: 'center', margin: '-4px 0 12px' }}>
            {error}
          </p>
        )}

        <button
          onClick={handleActivate}
          disabled={loading || !email.trim() || !password.trim()}
          style={{
            width: '100%',
            marginTop: 8,
            padding: '12px 0',
            background: loading || !email.trim() || !password.trim() ? '#334155' : '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 16,
            fontWeight: 'bold',
            cursor: loading || !email.trim() || !password.trim() ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s'
          }}
        >
          {loading ? 'Активация...' : 'Войти'}
        </button>
      </div>
    </div>
  );
};

export default ActivationScreen;
