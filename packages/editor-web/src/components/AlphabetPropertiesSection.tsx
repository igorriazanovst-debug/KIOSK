// packages/editor-web/src/components/AlphabetPropertiesSection.tsx
// Панель свойств виджета «АзбукоСлов» (Тип 3).
//
// Здесь педагог настраивает занятие до того, как проект уедет на устройство:
// с какого этапа открывается приложение, длина партии (у эталона это отдельный
// экран `NumberOfQuestions`), число игроков за столом (ТЗ строка 75) и
// громкость.
//
// Комплекты слов (ТЗ строка 76) здесь НЕ настраиваются, и это осознанно: их
// состав известен только на устройстве — поставочные комплекты лежат в пакете
// контента, а свои педагог заводит там же. Редактор их не видит и показал бы
// пустой список, который выглядел бы как поломка.

import React from 'react';
import type { Widget } from '../types';
import {
  ALPHABET_WIDGET_TYPE,
  ALPHABET_MAX_PLAYERS,
  ALPHABET_STAGES,
  ALPHABET_STAGE_TITLES,
  ALPHABET_STAGE_HINTS,
  ALPHABET_QUESTION_COUNTS,
  ALPHABET_DEFAULT_QUESTION_COUNT,
  ALPHABET_DEFAULT_PROPS,
  AlphabetWidgetProperties,
} from '@kiosk/shared';

interface Props {
  widget: Widget;
  onPropertiesChange: (key: string, value: any) => void;
}

const AlphabetPropertiesSection: React.FC<Props> = ({ widget, onPropertiesChange }) => {
  if (widget.type !== ALPHABET_WIDGET_TYPE) return null;

  const props = widget.properties as Partial<AlphabetWidgetProperties>;

  return (
    <div className="property-section">
      <h4>АзбукоСлов</h4>

      <div className="property-field">
        <label>Заголовок виджета</label>
        <input
          type="text"
          value={props.title || ''}
          placeholder="АзбукоСлов"
          onChange={(e) => onPropertiesChange('title', e.target.value)}
        />
      </div>

      <div className="property-field">
        <label>Этап по умолчанию</label>
        <select
          value={props.defaultStage ?? ALPHABET_DEFAULT_PROPS.defaultStage}
          onChange={(e) => onPropertiesChange('defaultStage', e.target.value)}
        >
          {ALPHABET_STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {ALPHABET_STAGE_HINTS[stage]} — {ALPHABET_STAGE_TITLES[stage]}
            </option>
          ))}
        </select>
      </div>

      <div className="property-field">
        <label>Вопросов в партии</label>
        <select
          value={props.questionCount ?? ALPHABET_DEFAULT_QUESTION_COUNT}
          onChange={(e) => onPropertiesChange('questionCount', parseInt(e.target.value, 10))}
        >
          {ALPHABET_QUESTION_COUNTS.map((count) => (
            <option key={count} value={count}>
              {count}
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
          {Array.from({ length: ALPHABET_MAX_PLAYERS }, (_, i) => i + 1).map((count) => (
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
          value={props.volume ?? ALPHABET_DEFAULT_PROPS.volume}
          onChange={(e) => {
            const raw = parseInt(e.target.value, 10);
            const clamped = Number.isFinite(raw)
              ? Math.min(100, Math.max(0, raw))
              : ALPHABET_DEFAULT_PROPS.volume;
            onPropertiesChange('volume', clamped);
          }}
        />
      </div>
    </div>
  );
};

export default AlphabetPropertiesSection;
