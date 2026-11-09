// Вход: выбор локальной учётной записи на этой машине или создание новой.
// K5-1: вход по паролю (PBKDF2-хэш в данных аккаунта). Записи, созданные
// до появления паролей, продолжают работать: при входе предлагается задать
// пароль, но можно войти и без него.
import React, { useState } from 'react';
import type { Account, PasswordRecord } from '../model/schema.ts';
import { MIN_PASSWORD_LENGTH, passwordProblem, passwordRecordOf, type PasswordCrypto } from '../passwords.ts';

interface Props {
  title: string;
  accounts: Account[];
  corrupt: boolean;
  passwordCrypto: PasswordCrypto | null;
  onLogin: (accountId: string) => void;
  onSetPassword: (accountId: string, record: PasswordRecord) => void;
  onCreate: (name: string, password: string) => Promise<string | null>; // возвращает текст ошибки
  onRemove: (accountId: string) => void;
}

// Диалог после выбора записи: «введите пароль» или «задайте пароль» (миграция).
type Pending = { account: Account; mode: 'verify' | 'setup' };

function PasswordPromptCard({ pending, password, repeat, busy, error, onPassword, onRepeat, onSubmit, onSkip, onCancel }: {
  pending: Pending;
  password: string;
  repeat: string;
  busy: boolean;
  error: string | null;
  onPassword: (value: string) => void;
  onRepeat: (value: string) => void;
  onSubmit: () => void;
  onSkip: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="eumk-card">
      {pending.mode === 'verify' ? (
        <>
          <h3 style={{ marginTop: 0 }}>Вход: {pending.account.name}</h3>
          <div className="eumk-row">
            <input type="password" className="eumk-input" aria-label="Пароль" placeholder="Пароль" value={password}
              onChange={(e) => onPassword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); }} />
            <button type="button" className="eumk-btn primary" disabled={busy} onClick={onSubmit}>{busy ? 'Проверяем…' : 'Войти'}</button>
            <button type="button" className="eumk-btn" disabled={busy} onClick={onCancel}>Отмена</button>
          </div>
        </>
      ) : (
        <>
          <h3 style={{ marginTop: 0 }}>Запись «{pending.account.name}» пока без пароля</h3>
          <p className="eumk-muted" style={{ marginTop: 0 }}>Задайте пароль — при следующих входах он будет запрашиваться. Можно войти и без пароля.</p>
          <div className="eumk-row">
            <input type="password" className="eumk-input" aria-label="Пароль" placeholder={`Пароль, не короче ${MIN_PASSWORD_LENGTH} символов`} value={password}
              onChange={(e) => onPassword(e.target.value)} />
            <input type="password" className="eumk-input" aria-label="Повторите пароль" placeholder="Повторите пароль" value={repeat}
              onChange={(e) => onRepeat(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); }} />
            <button type="button" className="eumk-btn primary" disabled={busy} onClick={onSubmit}>{busy ? 'Сохраняем…' : 'Сохранить и войти'}</button>
            <button type="button" className="eumk-btn" disabled={busy} onClick={onSkip}>Войти без пароля</button>
            <button type="button" className="eumk-btn" disabled={busy} onClick={onCancel}>Отмена</button>
          </div>
        </>
      )}
      {error && <div className="eumk-note bad" role="alert">{error}</div>}
    </div>
  );
}

function AccountTile({ account, confirmOpen, disabled, onSelect, onAskRemove, onConfirm, onCancelConfirm }: {
  account: Account;
  confirmOpen: boolean;
  disabled: boolean;
  onSelect: () => void;
  onAskRemove: () => void;
  onConfirm: () => void;
  onCancelConfirm: () => void;
}) {
  return (
    <div className="eumk-card" style={{ margin: 0 }}>
      <button type="button" className="eumk-btn primary" style={{ width: '100%' }} disabled={disabled} onClick={onSelect}>{account.name}</button>
      <div style={{ marginTop: 8 }}>
        {confirmOpen ? (
          <span className="eumk-row">
            <span>Удалить вместе с результатами?</span>
            <button type="button" className="eumk-btn" disabled={disabled} onClick={onConfirm}>Да, удалить</button>
            <button type="button" className="eumk-btn" disabled={disabled} onClick={onCancelConfirm}>Отмена</button>
          </span>
        ) : (
          <button type="button" className="eumk-btn" disabled={disabled} onClick={onAskRemove}>Удалить</button>
        )}
      </div>
    </div>
  );
}

