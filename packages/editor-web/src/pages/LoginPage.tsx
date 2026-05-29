/**
 * Login Page - Вход по email + password
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, AlertCircle, Loader } from 'lucide-react';
import { apiClient } from '../services/api-client';
import { logger } from '../utils/logger';
import './LoginPage.css';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);

  useEffect(() => {
    const reason = sessionStorage.getItem('kiosk_logout_reason');
    if (reason === 'inactivity') {
      setLogoutMessage('Вы были автоматически выведены из системы из-за неактивности');
    } else if (reason === 'session_expired') {
      setLogoutMessage('Ваша сессия истекла. Пожалуйста, войдите снова');
    } else if (reason === 'shutdown') {
      setLogoutMessage('Устройство деактивировано администратором');
    }
    sessionStorage.removeItem('kiosk_logout_reason');
    if (reason) setTimeout(() => setLogoutMessage(null), 6000);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Введите email и пароль');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      logger.info('[LoginPage] Attempting email login');
      await apiClient.loginWithEmail(email.trim(), password);
      navigate('/editor', { replace: true });
    } catch (err: any) {
      logger.error('[LoginPage] Login failed:', err);
      setError(err.message || 'Неверный email или пароль');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <Mail size={48} className="login-icon" />
          <h1>Kiosk Editor</h1>
          <p>Вход в систему</p>
        </div>

        {logoutMessage && (
          <div className="logout-message" style={{
            background:'#fff3cd', border:'1px solid #ffc107',
            borderRadius:'6px', padding:'10px 14px', marginBottom:'16px',
            display:'flex', alignItems:'center', gap:'8px', color:'#856404'
          }}>
            <AlertCircle size={16} />
            <span>{logoutMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null); }}
              disabled={isLoading}
              autoFocus
              autoComplete="email"
              className={error ? 'error' : ''}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Пароль</label>
            <input
              type="password"
              id="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              disabled={isLoading}
              autoComplete="current-password"
              className={error ? 'error' : ''}
            />
          </div>

          {error && (
            <div className="error-message">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="login-button"
            disabled={isLoading || !email.trim() || !password.trim()}
          >
            {isLoading ? (
              <><Loader size={20} className="spinner" /><span>Вход...</span></>
            ) : (
              <><Lock size={20} /><span>Войти</span></>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
