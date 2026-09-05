// packages/natcom-student-web/src/admin/AdminApp.tsx
// Панель администратора (Тип5_бэклог.md, Эпик 10, T5-090/091) - веб-интерфейс
// (ТЗ FR-011: "посредством браузера... административный интерфейс, с
// ограниченным доступом"), НЕ Electron-экран. Вход - через существующую
// модель LicenseUser центрального KIOSK-сервера (server.js проксирует на
// POST /api/auth/editor-login), локальная сессия - короткоживущий токен в
// памяти сервера, здесь - в sessionStorage (переживает обновление страницы
// в рамках одной вкладки, не переживает закрытие - "рабочая смена").

import React, { useCallback, useState } from 'react';
import './admin.css';
import ClientsSection from './ClientsSection';
import LicenseSection from './LicenseSection';

const SESSION_STORAGE_KEY = 'natcom-admin-session';

type AdminTab = 'clients' | 'license';

const AdminApp: React.FC = () => {
  const [sessionToken, setSessionToken] = useState<string | null>(() => sessionStorage.getItem(SESSION_STORAGE_KEY));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('clients');

  const logout = useCallback(() => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setSessionToken(null);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const resp = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = await resp.json();
      if (!resp.ok) {
        setLoginError(body.error || 'Не удалось войти');
        return;
      }
      sessionStorage.setItem(SESSION_STORAGE_KEY, body.sessionToken);
      setSessionToken(body.sessionToken);
      setPassword('');
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (!sessionToken) {
    return (
      <div className="admin-app__login-screen">
        <form className="admin-app__login-form" onSubmit={handleLogin}>
          <h1>Администратор</h1>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </label>
          <label>
            Пароль
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {loginError && <p className="admin-app__error">{loginError}</p>}
          <button type="submit" disabled={isLoggingIn}>
            {isLoggingIn ? 'Вход…' : 'Войти'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="admin-app">
      <header className="admin-app__header">
        <h1>Администратор</h1>
        <button onClick={logout}>Выйти</button>
      </header>
      <nav className="admin-app__tabs">
        <button
          className={activeTab === 'clients' ? 'admin-app__tab admin-app__tab--active' : 'admin-app__tab'}
          onClick={() => setActiveTab('clients')}
        >
          Клиенты
        </button>
        <button
          className={activeTab === 'license' ? 'admin-app__tab admin-app__tab--active' : 'admin-app__tab'}
          onClick={() => setActiveTab('license')}
        >
          Лицензия
        </button>
      </nav>
      {activeTab === 'clients' && <ClientsSection sessionToken={sessionToken} onSessionExpired={logout} />}
      {activeTab === 'license' && <LicenseSection />}
    </div>
  );
};

export default AdminApp;