export default function AccountScreen({ title, accounts, corrupt, passwordCrypto, onLogin, onSetPassword, onCreate, onRemove }: Props) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);

  const closeForm = () => {
    setPending(null);
    setPassword('');
    setRepeat('');
    setError(null);
  };

  // Выбор записи: с паролем - ввод пароля, без пароля (миграция) - задать.
  // Испорченная запись пароля блокирует вход именно этой записи с понятной
  // ошибкой, а не «открывает» её молча.
  const select = (account: Account) => {
    const status = passwordRecordOf(account);
    if (status.status === 'invalid') {
      closeForm();
      setError(`Не удалось прочитать сохранённый пароль записи «${account.name}». Вход по паролю для неё невозможен: удалите запись и создайте заново.`);
      return;
    }
    setError(null);
    setPassword('');
    setRepeat('');
    setPending({ account, mode: status.status === 'ok' ? 'verify' : 'setup' });
  };

  const submitVerify = async () => {
    if (!pending || busy) return;
    const status = passwordRecordOf(pending.account);
    if (status.status !== 'ok') return;
    if (!passwordCrypto) {
      setError('Проверка пароля недоступна в этом окружении.');
      return;
    }
    setBusy(true);
    try {
      const valid = await passwordCrypto.verify(password, status.record);
      if (valid) {
        const { account } = pending;
        closeForm();
        onLogin(account.id);
      } else {
        setError('Неверный пароль.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось проверить пароль.');
    } finally {
      setBusy(false);
    }
  };

  const submitSetup = async () => {
    if (!pending || busy) return;
    if (!passwordCrypto) {
      setError('Задание пароля недоступно в этом окружении. Войдите без пароля.');
      return;
    }
    const problem = passwordProblem(password, pending.account.name);
    if (problem !== null) {
      setError(problem);
      return;
    }
    if (password !== repeat) {
      setError('Пароли не совпадают.');
      return;
    }
    setBusy(true);
    try {
      const record = await passwordCrypto.hash(password);
      const { account } = pending;
      closeForm();
      onSetPassword(account.id, record);
      onLogin(account.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить пароль.');
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (busy) return;
    if (passwordCrypto) {
      const problem = passwordProblem(password, name);
      if (problem !== null) {
        setError(problem);
        return;
      }
      if (password !== repeat) {
        setError('Пароли не совпадают.');
        return;
      }
    }
    setBusy(true);
    const problem = await onCreate(name, password);
    setBusy(false);
    if (problem !== null) setError(problem);
    else {
      setName('');
      setPassword('');
      setRepeat('');
      setError(null);
    }
  };

  return (
    <div className="eumk-narrow">
      <h2>{title}</h2>
      {corrupt && <div className="eumk-note bad" role="alert">Сохранённые данные повреждены и не прочитаны. Создайте учётную запись заново; прежние результаты недоступны.</div>}
      <h3>Кто занимается?</h3>
      {accounts.length === 0 && <p className="eumk-muted">Учётных записей пока нет. Введите имя и нажмите «Создать».</p>}
      {pending && (
        <PasswordPromptCard pending={pending} password={password} repeat={repeat} busy={busy} error={error}
          onPassword={setPassword} onRepeat={setRepeat}
          onSubmit={() => void (pending.mode === 'verify' ? submitVerify() : submitSetup())}
          onSkip={() => { const { account } = pending; closeForm(); onLogin(account.id); }}
          onCancel={closeForm} />
      )}
      <div className="eumk-tiles">
        {accounts.map((a) => (
          // Пока идёт хэширование (busy), плитки заблокированы: клики по
          // другим записям/удалению во время await гонялись бы с завершением.
          <AccountTile key={a.id} account={a} confirmOpen={confirmId === a.id} disabled={busy}
            onSelect={() => select(a)}
            onAskRemove={() => setConfirmId(a.id)}
            onConfirm={() => { onRemove(a.id); setConfirmId(null); setPending(null); }}
            onCancelConfirm={() => setConfirmId(null)} />
        ))}
      </div>
      {!pending && (
        <>
          <h3>Новая учётная запись</h3>
          <div className="eumk-row">
            <input className="eumk-input" aria-label="Имя" placeholder="Имя или псевдоним" maxLength={60} value={name}
              onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void create(); }} />
            {passwordCrypto && (
              <>
                <input type="password" className="eumk-input" aria-label="Пароль" placeholder={`Пароль, не короче ${MIN_PASSWORD_LENGTH} символов`} value={password}
                  onChange={(e) => setPassword(e.target.value)} />
                <input type="password" className="eumk-input" aria-label="Повторите пароль" placeholder="Повторите пароль" value={repeat}
                  onChange={(e) => setRepeat(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void create(); }} />
              </>
            )}
            <button type="button" className="eumk-btn primary" disabled={busy} onClick={() => void create()}>{busy ? 'Создаём…' : 'Создать'}</button>
          </div>
          {error && <div className="eumk-note bad" role="alert">{error}</div>}
        </>
      )}
      <p className="eumk-muted" style={{ marginTop: 16 }}>Данные хранятся только на этом компьютере. Используйте имя или псевдоним, а не персональные данные.</p>
    </div>
  );
}
