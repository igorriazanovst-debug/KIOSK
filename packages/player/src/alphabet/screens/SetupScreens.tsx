// packages/player/src/alphabet/screens/SetupScreens.tsx
// Три коротких экрана подготовки партии: выбор этапа, число вопросов, итоги.
//
// Вместе, а не по файлам: каждый — одна панель с рядом кнопок, и в отдельном
// файле от такого экрана остаётся больше шапки, чем содержимого.

import React from 'react';
import { ALPHABET_STAGES, ALPHABET_STAGE_HINTS, ALPHABET_STAGE_TITLES } from '@kiosk/shared';
import type { AlphabetStage } from '@kiosk/shared';
import { BigButton, Panel, ScrollArea, palette } from '../ui';

// ─── Выбор этапа ────────────────────────────────────────────────────────

interface StageSelectProps {
  /** Этапы, для которых в пакете есть подходящие слова */
  availability: Record<AlphabetStage, number>;
  onPick: (stage: AlphabetStage) => void;
  onBack: () => void;
}

/**
 * Экран выбора этапа. Подписи М / МА / МАМА — как у эталона: они объясняют
 * порядок обучения без слов, и ребёнок, который ещё не читает, различает
 * этапы по длине.
 *
 * Этап, для которого в пакете нет слов, ОТКЛЮЧЁН и говорит почему. Это
 * реальное состояние: односложные слова не годятся этапам 2 и 3, и маленький
 * набор педагога может не дать ни одного подходящего.
 */
export const StageSelectScreen: React.FC<StageSelectProps> = ({ availability, onPick, onBack }) => (
  <Panel testId="stage-select">
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <BigButton onClick={onBack} tone="secondary" testId="stage-back">
        ← Назад
      </BigButton>
      <h2 style={{ margin: 0, fontSize: 30 }}>Выберите этап</h2>
    </div>

    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      {ALPHABET_STAGES.map((stage) => {
        const count = availability[stage] ?? 0;
        return (
          <button
            key={stage}
            type="button"
            data-testid={`stage-${stage}`}
            disabled={count === 0}
            onClick={() => onPick(stage)}
            style={{
              background: count === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.16)',
              border: 'none',
              borderRadius: 18,
              padding: 22,
              minWidth: 240,
              textAlign: 'left',
              color: palette.text,
              cursor: count === 0 ? 'default' : 'pointer',
              opacity: count === 0 ? 0.5 : 1,
            }}
          >
            <div style={{ fontSize: 42, fontWeight: 800, color: palette.accent }}>
              {ALPHABET_STAGE_HINTS[stage]}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{ALPHABET_STAGE_TITLES[stage]}</div>
            <div style={{ fontSize: 17, color: palette.textDim, marginTop: 6 }}>
              {count === 0 ? 'нет подходящих слов в наборе' : `слов в наборе: ${count}`}
            </div>
          </button>
        );
      })}
    </div>
  </Panel>
);

// ─── Число вопросов ─────────────────────────────────────────────────────

interface QuestionCountProps {
  counts: readonly number[];
  current: number;
  onPick: (count: number) => void;
  onBack: () => void;
}

/** Отдельный экран, как у эталона (`NumberOfQuestions`): длину занятия педагог меняет чаще всего */
export const QuestionCountScreen: React.FC<QuestionCountProps> = ({
  counts,
  current,
  onPick,
  onBack,
}) => (
  <Panel testId="question-count">
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <BigButton onClick={onBack} tone="secondary" testId="count-back">
        ← Назад
      </BigButton>
      <h2 style={{ margin: 0, fontSize: 30 }}>Сколько вопросов в игре?</h2>
    </div>
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
      {counts.map((count) => (
        <button
          key={count}
          type="button"
          data-testid={`count-${count}`}
          onClick={() => onPick(count)}
          style={{
            background: count === current ? palette.accent : 'rgba(255,255,255,0.16)',
            color: count === current ? palette.textDark : palette.text,
            border: 'none',
            borderRadius: 18,
            width: 110,
            height: 92,
            fontSize: 38,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          {count}
        </button>
      ))}
    </div>
  </Panel>
);

// ─── Итоги ──────────────────────────────────────────────────────────────

interface ResultsProps {
  /** Игрок → сводка партии */
  rows: Array<{ playerId: string; name: string; completed: number; flawless: number; errors: number }>;
  onAgain: () => void;
  onMenu: () => void;
}

/**
 * Итоги партии. Показываем «без ошибки», а не процент: доля правильных
 * ответов у дошкольника мало что значит педагогу, а «сколько слов далось с
 * первого раза» — понятная и проверяемая величина.
 *
 * Отрицательных формулировок нет намеренно: ошибок может быть много, и
 * подписывать это словом «плохо» — не дело приложения.
 */
export const ResultsScreen: React.FC<ResultsProps> = ({ rows, onAgain, onMenu }) => (
  <Panel testId="results">
    <h2 style={{ margin: 0, fontSize: 34 }}>Игра окончена</h2>
    <ScrollArea testId="results-rows">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((row) => (
          <div
            key={row.playerId}
            data-testid={`results-${row.playerId}`}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 18,
              background: 'rgba(255,255,255,0.12)',
              borderRadius: 14,
              padding: '14px 18px',
            }}
          >
            <span style={{ fontSize: 26, fontWeight: 700, minWidth: 180 }}>{row.name}</span>
            <span style={{ fontSize: 22 }}>
              пройдено слов: <b>{row.completed}</b>
            </span>
            <span style={{ fontSize: 22 }}>
              с первого раза: <b>{row.flawless}</b>
            </span>
            <span style={{ fontSize: 20, color: palette.textDim }}>
              подсказок понадобилось: {row.errors}
            </span>
          </div>
        ))}
      </div>
    </ScrollArea>
    <div style={{ display: 'flex', gap: 14 }}>
      <BigButton onClick={onAgain} wide testId="results-again">
        Ещё раз
      </BigButton>
      <BigButton onClick={onMenu} tone="secondary" testId="results-menu">
        В меню
      </BigButton>
    </div>
  </Panel>
);
