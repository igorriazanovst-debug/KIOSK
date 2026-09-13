// packages/player/src/alphabet/components/PasswordPrompt.tsx
// Ввод пароля педагога перед входом в закрытые разделы (ТЗ раздел 3).
//
// СВОЙ, А НЕ ОБЩИЙ С ТИП 2 — и это осознанно. Общим у двух виджетов сделаны
// ПРАВИЛА (@kiosk/shared/words/store/teacherGate) и ХРАНЕНИЕ
// (electron/common/teacherPassword): разойдись они, разойдётся и поведение
// защиты. А внешний вид у виджетов разный — своя палитра, свои размеры, — и
// общий компонент потребовал бы абстракции над палитрой ради одного окна.
// Копия вёрстки дешевле такой абстракции и ничем не рискует: правила она не
// дублирует.
//
// Клавиатура своя и цифровая: на интерактивной панели физической нет, а
// пароль по умолчанию — цифры. Буквы тоже вводятся — есть переключение,
// иначе педагог с буквенным паролем оказался бы заперт снаружи.
//
// Проверка идёт в главном процессе: сюда приходит только «подошёл или нет».
//
// И ЗДЕСЬ НЕ НАПИСАНО, какой пароль стоит по умолчанию. В Тип 2 первая версия
// подсказывала «пока стандартный — 12345», и это сводило рубеж на нет: экран
// входа ребёнок видит чаще всех остальных. Напоминание живёт в настройках,
// куда без пароля не попасть.

import React, { useState } from 'react';
import { BigButton, palette } from '../ui';

interface Props {
  /** Что именно открывают — подпись в заголовке */
  sectionTitle: string;
  /** Проверка пароля; true — пускаем */
  onCheck: (password: string) => Promise<boolean>;
  onCancel: () => void;
  onSuccess: () => void;
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const LETTER_ROWS = [
  'йцукенгшщзхъ',
  'фывапролджэ',
  'ячсмитьбю',
];

const PasswordPrompt: React.FC<Props> = ({ sectionTitle, onCheck, onCancel, onSuccess }) => {
  const [value, setValue] = useState('');
  const [letters, setLetters] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const press = (ch: string) => {
    setError(null);
    setValue((v) => (v.length >= 32 ? v : v + ch));
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await onCheck(value);
    setBusy(false);
    if (ok) {
      onSuccess();
      return;
    }
    // Введённое стираем: иначе после промаха педагог правит хвост вслепую —
    // символы-то скрыты точками
    setValue('');
    setError('Пароль не подошёл');
  };

  const key = (label: string, onClick: () => void, wide = false) => (
    <button
      key={label}
      type="button"
      data-testid={`pass-key-${label}`}
      onClick={onClick}
      style={{
        minWidth: wide ? 120 : 62,
        height: 62,
        borderRadius: 12,
        border: 'none',
        background: palette.card,
        color: palette.textDark,
        fontSize: 26,
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      data-testid="password-prompt"
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20,
      }}
    >
      <div
        style={{
          background: palette.panel,
          borderRadius: 22,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          alignItems: 'center',
          maxWidth: 620,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 26 }}>{sectionTitle}</h2>
        <span style={{ fontSize: 19, color: palette.textDim }}>Введите пароль педагога</span>

        <div
          data-testid="pass-value"
          style={{
            minWidth: 260,
            minHeight: 54,
            borderRadius: 12,
            border: `2px solid ${palette.accent}`,
            background: 'rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 30,
            letterSpacing: 8,
          }}
        >
          {value ? '•'.repeat(value.length) : (
            <span style={{ color: palette.textDim, fontSize: 20, letterSpacing: 0 }}>пароль</span>
          )}
        </div>

        {error && (
          <div data-testid="pass-error" style={{ color: '#ffd2c9', fontSize: 19 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {letters
            ? LETTER_ROWS.map((row) => (
                <div key={row} style={{ display: 'flex', gap: 6, justifyContent: 'center', width: '100%' }}>
                  {[...row].map((ch) => key(ch, () => press(ch)))}
                </div>
              ))
            : DIGITS.map((d) => key(d, () => press(d)))}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {key('⌫', () => setValue((v) => v.slice(0, -1)))}
          {key(letters ? '123' : 'АБВ', () => setLetters((v) => !v), true)}
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <BigButton onClick={onCancel} tone="secondary" testId="pass-cancel">
            Отмена
          </BigButton>
          <BigButton onClick={submit} disabled={busy || value.length === 0} testId="pass-ok">
            Войти
          </BigButton>
        </div>
      </div>
    </div>
  );
};

export default PasswordPrompt;
