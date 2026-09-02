// packages/player/src/chrono/TimelineSettings.tsx
// Управление определениями атрибутов линии (6 типов, строка 15 ТЗ) -
// единственное место, где они создаются; без этого модального окна
// timeline.attributes навсегда остаётся пустым массивом, и в карточке
// события просто нечего показывать. Сами ЗНАЧЕНИЯ атрибутов
// редактируются в EventDetailCard.tsx (там, где событие), здесь только
// их ОПРЕДЕЛЕНИЯ (имя/тип/enumValues) - разные уровни модели, разные
// экраны, как и у самого домена (TimelineSchema.attributes vs
// TimelineEventSchema.attributeValues).

import React, { useState } from 'react';
import type { AttributeDef, AttributeType, ChronoTimeline } from '@kiosk/shared';
import './TimelineSettings.css';

export interface TimelineSettingsProps {
  timeline: ChronoTimeline;
  onAddAttribute: (attr: AttributeDef) => void;
  onRenameAttribute: (attrId: string, name: string) => void;
  onDeleteAttribute: (attrId: string) => void;
  /** FR-034 ТЗ - акцентный цвет линии; undefined сбрасывает на цвет по умолчанию */
  onChangeColor: (color: string | undefined) => void;
  onClose: () => void;
}

const DEFAULT_TIMELINE_COLOR = '#4a90e2';

const TYPE_OPTIONS: { value: AttributeType; label: string }[] = [
  { value: 'string', label: 'Строка' },
  { value: 'number', label: 'Число' },
  { value: 'boolean', label: 'Да/нет' },
  { value: 'enum', label: 'Список (один вариант)' },
  { value: 'set', label: 'Список (несколько вариантов)' },
  { value: 'eventLink', label: 'Ссылка на событие' },
];

const NEEDS_ENUM_VALUES: AttributeType[] = ['enum', 'set'];

const TimelineSettings: React.FC<TimelineSettingsProps> = ({
  timeline,
  onAddAttribute,
  onRenameAttribute,
  onDeleteAttribute,
  onChangeColor,
  onClose,
}) => {
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<AttributeType>('string');
  const [newEnumValuesText, setNewEnumValuesText] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const needsEnumValues = NEEDS_ENUM_VALUES.includes(newType);
  const enumValues = newEnumValuesText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  const canAdd = newName.trim().length > 0 && (!needsEnumValues || enumValues.length > 0);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAdd) return;

    const attr: AttributeDef = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      type: newType,
      ...(needsEnumValues ? { enumValues } : {}),
    };
    onAddAttribute(attr);
    setNewName('');
    setNewEnumValuesText('');
    setNewType('string');
  };

  const startRename = (attr: AttributeDef) => {
    setRenamingId(attr.id);
    setRenameValue(attr.name);
  };

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      onRenameAttribute(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  return (
    <div className="chrono-timeline-settings__overlay" onClick={onClose}>
      <div className="chrono-timeline-settings" onClick={(e) => e.stopPropagation()}>
        <h3 className="chrono-timeline-settings__title">Атрибуты линии «{timeline.name}»</h3>

        <div className="chrono-timeline-settings__color-row">
          <label className="chrono-timeline-settings__color-label">
            <span>Цвет линии</span>
            <input
              type="color"
              value={timeline.color ?? DEFAULT_TIMELINE_COLOR}
              onChange={(e) => onChangeColor(e.target.value)}
            />
          </label>
          {timeline.color && (
            <button type="button" onClick={() => onChangeColor(undefined)}>
              Сбросить
            </button>
          )}
        </div>

        <ul className="chrono-timeline-settings__list">
          {timeline.attributes.map((attr) => (
            <li key={attr.id} className="chrono-timeline-settings__item">
              {renamingId === attr.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => e.key === 'Enter' && commitRename()}
                />
              ) : (
                <span className="chrono-timeline-settings__item-name" onClick={() => startRename(attr)}>
                  {attr.name}
                </span>
              )}
              <span className="chrono-timeline-settings__item-type">
                {TYPE_OPTIONS.find((t) => t.value === attr.type)?.label}
                {attr.enumValues && ` (${attr.enumValues.join(', ')})`}
              </span>
              <button
                type="button"
                className="chrono-timeline-settings__item-delete"
                title="Удалить атрибут"
                onClick={() => onDeleteAttribute(attr.id)}
              >
                ×
              </button>
            </li>
          ))}
          {timeline.attributes.length === 0 && <li className="chrono-timeline-settings__empty">Пока нет ни одного атрибута</li>}
        </ul>

        <form className="chrono-timeline-settings__add-form" onSubmit={handleAdd}>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Название атрибута" />
          <select value={newType} onChange={(e) => setNewType(e.target.value as AttributeType)}>
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {needsEnumValues && (
            <textarea
              rows={2}
              value={newEnumValuesText}
              onChange={(e) => setNewEnumValuesText(e.target.value)}
              placeholder="Варианты, по одному на строку"
            />
          )}
          <button type="submit" disabled={!canAdd}>
            + Добавить атрибут
          </button>
        </form>

        <div className="chrono-timeline-settings__actions">
          <button type="button" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

export default TimelineSettings;
