// packages/player/src/rusiq/editor/TeacherGateScreen.tsx
import React, { useState } from 'react';
import { hashSecret, verifySecret } from './pinAuth.ts';

interface Props {
  teacherPinHash: string | null;
  onUnlocked: (newPinHash?: string) => void;
  onCancel: () => void;
}

// Экран одновременно обслуживает два сценария: "PIN уже задан - введите
// его" и "PIN ещё не задан - задайте его сейчас" (спека Фазы 2a, разд. 1).
// Различаются только заголовком/поведением onSubmit, форма та же.
const TeacherGateScreen: React.FC<Props> = ({ teacherPinHash, onUnlocked, onCancel }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isFirstSetup = teacherPinHash === null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pin.trim().length === 0) return;
    setBusy(true);
    setError(null);
    if (isFirstSetup) {
      const newHash = await hashSecret(pin.trim());
      onUnlocked(newHash);
      return;
    }
    const ok = await verifySecret(pin.trim(), teacherPinHash);
    setBusy(false);
    if (ok) {
      onUnlocked();
    } else {
      setError('Неверный код');
      setPin('');
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: '80px auto', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h2>{isFirstSetup ? 'Задайте PIN режима учителя' : 'Режим учителя'}</h2>
      <form onSubmit={handleSubmit}>
        <input
          autoFocus
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          style={{ fontSize: 24, textAlign: 'center', width: '100%', padding: 8, letterSpacing: 4 }}
        />
        {error && <p style={{ color: '#c0392b' }}>{error}</p>}
        <div style={{ marginTop: 16 }}>
          <button type="button" onClick={onCancel} style={{ marginRight: 8 }}>
            Отмена
          </button>
          <button type="submit" disabled={busy || pin.trim().length === 0}>
            {isFirstSetup ? 'Задать' : 'Войти'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TeacherGateScreen;
