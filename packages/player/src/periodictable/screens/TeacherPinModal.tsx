// packages/player/src/periodictable/screens/TeacherPinModal.tsx
import React, { useState } from 'react';

interface Props {
  expectedPin: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const TeacherPinModal: React.FC<Props> = ({ expectedPin, onSuccess, onCancel }) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);

  function handleSubmit() {
    if (value === expectedPin) {
      onSuccess();
    } else {
      setError(true);
    }
  }

  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', padding: 24, borderRadius: 8 }}>
        <h3>PIN учителя</h3>
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={value}
          onChange={(e) => { setValue(e.target.value.replace(/\D/g, '').slice(0, 4)); setError(false); }}
          style={{ fontSize: 24, padding: 8, width: 120, textAlign: 'center' }}
        />
        {error && <p style={{ color: '#d32f2f' }}>Неверный PIN</p>}
        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <button onClick={handleSubmit}>Подтвердить</button>
          <button onClick={onCancel}>Отмена</button>
        </div>
      </div>
    </div>
  );
};

export default TeacherPinModal;
