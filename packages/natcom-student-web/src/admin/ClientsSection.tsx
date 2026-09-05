// packages/natcom-student-web/src/admin/ClientsSection.tsx
// Экран «Клиенты» (Тип5_бэклог.md, Эпик 10, T5-091) - вынесен из AdminApp.tsx
// при добавлении вкладки «Лицензия» (T5-092), чтобы каждая вкладка была
// отдельным файлом, а не растущим AdminApp.tsx.

import React, { useCallback, useEffect, useState } from 'react';

interface ClientRow {
  id: string;
  connectedAt: string;
}

interface ClientsResponse {
  maxClients: number;
  connectedCount: number;
  clients: ClientRow[];
}

interface ClientsSectionProps {
  sessionToken: string;
  onSessionExpired: () => void;
}

const ClientsSection: React.FC<ClientsSectionProps> = ({ sessionToken, onSessionExpired }) => {
  const [clientsData, setClientsData] = useState<ClientsResponse | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const resp = await fetch('/api/admin/clients', {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        if (resp.status === 403) {
          if (!cancelled) onSessionExpired();
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
  }, [sessionToken, onSessionExpired]);

  const handleDisconnectAll = useCallback(async () => {
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
  }, [sessionToken]);

  if (!clientsData) return null;

  return (
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
  );
};

export default ClientsSection;
