import React, { useState, useEffect } from 'react';
import type { AnswerMode } from '@kiosk/shared';

interface Props {
  mode: AnswerMode;
  choices?: Array<number | string>;
  value: number | string | null;
  onChange: (value: number | string) => void;
  disabled?: boolean;
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

const AnswerInput: React.FC<Props> = ({ mode, choices = [], value, onChange, disabled }) => {
  const [text, setText] = useState(value != null ? String(value) : '');

  useEffect(() => {
    setText(value != null ? String(value) : '');
  }, [value]);

  function commitText(next: string) {
    setText(next);
    if (next.trim() !== '' && /^-?\d+$/.test(next.trim())) {
      onChange(Number(next.trim()));
    }
  }

  if (mode === 'choice') {
    return (
      <div style={choiceRowStyle}>
        {choices.map((choice) => (
          <button
            key={String(choice)}
            disabled={disabled}
            onClick={() => onChange(choice)}
            style={choiceButtonStyle(String(choice) === (value != null ? String(value) : ''))}
          >
            {String(choice)}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div style={numericColumnStyle}>
      <input
        type="text"
        inputMode="numeric"
        value={text}
        disabled={disabled}
        onChange={(e) => commitText(e.target.value.replace(/[^-\d]/g, ''))}
        style={numericInputStyle}
      />
      <div style={digitPadStyle}>
        {DIGITS.map((digit) => (
          <button key={digit} disabled={disabled} onClick={() => commitText(text + digit)} style={digitButtonStyle}>
            {digit}
          </button>
        ))}
        <button disabled={disabled} onClick={() => commitText(text.slice(0, -1))} style={digitButtonStyle}>⌫</button>
      </div>
    </div>
  );
};

function choiceButtonStyle(active: boolean): React.CSSProperties {
  return {
    padding: '14px 28px', fontSize: 18, fontWeight: 700, borderRadius: 10,
    border: active ? '3px solid #2ecc71' : '2px solid #ccc',
    background: active ? '#eafff2' : '#fff', cursor: 'pointer',
  };
}

const choiceRowStyle: React.CSSProperties = { display: 'flex', gap: 12, justifyContent: 'center' };
const numericColumnStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 };
const numericInputStyle: React.CSSProperties = { width: 140, fontSize: 28, textAlign: 'center', padding: '8px 12px', borderRadius: 8, border: '2px solid #ccc' };
const digitPadStyle: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 6, maxWidth: 260, justifyContent: 'center' };
const digitButtonStyle: React.CSSProperties = { width: 40, height: 40, fontSize: 16, borderRadius: 8, border: '1px solid #ccc', background: '#fff', cursor: 'pointer' };

export default AnswerInput;
