// packages/editor-web/src/components/InophonePropertiesSection.tsx
// Панель свойств виджета «Инофон» (Тип 4).
//
// Здесь педагог настраивает занятие до того, как проект уедет на устройство:
// язык интерфейса (он же родной язык ученика, ТЗ строка 87), изучаемые языки
// (строка 88), режим, длина партии, число игроков и громкость.
//
// СЦЕНЫ ЗДЕСЬ НЕ ВЫБИРАЮТСЯ, и это осознанно — тот же довод, что у Типа 3 с
// комплектами слов: состав пакета контента известен только на устройстве.
// Редактор его не видит и показал бы пустой список, который педагог прочитал
// бы как поломку.
//
// ЯЗЫК ИНТЕРФЕЙСА ВЫЧЁРКИВАЕТСЯ ИЗ ИЗУЧАЕМЫХ прямо здесь, а не только при
// чтении настроек на устройстве. Совпадение делает занятие бессмысленным —
// карточка показала бы одно и то же дважды, — а возникает оно легко: сменил
// язык интерфейса и не заметил. Поймать это в редакторе дешевле, чем на
// занятии.

import React from 'react';
import type { Widget } from '../types';
import {
  INOPHONE_WIDGET_TYPE,
  INOPHONE_LANGUAGES,
  INOPHONE_MAX_PLAYERS,
  INOPHONE_MAX_STUDY_LANGUAGES,
  INOPHONE_MODES,
  INOPHONE_MODE_TITLES,
  INOPHONE_MODE_HINTS,
  INOPHONE_QUESTION_COUNTS,
  INOPHONE_DEFAULT_PROPS,
  InophoneWidgetProperties,
} from '@kiosk/shared';

interface Props {
  widget: Widget;
  onPropertiesChange: (key: string, value: any) => void;
}

const InophonePropertiesSection: React.FC<Props> = ({ widget, onPropertiesChange }) => {
  if (widget.type !== INOPHONE_WIDGET_TYPE) return null;

  const props = widget.properties as Partial<InophoneWidgetProperties>;
  const interfaceLanguage = props.interfaceLanguage ?? INOPHONE_DEFAULT_PROPS.interfaceLanguage;
  const studyLanguages = props.studyLanguages ?? INOPHONE_DEFAULT_PROPS.studyLanguages;

  /** Переключение изучаемого языка с соблюдением предела в три */
  const toggleStudy = (code: string) => {
    const chosen = studyLanguages.includes(code as never)
      ? studyLanguages.filter((c) => c !== code)
      : [...studyLanguages, code];
    // Пустой список не дал бы открыть ни одну сцену, а сверх предела — не
    // поместился бы на карточку объекта
    if (chosen.length === 0 || chosen.length > INOPHONE_MAX_STUDY_LANGUAGES) return;
    onPropertiesChange('studyLanguages', chosen);
  };

  const changeInterface = (code: string) => {
    onPropertiesChange('interfaceLanguage', code);
    const kept = studyLanguages.filter((c) => c !== code);
    if (kept.length !== studyLanguages.length) {
      // Если изучаемым остался только вычеркнутый язык, подставляем первый
      // другой: пустой список запер бы приложение
      const fallback = INOPHONE_LANGUAGES.map((l) => l.code).find((c) => c !== code)!;
      onPropertiesChange('studyLanguages', kept.length > 0 ? kept : [fallback]);
    }
  };

  return (
    <div className="property-section">
      <h4>Инофон</h4>

      <div className="property-field">
        <label>Заголовок виджета</label>
        <input
          type="text"
          value={props.title || ''}
          placeholder="Инофон"
          onChange={(e) => onPropertiesChange('title', e.target.value)}
        />
      </div>

      <div className="property-field">
        <label>Язык интерфейса (родной язык ученика)</label>
        <select value={interfaceLanguage} onChange={(e) => changeInterface(e.target.value)}>
          {INOPHONE_LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.russianName} — {lang.nativeName}
            </option>
          ))}
        </select>
      </div>

      <div className="property-field">
        <label>
          Изучаемые языки (не больше {INOPHONE_MAX_STUDY_LANGUAGES})
        </label>
        {INOPHONE_LANGUAGES.filter((lang) => lang.code !== interfaceLanguage).map((lang) => (
          <label key={lang.code} style={{ display: 'block', fontWeight: 400 }}>
            <input
              type="checkbox"
              checked={studyLanguages.includes(lang.code)}
              onChange={() => toggleStudy(lang.code)}
            />{' '}
            {lang.russianName} — {lang.nativeName}
            {!lang.speechTag && ' (озвучка синтезом недоступна)'}
          </label>
        ))}
      </div>

      <div className="property-field">
        <label>Режим при открытии</label>
        <select
          value={props.defaultMode ?? INOPHONE_DEFAULT_PROPS.defaultMode}
          onChange={(e) => onPropertiesChange('defaultMode', e.target.value)}
        >
          {INOPHONE_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {INOPHONE_MODE_TITLES[mode]} — {INOPHONE_MODE_HINTS[mode]}
            </option>
          ))}
        </select>
      </div>

      <div className="property-field">
        <label>Вопросов в партии</label>
        <select
          value={props.questionCount ?? INOPHONE_DEFAULT_PROPS.questionCount}
          onChange={(e) => onPropertiesChange('questionCount', parseInt(e.target.value, 10))}
        >
          {INOPHONE_QUESTION_COUNTS.map((count) => (
            <option key={count} value={count}>
              {count}
            </option>
          ))}
        </select>
      </div>

      <div className="property-field">
        <label>Игроков по умолчанию</label>
        <select
          value={props.defaultPlayerCount ?? INOPHONE_DEFAULT_PROPS.defaultPlayerCount}
          onChange={(e) => onPropertiesChange('defaultPlayerCount', parseInt(e.target.value, 10))}
        >
          {Array.from({ length: INOPHONE_MAX_PLAYERS }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div className="property-field">
        <label>Громкость: {props.volume ?? INOPHONE_DEFAULT_PROPS.volume}%</label>
        <input
          type="range"
          min={0}
          max={100}
          value={props.volume ?? INOPHONE_DEFAULT_PROPS.volume}
          onChange={(e) => onPropertiesChange('volume', parseInt(e.target.value, 10))}
        />
      </div>
    </div>
  );
};

export default InophonePropertiesSection;
