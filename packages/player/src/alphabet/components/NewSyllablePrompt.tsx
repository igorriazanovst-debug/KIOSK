// packages/player/src/alphabet/components/NewSyllablePrompt.tsx
// Создание своего слога — часть ТЗ строки 76 («дополнение контента
// собственными учебными материалами: текстовыми»).
//
// БУКВЫ СЛОГА ВЫБИРАЮТСЯ, А НЕ ВЫВОДЯТСЯ ИЗ НАПИСАНИЯ. Соблазн велик:
// «шка» — это Ш, К, А, разберём строку и всё. Но слог хранит номера букв не
// для красоты, а для статистики, и в русском есть места, где написание и
// состав расходятся — «ъ» и «ь» звука не дают, а «я» в начале слога это два
// звука. Пусть педагог подтвердит состав сам: он в этом разбирается лучше
// строкового разбора.
//
// Поэтому здесь два поля: написание слога и его буквы. Буквы подставляются
// по написанию как ПРЕДЛОЖЕНИЕ, которое можно поправить, — набирать номера
// вручную с нуля было бы издевательством.

import React from 'react';
import { BigButton, palette } from '../ui';

const ALPHABET = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';

interface Value {
  name: string;
  /** Номера букв через пробел или запятую */
  letters: string;
}

interface Props {
  value: Value;
  onChange: (value: Value) => void;
  onSave: () => void;
  onCancel: () => void;
}

/** Предложение по написанию: номера букв в алфавите */
function suggestLetters(name: string): string {
  return [...name.toUpperCase()]
    .map((ch) => ALPHABET.indexOf(ch) + 1)
    .filter((n) => n > 0)
    .join(' ');
}

const NewSyllablePrompt: React.FC<Props> = ({ value, onChange, onSave, onCancel }) => {
  const parsed = value.letters
    .split(/[\s,]+/)
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 33);
  const preview = parsed.map((n) => ALPHABET[n - 1]).join(' ');

  return (
    <div
      data-testid="new-syllable"
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
          padding: 26,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          minWidth: 460,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 24 }}>Новый слог</h2>

        <label style={{ fontSize: 19 }}>Как пишется</label>
        <input
          data-testid="new-syllable-name"
          value={value.name}
          placeholder="шка"
          onChange={(e) => {
            const name = e.target.value;
            // Буквы подставляются, пока педагог их не правил сам: иначе
            // подсказка затирала бы его исправление на каждом нажатии
            const untouched = value.letters === suggestLetters(value.name);
            onChange({ name, letters: untouched ? suggestLetters(name) : value.letters });
          }}
          style={{ fontSize: 24, padding: '10px 14px', borderRadius: 12, border: 'none' }}
        />

        <label style={{ fontSize: 19 }}>Буквы слога — номера в алфавите</label>
        <input
          data-testid="new-syllable-letters"
          value={value.letters}
          placeholder="26 12 1"
          onChange={(e) => onChange({ ...value, letters: e.target.value })}
          style={{ fontSize: 22, padding: '10px 14px', borderRadius: 12, border: 'none' }}
        />
        <span data-testid="new-syllable-preview" style={{ fontSize: 19, color: palette.textDim }}>
          {parsed.length === 0 ? 'буквы не заданы' : `получится: ${preview}`}
        </span>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <BigButton onClick={onCancel} tone="secondary" testId="new-syllable-cancel">
            Отмена
          </BigButton>
          <BigButton
            onClick={onSave}
            disabled={value.name.trim().length === 0 || parsed.length === 0}
            testId="new-syllable-save"
          >
            Создать
          </BigButton>
        </div>
      </div>
    </div>
  );
};

export default NewSyllablePrompt;
