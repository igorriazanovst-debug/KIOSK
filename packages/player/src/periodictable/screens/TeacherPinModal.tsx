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
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', padding: 28, borderRadius: 14, boxShadow: '0 16px 40px rgba(0,0,0,0.3)', textAlign: 'center' }}
      >
        <div style={{ fontSize: 28, marginBottom: 8 }}>🔒</div>
        <h3 style={{ margin: '0 0 4px' }}>PIN учителя</h3>
        <p style={{ margin: '0 0 16px', color: '#78909c', fontSize: 13 }}>Введите 4-значный PIN, чтобы открыть «Настройки вида»</p>
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={value}
          onChange={(e) => { setValue(e.target.value.replace(/\D/g, '').slice(0, 4)); setError(false); }}
          aria-label="PIN учителя, 4 цифры"
          style={{
            fontSize: 28,
            letterSpacing: 8,
            padding: '10px 8px',
            width: 140,
            textAlign: 'center',
            border: error ? '2px solid #e57373' : '1px solid #cfd8dc',
            borderRadius: 8,
            outline: 'none',
          }}
        />
        {error && <p style={{ color: '#d32f2f', margin: '8px 0 0' }}>Неверный PIN</p>}
        <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={handleSubmit}
            style={{ padding: '10px 20px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}
          >
            Подтвердить
          </button>
          <button
            onClick={onCancel}
            style={{ padding: '10px 20px', background: '#eceff1', color: '#37474f', border: 'none', borderRadius: 8, cursor: 'pointer' }}
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeacherPinModal;
