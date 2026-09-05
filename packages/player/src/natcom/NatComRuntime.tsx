// packages/player/src/natcom/NatComRuntime.tsx
// Экран виджета «Конструктор природных сообществ» (Тип 5) на самом
// учительском ПК, пока встроенный сервер (packages/player/electron/natcom/server.js)
// обслуживает браузеры остальных устройств школьной сети. Эпик 2 бэклога
// (вертикальный срез) — только заглушка + адрес подключения, без реального
// содержания пособия/редактора (это Эпики 4-9).
//
// Что именно здесь должно быть дальше (пульт управления классом vs
// полноценный редактор/плеер) — открытый вопрос №11 плана, решается при
// проектировании Эпика 6.

import React, { useEffect, useState } from 'react';
import type { NatComWidgetProperties } from '@kiosk/shared';
import './NatComRuntime.css';

interface Props {
  properties: NatComWidgetProperties;
}

const NatComRuntime: React.FC<Props> = ({ properties }) => {
  const [serverInfo, setServerInfo] = useState<{ port: number | null; addresses: string[] } | null>(null);

  useEffect(() => {
    if (!window.natcomAPI) return;
    let cancelled = false;
    window.natcomAPI.getServerInfo().then((info) => {
      if (!cancelled) setServerInfo(info);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="natcom-runtime">
      <h1 className="natcom-runtime__title">{properties.title || 'Конструктор природных сообществ'}</h1>
      {!window.natcomAPI ? (
        <p className="natcom-runtime__status natcom-runtime__status--error">
          Встроенный сервер недоступен (запущено не в составе установленного плеера).
        </p>
      ) : serverInfo === null ? (
        <p className="natcom-runtime__status">Запуск сервера…</p>
      ) : serverInfo.addresses.length === 0 ? (
        <p className="natcom-runtime__status natcom-runtime__status--error">
          Не найден сетевой адрес — проверьте подключение ПК к локальной сети.
        </p>
      ) : (
        <div className="natcom-runtime__status">
          <p>Сервер запущен. Ученики подключаются в браузере по адресу:</p>
          <ul className="natcom-runtime__addresses">
            {serverInfo.addresses.map((addr) => (
              <li key={addr}>
                <code>http://{addr}:{serverInfo.port}/</code>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default NatComRuntime;
