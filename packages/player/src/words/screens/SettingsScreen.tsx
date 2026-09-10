// packages/player/src/words/screens/SettingsScreen.tsx
// Настройки занятия: громкость (ТЗ строка 51), режим устройства и уровень
// сложности по темам (строка 50).
//
// Уровень назначается ТЕМЕ целиком, а не каждому слову по отдельности: у
// эталона есть и то и другое, но пословный разбор — работа на полчаса для
// педагога, а тематический выбор закрывает реальный сценарий занятия.
// Пословное переопределение поддержано моделью данных (levelOverrides) и
// может быть добавлено экраном позже, не меняя формат.

import React from 'react';
import { BigButton, ErrorBanner, ScreenFrame, ScrollArea, palette, TOUCH_TARGET_PX } from '../ui';
import type { WordsLibrary, WordsSettings, DeviceMode } from '@kiosk/shared';

interface Props {
  library: WordsLibrary | null;
  settings: WordsSettings;
  error: string | null;
  onBack: () => void;
  onChange: (next: WordsSettings) => void;
}

const LEVELS: Array<{ value: 0 | 1 | 2; label: string }> = [
  { value: 0, label: 'Ⅰ' },
  { value: 1, label: 'Ⅱ' },
  { value: 2, label: 'Ⅲ' },
];

const DEVICES: Array<{ value: DeviceMode; label: string }> = [
  { value: 'tablet', label: 'Планшет' },
  { value: 'board', label: 'Интерактивная доска' },
  { value: 'table', label: 'Интерактивный стол' },
];

const SettingsScreen: React.FC<Props> = ({ library, settings, error, onBack, onChange }) => {
  const themeLevel = (themeId: string): number => {
    const theme = library?.themes.find((t) => t.id === themeId);
    if (!theme || theme.wordIds.length === 0) return 0;
    const levels = theme.wordIds.map(
      (id) => settings.levelOverrides[id] ?? library?.words.find((w) => w.id === id)?.level ?? 0
    );
    return levels.every((l) => l === levels[0]) ? levels[0] : -1;
  };

  const setThemeLevel = (themeId: string, level: 0 | 1 | 2) => {
    const theme = library?.themes.find((t) => t.id === themeId);
    if (!theme) return;
    const levelOverrides = { ...settings.levelOverrides };
    for (const wordId of theme.wordIds) levelOverrides[wordId] = level;
    onChange({ ...settings, levelOverrides });
  };

  return (
    <ScreenFrame title="Настройки" onBack={onBack}>
      <ErrorBanner text={error} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label style={{ fontSize: 26 }}>Громкость: {settings.volume}%</label>
        <input
          data-testid="volume"
          type="range"
          min={0}
          max={100}
          value={settings.volume}
          onChange={(e) => onChange({ ...settings, volume: parseInt(e.target.value, 10) })}
          style={{ width: '100%', height: TOUCH_TARGET_PX / 2 }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={{ fontSize: 26 }}>Устройство</span>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {DEVICES.map((device) => (
            <BigButton
              key={device.value}
              onClick={() => onChange({ ...settings, device: device.value })}
              tone={settings.device === device.value ? 'primary' : 'secondary'}
              testId={`device-${device.value}`}
            >
              {device.label}
            </BigButton>
          ))}
        </div>
      </div>

      <span style={{ fontSize: 26 }}>Уровень сложности по темам</span>
      <ScrollArea style={{ flex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(library?.themes ?? []).map((theme) => {
            const current = themeLevel(theme.id);
            return (
              <div
                key={theme.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  background: palette.panel,
                  borderRadius: 12,
                  padding: '10px 20px',
                }}
              >
                <span style={{ fontSize: 24 }}>
                  {theme.title}
                  {current === -1 && (
                    <span style={{ fontSize: 18, color: palette.textMuted }}> · вперемешку</span>
                  )}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {LEVELS.map((level) => (
                    <button
                      key={level.value}
                      data-testid={`level-${theme.id}-${level.value}`}
                      onClick={() => setThemeLevel(theme.id, level.value)}
                      style={{
                        width: TOUCH_TARGET_PX,
                        height: TOUCH_TARGET_PX,
                        fontSize: 26,
                        borderRadius: 10,
                        border: 'none',
                        background: current === level.value ? palette.accent : palette.panelLight,
                        color: palette.text,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {level.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </ScreenFrame>
  );
};

export default SettingsScreen;
