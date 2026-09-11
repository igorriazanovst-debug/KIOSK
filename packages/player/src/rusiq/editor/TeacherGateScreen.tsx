// packages/player/src/rusiq/editor/TeacherGateScreen.tsx
import React, { useState } from 'react';
import { hashSecret, verifySecret } from './pinAuth.ts';

interface Props {
  teacherPinHash: string | null;
  onUnlocked: (newPinHash?: string) => void;
  onCancel: () => void;
}

const PIN_PATTERN = /^\d{4}$/;

// Экран одновременно обслуживает два сценария: "PIN уже задан - введите
// его" и "PIN ещё не задан - задайте его сейчас" (спека Фазы 2a, разд. 1).
// Первая установка требует 4 цифры и повторный ввод для подтверждения -
// без этого опечатка при единственном вводе PIN необратимо "теряет" режим
// учителя (найдено финальным ревью).
const TeacherGateScreen: React.FC<Props> = ({ teacherPinHash, onUnlocked, onCancel }) => {
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isFirstSetup = teacherPinHash === null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pin.trim().length === 0) return;
    setError(null);
    if (isFirstSetup) {
      if (!PIN_PATTERN.test(pin)) {
        setError('PIN должен состоять ровно из 4 цифр');
        return;
      }
      if (pin !== pinConfirm) {
        setError('PIN и подтверждение не совпадают');
        setPinConfirm('');
        return;
      }
      setBusy(true);
      const newHash = await hashSecret(pin);
      onUnlocked(newHash);
      return;
    }
    setBusy(true);
    const ok = await verifySecret(pin.trim(), teacherPinHash);
    setBusy(false);
    if (ok) {
      onUnlocked();
    } else {
      setError('Неверный код');
      setPin('');
    }
  }

  const canSubmit = isFirstSetup ? pin.length > 0 && pinConfirm.length > 0 && !busy : pin.trim().length > 0 && !busy;

  return (
    <div style={{ maxWidth: 360, margin: '80px auto', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h2>{isFirstSetup ? 'Задайте PIN режима учителя' : 'Режим учителя'}</h2>
      <form onSubmit={handleSubmit}>
        <input
          autoFocus
          type="password"
          inputMode="numeric"
          maxLength={isFirstSetup ? 4 : undefined}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          style={{ fontSize: 24, textAlign: 'center', width: '100%', padding: 8, letterSpacing: 4 }}
        />
        {isFirstSetup && (
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="Повторите PIN"
            value={pinConfirm}
            onChange={(e) => setPinConfirm(e.target.value)}
            style={{ fontSize: 24, textAlign: 'center', width: '100%', padding: 8, letterSpacing: 4, marginTop: 8 }}
          />
        )}
        {error && <p style={{ color: '#c0392b' }}>{error}</p>}
        <div style={{ marginTop: 16 }}>
          <button type="button" onClick={onCancel} style={{ marginRight: 8 }}>
            Отмена
          </button>
          <button type="submit" disabled={!canSubmit}>
            {isFirstSetup ? 'Задать' : 'Войти'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TeacherGateScreen;
