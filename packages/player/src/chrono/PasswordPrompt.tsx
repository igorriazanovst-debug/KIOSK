// packages/player/src/chrono/PasswordPrompt.tsx
// Четыре сценария одним компонентом (различаются только набором полей и
// текстом, логика ошибок/блокировки общая):
//   - 'setup'  — пароля ещё нет, первичная настройка (новый + подтверждение)
//   - 'unlock' — пароль есть, редактирование заблокировано (один пароль)
//   - 'change' — уже разблокировано, смена пароля (текущий + новый + подтв.)
//   - 'reset'  — пароль забыт: код от поддержки (мастер-код сброса, Фаза 4)
//     + новый пароль. Доступен из 'unlock' по ссылке «Забыли пароль?».
//
// Троттлинг/блокировка (auth.js/resetCode.js, электронный main-процесс) -
// источник истины; этот компонент только показывает то, что вернул
// IPC-вызов (success/locked/retryAfterMs), не делает собственных
// предположений о количестве оставшихся попыток.

import React, { useEffect, useState } from 'react';
import './PasswordPrompt.css';

export type PasswordPromptMode = 'setup' | 'unlock' | 'change' | 'reset';

export interface PasswordSubmitValues {
  password?: string;
  currentPassword?: string;
  newPassword?: string;
  resetCode?: string;
}

export interface PasswordPromptResult {
  success: boolean;
  locked: boolean;
  retryAfterMs: number;
}

export interface ResetChallengeInfo {
  available: boolean;
  buildCode?: string;
  challenge?: string;
  locked: boolean;
  retryAfterMs: number;
}

export interface PasswordPromptProps {
  mode: PasswordPromptMode;
  onSubmit: (values: PasswordSubmitValues) => Promise<PasswordPromptResult>;
  onSuccess: () => void;
  onCancel: () => void;
  /** Только для mode='unlock' - переключает родителя на mode='reset' */
  onForgotPassword?: () => void;
  /** Только для mode='reset' - родитель сам запрашивает challenge через getResetChallenge(), null пока грузится */
  resetInfo?: ResetChallengeInfo | null;
}

const TITLES: Record<PasswordPromptMode, string> = {
  setup: 'Установить пароль для локального редактирования',
  unlock: 'Редактирование заблокировано',
  change: 'Сменить пароль',
  reset: 'Сброс пароля по коду поддержки',
};

function formatRetryAfter(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds} с`;
  return `${Math.ceil(seconds / 60)} мин`;
}

const PasswordPrompt: React.FC<PasswordPromptProps> = ({
  mode,
  onSubmit,
  onSuccess,
  onCancel,
  onForgotPassword,
  resetInfo,
}) => {
  const [password, setPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
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

  // Смена mode переиспользует тот же смонтированный компонент (родитель не
  // размонтирует PasswordPrompt при переходе 'unlock' -> 'reset' по ссылке
  // «Забыли пароль?») - без сброса старая ошибка/блокировка от предыдущего
  // режима осталась бы видна в новом.
  useEffect(() => {
    setError(null);
    setRetryAfterMs(mode === 'reset' && resetInfo?.locked ? resetInfo.retryAfterMs : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const locked = retryAfterMs !== null && retryAfterMs > 0;
  const resetUnavailable = mode === 'reset' && resetInfo !== undefined && resetInfo !== null && !resetInfo.available;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (locked || submitting || resetUnavailable) return;

    if (mode === 'setup' || mode === 'change' || mode === 'reset') {
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
      mode === 'unlock'
        ? { password }
        : mode === 'setup'
        ? { newPassword }
        : mode === 'reset'
        ? { resetCode, newPassword }
        : { currentPassword, newPassword };

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
      } else if (mode === 'reset') {
        setError('Неверный код');
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
          <>
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
            {onForgotPassword && (
              <button type="button" className="chrono-password-prompt__forgot" onClick={onForgotPassword}>
                Забыли пароль?
              </button>
            )}
          </>
        )}

        {mode === 'reset' && resetInfo === null && (
          <div className="chrono-password-prompt__info">Загрузка…</div>
        )}

        {mode === 'reset' && resetUnavailable && (
          <div className="chrono-password-prompt__info">
            На этой сборке сброс пароля недоступен. Обратитесь к поставщику приложения.
          </div>
        )}

        {mode === 'reset' && resetInfo?.available && (
          <>
            <div className="chrono-password-prompt__info">
              Продиктуйте поддержке эти два кода, чтобы получить код сброса:
              <div className="chrono-password-prompt__codes">
                <div>
                  Код сборки: <strong>{resetInfo.buildCode}</strong>
                </div>
                <div>
                  Код запроса: <strong>{resetInfo.challenge}</strong>
                </div>
              </div>
            </div>
            <label className="chrono-password-prompt__field">
              <span>Код сброса (от поддержки)</span>
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value)}
                disabled={locked}
              />
            </label>
          </>
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

        {(mode === 'setup' || mode === 'change' || (mode === 'reset' && resetInfo?.available)) && (
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
          {!(mode === 'reset' && !resetInfo?.available) && (
            <button type="submit" disabled={locked || submitting}>
              {mode === 'unlock' ? 'Разблокировать' : mode === 'setup' ? 'Установить' : mode === 'reset' ? 'Сбросить' : 'Сменить'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default PasswordPrompt;
