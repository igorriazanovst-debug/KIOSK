// packages/editor-web/src/components/WordsPropertiesSection.tsx
// Панель свойств виджета «Я знаю много слов» (Тип 2).
//
// Здесь педагог настраивает занятие до того, как проект уедет на устройство:
// уровень сложности по умолчанию (ТЗ строка 50), число игроков за столом
// (строка 54), громкость (строка 51) и длину партии. Набор тем (строка 48)
// в MVP настраивается на самом устройстве — список тем известен только там,
// в пакете контента, а редактор его не видит.

import React from 'react';
import type { Widget } from '../types';
import {
  WORDS_WIDGET_TYPE,
  WORDS_MAX_PLAYERS,
  WORDS_DEFAULT_STEPS_PER_PLAYER,
  WordsWidgetProperties,
} from '@kiosk/shared';

interface Props {
  widget: Widget;
  onPropertiesChange: (key: string, value: any) => void;
}

const LEVEL_LABELS: Record<number, string> = {
  0: 'Ⅰ — простой',
  1: 'Ⅱ — средний',
  2: 'Ⅲ — сложный',
};

const WordsPropertiesSection: React.FC<Props> = ({ widget, onPropertiesChange }) => {
  if (widget.type !== WORDS_WIDGET_TYPE) return null;

  const props = widget.properties as Partial<WordsWidgetProperties>;

  return (
    <div className="property-section">
      <h4>Я знаю много слов</h4>

      <div className="property-field">
        <label>Заголовок виджета</label>
        <input
          type="text"
          value={props.title || ''}
          placeholder="Я знаю много слов"
          onChange={(e) => onPropertiesChange('title', e.target.value)}
        />
      </div>

      <div className="property-field">
        <label>Уровень сложности по умолчанию</label>
        <select
          value={props.defaultLevel ?? 0}
          onChange={(e) => onPropertiesChange('defaultLevel', parseInt(e.target.value, 10))}
        >
          {[0, 1, 2].map((level) => (
            <option key={level} value={level}>
              {LEVEL_LABELS[level]}
            </option>
          ))}
        </select>
      </div>

      <div className="property-field">
        <label>Игроков по умолчанию</label>
        <select
          value={props.defaultPlayerCount ?? 1}
          onChange={(e) => onPropertiesChange('defaultPlayerCount', parseInt(e.target.value, 10))}
        >
          {Array.from({ length: WORDS_MAX_PLAYERS }, (_, i) => i + 1).map((count) => (
            <option key={count} value={count}>
              {count === 1 ? '1 — одиночная игра' : `${count} — вокруг стола`}
            </option>
          ))}
        </select>
      </div>

      <div className="property-field">
        <label>Громкость, %</label>
        <input
          type="number"
          min={0}
          max={100}
          value={props.volume ?? 70}
          onChange={(e) => {
            const raw = parseInt(e.target.value, 10);
            const clamped = Number.isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 70;
            onPropertiesChange('volume', clamped);
          }}
        />
      </div>

      <div className="property-field">
        <label>Шагов на игрока в партии</label>
        <input
          type="number"
          min={1}
          max={50}
          value={props.stepsPerPlayer ?? WORDS_DEFAULT_STEPS_PER_PLAYER}
          onChange={(e) => {
            const raw = parseInt(e.target.value, 10);
            const clamped = Number.isFinite(raw)
              ? Math.min(50, Math.max(1, raw))
              : WORDS_DEFAULT_STEPS_PER_PLAYER;
            onPropertiesChange('stepsPerPlayer', clamped);
          }}
        />
      </div>
    </div>
  );
};

export default WordsPropertiesSection;
