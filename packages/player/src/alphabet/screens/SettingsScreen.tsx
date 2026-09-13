// packages/player/src/alphabet/screens/SettingsScreen.tsx
// Настройки занятия: громкость, тип устройства, цвет экрана, пароль педагога.
//
// Раздел закрыт паролем (ТЗ раздел 3) — сюда попадают только через
// PasswordPrompt, и это проверяет рантайм, а не экран.
//
// НАПОМИНАНИЕ О ПАРОЛЕ ПО УМОЛЧАНИЮ ЖИВЁТ ЗДЕСЬ, а не на экране входа.
// В Тип 2 первая версия писала «пока стандартный — 12345» прямо в окне
// ввода, и это сводило защиту на нет: экран входа ребёнок видит чаще всего.
// Здесь, за паролем, напоминание видит только тот, кто уже вошёл.

import React from 'react';
import { SCREEN_THEME_COLORS, BigButton, Panel, ScrollArea, palette } from '../ui';
import type { AlphabetSettings } from '../types';

interface Props {
  settings: AlphabetSettings;
  passwordIsDefault: boolean;
  onChange: (patch: Partial<AlphabetSettings>) => void;
  onChangePassword: () => void;
  onBack: () => void;
}

const DEVICE_LABELS: Record<string, string> = {
  tablet: 'Планшет',
  board: 'Интерактивная доска',
  table: 'Интерактивный стол',
};

const THEME_LABELS: Record<string, string> = {
  sky: 'Небо',
  forest: 'Лес',
  night: 'Ночь',
  sand: 'Песок',
  plum: 'Слива',
  graphite: 'Графит',
};

const SettingsScreen: React.FC<Props> = ({
  settings,
  passwordIsDefault,
  onChange,
  onChangePassword,
  onBack,
}) => (
  <Panel testId="settings">
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <BigButton onClick={onBack} tone="secondary" testId="settings-back">
        ← Назад
      </BigButton>
      <h2 style={{ margin: 0, fontSize: 28 }}>Настройки</h2>
    </div>

    <ScrollArea testId="settings-body">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingRight: 8 }}>
        <div>
          <div style={{ fontSize: 21, marginBottom: 8 }}>
            Громкость: <b data-testid="settings-volume-value">{settings.volume}%</b>
          </div>
          <input
            data-testid="settings-volume"
            type="range"
            min={0}
            max={100}
            step={5}
            value={settings.volume}
            onChange={(e) => onChange({ volume: Number(e.target.value) })}
            style={{ width: 420 }}
          />
        </div>

        <div>
          <div style={{ fontSize: 21, marginBottom: 8 }}>Устройство</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {Object.entries(DEVICE_LABELS).map(([value, label]) => (
              <button
                key={value}
                type="button"
                data-testid={`settings-device-${value}`}
                onClick={() => onChange({ device: value as AlphabetSettings['device'] })}
                style={{
                  background: settings.device === value ? palette.accent : 'rgba(255,255,255,0.16)',
                  color: settings.device === value ? palette.textDark : palette.text,
                  border: 'none',
                  borderRadius: 14,
                  padding: '14px 20px',
                  fontSize: 20,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 21, marginBottom: 8 }}>Цвет экрана</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {Object.entries(SCREEN_THEME_COLORS).map(([value, color]) => (
              <button
                key={value}
                type="button"
                data-testid={`settings-theme-${value}`}
                aria-label={THEME_LABELS[value] ?? value}
                onClick={() => onChange({ screenTheme: value as AlphabetSettings['screenTheme'] })}
                style={{
                  background: color,
                  // Выбранный отмечен рамкой, а не только цветом: отличить
                  // «выбран» от «просто такой цвет» иначе невозможно
                  border:
                    settings.screenTheme === value
                      ? `4px solid ${palette.accent}`
                      : '4px solid rgba(255,255,255,0.35)',
                  borderRadius: 14,
                  width: 104,
                  height: 68,
                  color: '#ffffff',
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {THEME_LABELS[value] ?? value}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 21, marginBottom: 8 }}>Пароль педагога</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <BigButton onClick={onChangePassword} tone="secondary" testId="settings-password">
              Сменить пароль
            </BigButton>
            {passwordIsDefault && (
              <span data-testid="settings-password-default" style={{ fontSize: 19, color: palette.textDim }}>
                Сейчас стоит пароль по умолчанию — 12345. Его стоит сменить.
              </span>
            )}
          </div>
        </div>
      </div>
    </ScrollArea>
  </Panel>
);

export default SettingsScreen;
