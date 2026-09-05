// packages/natcom-student-web/src/admin/AdminApp.tsx
// Панель администратора (Тип5_бэклог.md, Эпик 10, T5-090/091) - веб-интерфейс
// (ТЗ FR-011: "посредством браузера... административный интерфейс, с
// ограниченным доступом"), НЕ Electron-экран. Вход - через существующую
// модель LicenseUser центрального KIOSK-сервера (server.js проксирует на
// POST /api/auth/editor-login), локальная сессия - короткоживущий токен в
// памяти сервера, здесь - в sessionStorage (переживает обновление страницы
// в рамках одной вкладки, не переживает закрытие - "рабочая смена").

import React, { useCallback, useEffect, useState } from 'react';
import './admin.css';

const SESSION_STORAGE_KEY = 'natcom-admin-session';

interface ClientRow {
  id: string;
  connectedAt: string;
}

interface ClientsResponse {
  maxClients: number;
  connectedCount: number;
  clients: ClientRow[];
}

const AdminApp: React.FC = () => {
  const [sessionToken, setSessionToken] = useState<string | null>(() => sessionStorage.getItem(SESSION_STORAGE_KEY));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [clientsData, setClientsData] = useState<ClientsResponse | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const logout = useCallback(() => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setSessionToken(null);
    setClientsData(null);
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

  useEffect(() => {
    if (!sessionToken) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const resp = await fetch('/api/admin/clients', {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        if (resp.status === 403) {
          if (!cancelled) logout();
          return;
        }
        const body = await resp.json();
        if (!cancelled) setClientsData(body);
      } catch {
        // сетевой сбой одного опроса - не критично, следующий тик попробует снова
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [sessionToken, logout]);

  const handleDisconnectAll = async () => {
    if (!sessionToken) return;
    if (!window.confirm('Отключить всех подключённых учеников?')) return;
    setIsDisconnecting(true);
    try {
      await fetch('/api/admin/disconnect-all', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
    } finally {
      setIsDisconnecting(false);
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
        <h1>Клиенты</h1>
        <button onClick={logout}>Выйти</button>
      </header>
      {clientsData && (
        <>
          <p className="admin-app__summary">
            Подключено: {clientsData.connectedCount} / {clientsData.maxClients}
          </p>
          <table className="admin-app__table">
            <thead>
              <tr>
                <th>Подключение</th>
                <th>С какого времени</th>
              </tr>
            </thead>
            <tbody>
              {clientsData.clients.map((c) => (
                <tr key={c.id}>
                  <td>{c.id}</td>
                  <td>{new Date(c.connectedAt).toLocaleTimeString('ru-RU')}</td>
                </tr>
              ))}
              {clientsData.clients.length === 0 && (
                <tr>
                  <td colSpan={2} className="admin-app__empty">Никто не подключён</td>
                </tr>
              )}
            </tbody>
          </table>
          <button
            className="admin-app__disconnect-all"
            onClick={handleDisconnectAll}
            disabled={isDisconnecting || clientsData.connectedCount === 0}
          >
            Отключить всех
          </button>
        </>
      )}
    </div>
  );
};

export default AdminApp;
