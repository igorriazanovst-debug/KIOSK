// packages/player/src/words/components/PasswordPrompt.tsx
// Ввод пароля педагога перед входом в закрытые разделы (ТЗ раздел 3).
//
// Заменил собой прежний рубеж «удержать кнопку две секунды и подтвердить».
// Удержание защищало только от СЛУЧАЙНОГО попадания и не мешало ребёнку,
// который подсмотрел, как это делает педагог. Пароль закрывает оба случая,
// поэтому держать оба рубежа подряд значило бы просто мешать взрослому.
//
// Клавиатура своя и цифровая: на интерактивной панели физической нет, а
// пароль по умолчанию — цифры. Буквы тоже можно ввести — есть переключение
// на полную экранную клавиатуру, иначе педагог с буквенным паролем оказался
// бы заперт снаружи.
//
// Проверка идёт в главном процессе: сюда приходит только «подошёл или нет».
// Ни пароля, ни его хеша в интерфейсе нет.
//
// И здесь НЕ НАПИСАНО, какой пароль стоит по умолчанию. Первая версия окна
// подсказывала «пока стандартный — 12345», и это сводило рубеж на нет: экран
// входа ребёнок видит чаще всех остальных. Напоминание осталось в настройках,
// куда без пароля не попасть.

import React, { useEffect, useRef, useState } from 'react';
import { BigButton, ErrorBanner, palette, TOUCH_TARGET_PX } from '../ui';
import Keyboard from './Keyboard';

interface Props {
  /** Что именно открывают — подпись в заголовке */
  sectionTitle: string;
  /** Проверка пароля; true — пускаем */
  onCheck: (password: string) => Promise<boolean>;
  onCancel: () => void;
  onSuccess: () => void;
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

const PasswordPrompt: React.FC<Props> = ({
  sectionTitle,
  onCheck,
  onCancel,
  onSuccess,
}) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [letters, setLetters] = useState(false);
  const alive = useRef(true);

  useEffect(() => () => { alive.current = false; }, []);

  const submit = async () => {
    if (!value || busy) return;
    setBusy(true);
    const ok = await onCheck(value);
    if (!alive.current) return;
    setBusy(false);
    if (ok) {
      onSuccess();
      return;
    }
    // Чистим поле: иначе следующая попытка дописывается к неверной
    setValue('');
    setError('Пароль не подошёл');
  };

  return (
    <div
      data-testid="password-prompt"
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20,
        padding: 32,
      }}
    >
      <div
        style={{
          background: palette.panel,
          borderRadius: 18,
          padding: 28,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          alignItems: 'center',
          maxWidth: 640,
        }}
      >
        <span style={{ fontSize: 28, textAlign: 'center' }}>
          {sectionTitle} — раздел педагога
        </span>
        <span style={{ fontSize: 20, color: palette.textMuted, textAlign: 'center' }}>
          Введите пароль, чтобы продолжить
        </span>

        <ErrorBanner text={error} />

        {/* Точки вместо символов: педагог вводит пароль при детях */}
        <div
          data-testid="password-value"
          data-length={value.length}
          style={{
            minWidth: 320,
            minHeight: TOUCH_TARGET_PX,
            fontSize: 34,
            letterSpacing: 8,
            padding: '12px 18px',
            borderRadius: 12,
            border: `2px solid ${palette.accent}`,
            background: palette.bg,
            textAlign: 'center',
          }}
        >
          {value ? '•'.repeat(value.length) : <span style={{ color: palette.textMuted, fontSize: 22, letterSpacing: 0 }}>пароль</span>}
        </div>

        {letters ? (
          <Keyboard value={value} onChange={setValue} maxLength={32} />
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', maxWidth: 420 }}>
            {DIGITS.map((d) => (
              <button
                key={d}
                type="button"
                data-testid={`digit-${d}`}
                onClick={() => setValue((v) => (v.length < 32 ? v + d : v))}
                style={{
                  minWidth: TOUCH_TARGET_PX,
                  minHeight: TOUCH_TARGET_PX,
                  fontSize: 30,
                  borderRadius: 12,
                  border: 'none',
                  background: palette.panelLight,
                  color: palette.text,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              data-testid="digit-erase"
              onClick={() => setValue((v) => v.slice(0, -1))}
              style={{
                minWidth: TOUCH_TARGET_PX * 1.5,
                minHeight: TOUCH_TARGET_PX,
                fontSize: 26,
                borderRadius: 12,
                border: 'none',
                background: palette.panelLight,
                color: palette.text,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              ⌫
            </button>
          </div>
        )}

        <button
          type="button"
          data-testid="password-toggle-letters"
          onClick={() => setLetters((v) => !v)}
          style={{
            background: 'transparent',
            border: 'none',
            color: palette.textMuted,
            fontSize: 18,
            cursor: 'pointer',
            fontFamily: 'inherit',
            textDecoration: 'underline',
          }}
        >
          {letters ? 'Цифры' : 'Пароль с буквами'}
        </button>

        <div style={{ display: 'flex', gap: 12 }}>
          <BigButton onClick={onCancel} tone="secondary" testId="password-cancel">
            Отмена
          </BigButton>
          <BigButton onClick={() => void submit()} disabled={!value || busy} testId="password-ok">
            Войти
          </BigButton>
        </div>
      </div>
    </div>
  );
};

export default PasswordPrompt;
