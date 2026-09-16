// packages/player/src/inophone/screens/SettingsScreen.tsx
// Настройки занятия на устройстве (ТЗ строки 87, 88).
//
// ЭТИ НАСТРОЙКИ ВАЖНЕЕ ВЫСТАВЛЕННЫХ В РЕДАКТОРЕ. Проект собирает методист
// заранее и один раз, а язык интерфейса меняют под конкретного ученика прямо
// на занятии. Сохранённое здесь переживает перезапуск и берётся при старте.
//
// ЯЗЫК ИНТЕРФЕЙСА ВЫЧЁРКИВАЕТСЯ ИЗ ИЗУЧАЕМЫХ немедленно, а не при сохранении:
// совпадение делает занятие бессмысленным (карточка показала бы одно и то же
// дважды), и увидеть это надо в тот момент, когда список ещё на экране.

import React from 'react';
import { inophone, INOPHONE_MAX_STUDY_LANGUAGES } from '@kiosk/shared';
import type { InophoneSettings, LanguageCode } from '../types';
import { BigButton, Panel, ScreenHeader, palette } from '../ui';

interface Props {
  settings: InophoneSettings;
  /**
   * Языки, у которых в ПОДКЛЮЧЁННОМ ПАКЕТЕ есть хоть одна запись произношения.
   *
   * Раньше эту надпись выводили из `speechTag` — тега системного голоса. Это
   * разные вещи, и разошлись они ровно тогда, когда башкирский озвучили: тега
   * у башкирского по-прежнему нет (ни один системный синтезатор его не знает),
   * а 444 записи в пакете есть. Экран при этом продолжал сообщать педагогу,
   * что произношения нет, — то есть врал про то, что лежит рядом на диске.
   * Нашлось это просмотром снимка при сборке инструкции.
   */
  audioLanguages: ReadonlySet<LanguageCode>;
  onChange: (next: InophoneSettings) => void;
  onBack: () => void;
}

const SettingsScreen: React.FC<Props> = ({ settings, audioLanguages, onChange, onBack }) => {
  const setInterface = (code: LanguageCode) => {
    const kept = settings.studyLanguages.filter((c) => c !== code);
    const fallback = inophone.LANGUAGE_CODES.find((c) => c !== code)!;
    onChange({
      ...settings,
      interfaceLanguage: code,
      // Пустой список не дал бы открыть ни одну сцену
      studyLanguages: kept.length > 0 ? kept : [fallback],
    });
  };

  const toggleStudy = (code: LanguageCode) => {
    const next = settings.studyLanguages.includes(code)
      ? settings.studyLanguages.filter((c) => c !== code)
      : [...settings.studyLanguages, code];
    if (next.length === 0 || next.length > INOPHONE_MAX_STUDY_LANGUAGES) return;
    onChange({ ...settings, studyLanguages: next });
  };

  const Row: React.FC<{ active: boolean; onClick: () => void; label: string; sub?: string; testId: string }> = ({
    active,
    onClick,
    label,
    sub,
    testId,
  }) => (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      style={{
        background: active ? palette.accent : palette.panelEdge,
        color: active ? palette.textDark : palette.text,
        border: 'none',
        borderRadius: 12,
        minHeight: 60,
        padding: '10px 18px',
        fontSize: 20,
        fontWeight: 600,
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      {label}
      {sub && <div style={{ fontSize: 14, fontWeight: 400, opacity: 0.85 }}>{sub}</div>}
    </button>
  );

  return (
    <div>
      <ScreenHeader title="Настройки" onBack={onBack} />

      <Panel style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
          Язык интерфейса и родной язык ученика
        </div>
        <div style={{ fontSize: 16, color: palette.textDim, marginBottom: 12 }}>
          Язык называет себя сам — пособие открывает тот, кто русского может ещё не знать.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {inophone.LANGUAGES.map((l) => (
            <Row
              key={l.code}
              testId={`inophone-iface-${l.code}`}
              active={settings.interfaceLanguage === l.code}
              onClick={() => setInterface(l.code)}
              label={l.nativeName}
              sub={l.russianName}
            />
          ))}
        </div>
      </Panel>

      <Panel style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
          Изучаемые языки (не больше {INOPHONE_MAX_STUDY_LANGUAGES})
        </div>
        <div style={{ fontSize: 16, color: palette.textDim, marginBottom: 12 }}>
          Родной язык в список не входит: карточка показала бы одно и то же дважды.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {inophone.LANGUAGES.filter((l) => l.code !== settings.interfaceLanguage).map((l) => (
            <Row
              key={l.code}
              testId={`inophone-study-${l.code}`}
              active={settings.studyLanguages.includes(l.code)}
              onClick={() => toggleStudy(l.code)}
              label={l.nativeName}
              sub={audioLanguages.has(l.code) ? l.russianName : `${l.russianName} — произношение в пакете не записано`}
            />
          ))}
        </div>
      </Panel>

      <Panel style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
          Громкость: {settings.volume}%
        </div>
        <input
          type="range"
          data-testid="inophone-volume"
          min={0}
          max={100}
          value={settings.volume}
          onChange={(e) => onChange({ ...settings, volume: parseInt(e.target.value, 10) })}
          style={{ width: '100%' }}
        />
      </Panel>

      <BigButton onClick={onBack} wide testId="inophone-settings-done">
        Готово
      </BigButton>
    </div>
  );
};

export default SettingsScreen;
