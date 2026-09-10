// packages/player/src/words/components/Keyboard.tsx
// Экранная клавиатура.
//
// Не «на всякий случай»: продукт работает на интерактивной доске и столе, где
// физической клавиатуры нет вообще, а имя игрока и название своего комплекта
// вводить надо. У эталона ОС3 по этой же причине свой компонент Keyboard.
//
// Раскладка русская, потому что интерфейс русскоязычный (ТЗ раздел 6), плюс
// цифры — они нужны для названий вроде «Группа 2».

import React from 'react';
import { palette, TOUCH_TARGET_PX } from '../ui';

const ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['й', 'ц', 'у', 'к', 'е', 'н', 'г', 'ш', 'щ', 'з', 'х'],
  ['ф', 'ы', 'в', 'а', 'п', 'р', 'о', 'л', 'д', 'ж', 'э'],
  ['я', 'ч', 'с', 'м', 'и', 'т', 'ь', 'б', 'ю', 'ё'],
];

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  maxLength?: number;
}

const Key: React.FC<{ label: string; onPress: () => void; wide?: number; testId?: string }> = ({
  label,
  onPress,
  wide = 1,
  testId,
}) => (
  <button
    data-testid={testId}
    onClick={onPress}
    style={{
      minWidth: TOUCH_TARGET_PX * wide,
      height: TOUCH_TARGET_PX,
      fontSize: 26,
      borderRadius: 10,
      border: 'none',
      background: palette.panelLight,
      color: palette.text,
      cursor: 'pointer',
      fontFamily: 'inherit',
    }}
  >
    {label}
  </button>
);

const Keyboard: React.FC<Props> = ({ value, onChange, onSubmit, maxLength = 40 }) => {
  const type = (char: string) => {
    if (value.length >= maxLength) return;
    // Первая буква имени — заглавная: ребёнок набирает строчными, а в списке
    // имя должно выглядеть как имя.
    const next = value.length === 0 ? char.toUpperCase() : char;
    onChange(value + next);
  };

  return (
    <div
      data-testid="keyboard"
      style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}
    >
      {ROWS.map((row, i) => (
        <div key={i} style={{ display: 'flex', gap: 8 }}>
          {row.map((char) => (
            <Key key={char} label={char} onPress={() => type(char)} testId={`key-${char}`} />
          ))}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8 }}>
        <Key label="пробел" onPress={() => type(' ')} wide={4} testId="key-space" />
        <Key
          label="⌫"
          onPress={() => onChange(value.slice(0, -1))}
          wide={1.5}
          testId="key-backspace"
        />
        {onSubmit && <Key label="Готово" onPress={onSubmit} wide={2.5} testId="key-submit" />}
      </div>
    </div>
  );
};

export default Keyboard;
