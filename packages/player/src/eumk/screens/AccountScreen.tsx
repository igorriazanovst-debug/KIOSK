// Вход: выбор локальной учётной записи на этой машине или создание новой.
import React, { useState } from 'react';
import type { Account } from '../model/schema.ts';

interface Props {
  title: string;
  accounts: Account[];
  corrupt: boolean;
  onSelect: (accountId: string) => void;
  onCreate: (name: string) => string | null; // возвращает текст ошибки
  onRemove: (accountId: string) => void;
}

export default function AccountScreen({ title, accounts, corrupt, onSelect, onCreate, onRemove }: Props) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const create = () => {
    const problem = onCreate(name);
    if (problem) setError(problem);
    else { setName(''); setError(null); }
  };

  return (
    <div className="eumk-narrow">
      <h2>{title}</h2>
      {corrupt && <div className="eumk-note bad" role="alert">Сохранённые данные повреждены и не прочитаны. Создайте учётную запись заново; прежние результаты недоступны.</div>}
      <h3>Кто занимается?</h3>
      {accounts.length === 0 && <p className="eumk-muted">Учётных записей пока нет. Введите имя и нажмите «Создать».</p>}
      <div className="eumk-tiles">
        {accounts.map((a) => (
          <div key={a.id} className="eumk-card" style={{ margin: 0 }}>
            <button type="button" className="eumk-btn primary" style={{ width: '100%' }} onClick={() => onSelect(a.id)}>{a.name}</button>
            <div style={{ marginTop: 8 }}>
              {confirmId === a.id ? (
                <span className="eumk-row">
                  <span>Удалить вместе с результатами?</span>
                  <button type="button" className="eumk-btn" onClick={() => { onRemove(a.id); setConfirmId(null); }}>Да, удалить</button>
                  <button type="button" className="eumk-btn" onClick={() => setConfirmId(null)}>Отмена</button>
                </span>
              ) : (
                <button type="button" className="eumk-btn" onClick={() => setConfirmId(a.id)}>Удалить</button>
              )}
            </div>
          </div>
        ))}
      </div>
      <h3>Новая учётная запись</h3>
      <div className="eumk-row">
        <input className="eumk-input" aria-label="Имя" placeholder="Имя или псевдоним" maxLength={60} value={name}
          onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') create(); }} />
        <button type="button" className="eumk-btn primary" onClick={create}>Создать</button>
      </div>
      {error && <div className="eumk-note bad" role="alert">{error}</div>}
      <p className="eumk-muted" style={{ marginTop: 16 }}>Данные хранятся только на этом компьютере. Используйте имя или псевдоним, а не персональные данные.</p>
    </div>
  );
}
