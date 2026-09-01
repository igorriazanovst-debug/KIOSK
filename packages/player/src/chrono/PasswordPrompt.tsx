// packages/player/src/chrono/PasswordPrompt.tsx
// Три сценария одним компонентом (различаются только набором полей и
// текстом, логика ошибок/блокировки общая):
//   - 'setup'  — пароля ещё нет, первичная настройка (новый + подтверждение)
//   - 'unlock' — пароль есть, редактирование заблокировано (один пароль)
//   - 'change' — уже разблокировано, смена пароля (текущий + новый + подтв.)
//
// Троттлинг/блокировка (auth.js, электронный main-процесс) - источник
// истины; этот компонент только показывает то, что вернул IPC-вызов
// (success/locked/retryAfterMs), не делает собственных предположений о
// количестве оставшихся попыток.

import React, { useEffect, useState } from 'react';
import './PasswordPrompt.css';

export type PasswordPromptMode = 'setup' | 'unlock' | 'change';

export interface PasswordSubmitValues {
  password?: string;
  currentPassword?: string;
  newPassword?: string;
}

export interface PasswordPromptResult {
  success: boolean;
  locked: boolean;
  retryAfterMs: number;
}

export interface PasswordPromptProps {
  mode: PasswordPromptMode;
  onSubmit: (values: PasswordSubmitValues) => Promise<PasswordPromptResult>;
  onSuccess: () => void;
  onCancel: () => void;
}

const TITLES: Record<PasswordPromptMode, string> = {
  setup: 'Установить пароль для локального редактирования',
  unlock: 'Редактирование заблокировано',
  change: 'Сменить пароль',
};

function formatRetryAfter(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds} с`;
  return `${Math.ceil(seconds / 60)} мин`;
}

const PasswordPrompt: React.FC<PasswordPromptProps> = ({ mode, onSubmit, onSuccess, onCancel }) => {
  const [password, setPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [retryAfterMs, setRetryAfterMs] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Обратный отсчёт блокировки - обновляем видимое время каждую секунду, не
  // просто показываем застывшее число из ответа IPC.
  useEffect(() => {
    if (retryAfterMs === null || retryAfterMs <= 0) return;
    const timer = setInterval(() => {
      setRetryAfterMs((ms) => {
        if (ms === null) return ms;
        const next = Math.max(ms - 1000, 0);
        if (next === 0) clearInterval(timer);
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [retryAfterMs !== null && retryAfterMs > 0]);

  const locked = retryAfterMs !== null && retryAfterMs > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (locked || submitting) return;

    if (mode === 'setup' || mode === 'change') {
      if (newPassword.length < 4) {
        setError('Пароль должен быть не короче 4 символов');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('Пароли не совпадают');
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    const values: PasswordSubmitValues =
      mode === 'unlock' ? { password } : mode === 'setup' ? { newPassword } : { currentPassword, newPassword };

    try {
      const result = await onSubmit(values);
      setSubmitting(false);

      if (result.success) {
        onSuccess();
        return;
      }

      if (result.locked) {
        setRetryAfterMs(result.retryAfterMs);
        setError(`Слишком много неверных попыток. Попробуйте снова через ${formatRetryAfter(result.retryAfterMs)}`);
      } else {
        setError(mode === 'change' ? 'Неверный текущий пароль' : 'Неверный пароль');
      }
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="chrono-password-prompt__overlay" onClick={onCancel}>
      <form className="chrono-password-prompt" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3 className="chrono-password-prompt__title">{TITLES[mode]}</h3>

        {mode === 'unlock' && (
          <label className="chrono-password-prompt__field">
            <span>Пароль</span>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={locked}
            />
          </label>
        )}

        {mode === 'change' && (
          <label className="chrono-password-prompt__field">
            <span>Текущий пароль</span>
            <input
              type="password"
              autoFocus
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={locked}
            />
          </label>
        )}

        {(mode === 'setup' || mode === 'change') && (
          <>
            <label className="chrono-password-prompt__field">
              <span>Новый пароль</span>
              <input
                type="password"
                autoFocus={mode === 'setup'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={locked}
              />
            </label>
            <label className="chrono-password-prompt__field">
              <span>Повторите новый пароль</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={locked}
              />
            </label>
          </>
        )}

        {error && <div className="chrono-password-prompt__error">{error}</div>}

        <div className="chrono-password-prompt__actions">
          <button type="button" onClick={onCancel}>
            Отмена
          </button>
          <button type="submit" disabled={locked || submitting}>
            {mode === 'unlock' ? 'Разблокировать' : mode === 'setup' ? 'Установить' : 'Сменить'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PasswordPrompt;
