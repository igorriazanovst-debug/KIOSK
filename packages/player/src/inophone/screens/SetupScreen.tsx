// packages/player/src/inophone/screens/SetupScreen.tsx
// Настройка занятия перед открытием сцены: режим, игроки, длина партии,
// способ подачи задания (ТЗ строка 89).
//
// ОДИН ЭКРАН, А НЕ ЦЕПОЧКА. У эталона выбор числа вопросов вынесен в отдельный
// экран `NumberOfQuestions`, и это было переносимо, пока настройка была одна.
// Здесь их четыре, и четыре экрана подряд перед каждой партией — это четыре
// повода передумать посреди занятия.
//
// НЕДОСТУПНОЕ НЕ ПРЯЧЕТСЯ, А ОБЪЯСНЯЕТСЯ. Соревнование при одном выбранном
// игроке показывается погашенным с причиной, а не исчезает: исчезнувший режим
// педагог ищет в настройках и не находит.

import React from 'react';
import { inophone } from '@kiosk/shared';
import {
  INOPHONE_MAX_PLAYERS,
  INOPHONE_MODES,
  INOPHONE_MODE_HINTS,
  INOPHONE_MODE_TITLES,
  INOPHONE_QUESTION_COUNTS,
} from '@kiosk/shared';
import type { InophoneScreenMode } from '@kiosk/shared';
import { BigButton, Panel, ScreenHeader, palette } from '../ui';
import type { Profile } from '../types';

export interface SetupValues {
  mode: InophoneScreenMode;
  playerIds: string[];
  questionsPerPlayer: number;
  presentation: inophone.Presentation;
}

interface Props {
  sceneTitle: string;
  profiles: Profile[];
  values: SetupValues;
  onChange: (next: SetupValues) => void;
  onStart: () => void;
  onBack: () => void;
}

const Choice: React.FC<{
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  title: string;
  hint?: string;
  testId?: string;
}> = ({ active, onClick, disabled, title, hint, testId }) => (
  <button
    type="button"
    data-testid={testId}
    onClick={onClick}
    disabled={disabled}
    style={{
      background: active ? palette.accent : palette.panelEdge,
      color: active ? palette.textDark : palette.text,
      border: 'none',
      borderRadius: 14,
      minHeight: 64,
      padding: '12px 20px',
      fontSize: 20,
      fontWeight: 600,
      textAlign: 'left',
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.45 : 1,
    }}
  >
    {title}
    {hint && (
      <div style={{ fontSize: 15, fontWeight: 400, opacity: 0.85 }}>{hint}</div>
    )}
  </button>
);

const SetupScreen: React.FC<Props> = ({
  sceneTitle,
  profiles,
  values,
  onChange,
  onStart,
  onBack,
}) => {
  const togglePlayer = (id: string) => {
    const next = values.playerIds.includes(id)
      ? values.playerIds.filter((p) => p !== id)
      : [...values.playerIds, id];
    if (next.length > INOPHONE_MAX_PLAYERS) return;
    onChange({ ...values, playerIds: next });
  };

  const canChallenge = values.playerIds.length >= 2;
  const isGame = values.mode !== 'learning';
  // Обучение идёт без счёта и без хода — игроки там не нужны вовсе, поэтому
  // требование «выбери хотя бы одного» на него не распространяется
  const canStart =
    values.mode === 'learning' ||
    (values.playerIds.length >= 1 && (values.mode !== 'challenge' || canChallenge));

  return (
    <div>
      <ScreenHeader title={sceneTitle} onBack={onBack} />

      <Panel style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Режим</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {INOPHONE_MODES.map((mode) => {
            const blocked = mode === 'challenge' && !canChallenge;
            return (
              <Choice
                key={mode}
                testId={`inophone-mode-${mode}`}
                active={values.mode === mode}
                disabled={blocked}
                onClick={() => onChange({ ...values, mode })}
                title={INOPHONE_MODE_TITLES[mode]}
                hint={
                  blocked
                    ? 'нужно выбрать не меньше двух учеников'
                    : INOPHONE_MODE_HINTS[mode]
                }
              />
            );
          })}
        </div>
      </Panel>

      <Panel style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
          Кто играет (до {INOPHONE_MAX_PLAYERS}, в порядке хода)
        </div>
        {profiles.length === 0 ? (
          <div style={{ color: palette.textDim, fontSize: 18 }}>
            Список учеников пуст — добавьте хотя бы одного на первом экране.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {profiles.map((p) => {
              const at = values.playerIds.indexOf(p.id);
              return (
                <Choice
                  key={p.id}
                  testId={`inophone-pick-${p.id}`}
                  active={at >= 0}
                  onClick={() => togglePlayer(p.id)}
                  title={p.name}
                  hint={at >= 0 ? `ходит ${at + 1}-м` : undefined}
                />
              );
            })}
          </div>
        )}
      </Panel>

      {isGame && (
        <Panel style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
            Вопросов каждому
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            {INOPHONE_QUESTION_COUNTS.map((n) => (
              <Choice
                key={n}
                testId={`inophone-count-${n}`}
                active={values.questionsPerPlayer === n}
                onClick={() => onChange({ ...values, questionsPerPlayer: n })}
                title={String(n)}
              />
            ))}
          </div>
        </Panel>
      )}

      {isGame && (
        <Panel style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
            Как задавать объект
          </div>
          <div style={{ fontSize: 16, color: palette.textDim, marginBottom: 12 }}>
            Выключить оба нельзя — ученику будет нечего искать.
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Choice
              testId="inophone-present-audio"
              active={values.presentation.audio}
              onClick={() =>
                onChange({
                  ...values,
                  presentation: inophone.togglePresentation(values.presentation, 'audio'),
                })
              }
              title="Произносить"
            />
            <Choice
              testId="inophone-present-text"
              active={values.presentation.text}
              onClick={() =>
                onChange({
                  ...values,
                  presentation: inophone.togglePresentation(values.presentation, 'text'),
                })
              }
              title="Показывать написание"
            />
          </div>
        </Panel>
      )}

      <BigButton onClick={onStart} disabled={!canStart} wide testId="inophone-start">
        Начать
      </BigButton>
    </div>
  );
};

export default SetupScreen;
