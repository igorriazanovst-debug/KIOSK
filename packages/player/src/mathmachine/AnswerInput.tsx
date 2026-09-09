import React, { useState, useEffect } from 'react';
import type { AnswerMode } from '@kiosk/shared';
import { COLOR, FONT, RADIUS } from './theme';

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
    padding: '14px 28px',
    fontFamily: FONT.ui,
    fontSize: 18,
    fontWeight: 700,
    borderRadius: RADIUS.md,
    border: active ? `3px solid ${COLOR.mint}` : `2px solid ${COLOR.border}`,
    background: active ? COLOR.mintLight : COLOR.surface,
    color: COLOR.text,
    cursor: 'pointer',
    transition: 'border-color 120ms, background 120ms',
  };
}

const choiceRowStyle: React.CSSProperties = { display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' };
const numericColumnStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 };
const numericInputStyle: React.CSSProperties = {
  width: 140,
  fontFamily: FONT.ui,
  fontSize: 28,
  fontWeight: 700,
  textAlign: 'center',
  padding: '8px 12px',
  borderRadius: RADIUS.sm,
  border: `2px solid ${COLOR.indigo}`,
  color: COLOR.text,
  background: COLOR.surface,
};
const digitPadStyle: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, maxWidth: 260, justifyContent: 'center' };
const digitButtonStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  fontFamily: FONT.ui,
  fontSize: 17,
  fontWeight: 700,
  borderRadius: RADIUS.sm,
  border: `2px solid ${COLOR.border}`,
  background: COLOR.surface,
  color: COLOR.text,
  cursor: 'pointer',
};

export default AnswerInput;
