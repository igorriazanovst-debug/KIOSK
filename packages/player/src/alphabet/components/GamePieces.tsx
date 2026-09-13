// packages/player/src/alphabet/components/GamePieces.tsx
// Элементы игрового поля: буква на панели, слог на панели, ячейка слова,
// карточка с иллюстрацией.
//
// Собраны в одном файле не по лени: все четыре — варианты одной и той же
// сущности «крупная нажимаемая плитка», и держать их рядом дешевле, чем
// разводить по файлам и потом синхронизировать размеры и состояния вручную.
//
// СОСТОЯНИЙ У ПЛИТКИ ТРИ: обычное, «верно» и «неверно». Цветом их мало —
// дошкольник может не различать оттенки, а среди детей с нарушением зрения
// это обычное дело. Поэтому верный ответ дополнительно получает галочку, а
// неверный — крестик и уход в полупрозрачность.

import React from 'react';
import { palette } from '../ui';

export type PieceState = 'idle' | 'correct' | 'wrong';

function stateStyle(state: PieceState): React.CSSProperties {
  if (state === 'correct') {
    return { background: '#3faa5a', color: '#ffffff', borderColor: '#2b7d41' };
  }
  if (state === 'wrong') {
    return { background: '#c0442e', color: '#ffffff', borderColor: '#8f2f1f', opacity: 0.45 };
  }
  return { background: palette.card, color: palette.letter, borderColor: 'rgba(0,0,0,0.12)' };
}

/** Значок состояния — дублирует цвет для тех, кто цвет различает плохо */
function stateMark(state: PieceState): string {
  return state === 'correct' ? '✓' : state === 'wrong' ? '✕' : '';
}

interface LetterTileProps {
  letter: string;
  state?: PieceState;
  onClick?: () => void;
  disabled?: boolean;
  size?: number;
  testId?: string;
}

export const LetterTile: React.FC<LetterTileProps> = ({
  letter,
  state = 'idle',
  onClick,
  disabled,
  size = 96,
  testId,
}) => (
  <button
    type="button"
    data-testid={testId}
    data-state={state}
    onClick={onClick}
    disabled={disabled}
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      border: '3px solid',
      fontSize: size * 0.5,
      fontWeight: 800,
      fontFamily: "Georgia, 'Times New Roman', serif",
      cursor: disabled ? 'default' : 'pointer',
      position: 'relative',
      flex: '0 0 auto',
      ...stateStyle(state),
    }}
  >
    {letter}
    {state !== 'idle' && (
      <span
        aria-hidden
        style={{ position: 'absolute', right: 6, bottom: 2, fontSize: size * 0.22 }}
      >
        {stateMark(state)}
      </span>
    )}
  </button>
);

interface SyllableTileProps {
  syllable: string;
  state?: PieceState;
  onClick?: () => void;
  disabled?: boolean;
  testId?: string;
}

export const SyllableTile: React.FC<SyllableTileProps> = ({
  syllable,
  state = 'idle',
  onClick,
  disabled,
  testId,
}) => (
  <button
    type="button"
    data-testid={testId}
    data-state={state}
    onClick={onClick}
    disabled={disabled}
    style={{
      minWidth: 104,
      height: 84,
      padding: '0 18px',
      borderRadius: 18,
      border: '3px solid',
      fontSize: 36,
      fontWeight: 800,
      textTransform: 'uppercase',
      cursor: disabled ? 'default' : 'pointer',
      position: 'relative',
      flex: '0 0 auto',
      ...stateStyle(state),
    }}
  >
    {syllable}
    {state !== 'idle' && (
      <span aria-hidden style={{ position: 'absolute', right: 8, bottom: 2, fontSize: 18 }}>
        {stateMark(state)}
      </span>
    )}
  </button>
);

interface WordCellProps {
  /** Текст слога; пусто — ячейка ещё не заполнена */
  syllable: string | null;
  /** Эту ячейку заполняют сейчас */
  active?: boolean;
  testId?: string;
}

export const WordCell: React.FC<WordCellProps> = ({ syllable, active, testId }) => (
  <div
    data-testid={testId}
    data-filled={syllable ? 'yes' : 'no'}
    style={{
      minWidth: 104,
      height: 92,
      padding: '0 18px',
      borderRadius: 18,
      // Пустая ячейка — пунктир: ребёнок должен видеть, что сюда что-то
      // кладут, а не что здесь «пусто и так задумано»
      border: syllable ? '3px solid rgba(0,0,0,0.12)' : `4px dashed ${active ? palette.accent : 'rgba(255,255,255,0.75)'}`,
      background: syllable ? palette.card : 'rgba(255,255,255,0.14)',
      color: palette.letter,
      fontSize: 40,
      fontWeight: 800,
      textTransform: 'uppercase',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: '0 0 auto',
    }}
  >
    {syllable ?? ''}
  </div>
);

interface WordPictureProps {
  src: string;
  alt: string;
  /** Логическая высота картинки; ширина подстроится */
  size?: number;
  testId?: string;
}

export const WordPicture: React.FC<WordPictureProps> = ({ src, alt, size = 300, testId }) => (
  <div
    data-testid={testId}
    style={{
      background: palette.card,
      borderRadius: 22,
      padding: 12,
      // Рамка как у эталона: картинка «в багете», а не наклейка на фоне
      boxShadow: '0 6px 0 rgba(0,0,0,0.18)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 0,
    }}
  >
    <img
      src={src}
      alt={alt}
      style={{ height: size, width: size, objectFit: 'contain', borderRadius: 14 }}
    />
  </div>
);
