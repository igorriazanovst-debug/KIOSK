// packages/player/src/alphabet/screens/MenuScreen.tsx
// Главное меню: играть, алфавит, число вопросов, сменить игрока.
//
// Пункт «Играть» отключается, когда пакета контента нет: играть буквально не
// во что. Отключённая кнопка при этом ОБЪЯСНЯЕТ причину — молча неработающая
// кнопка на занятии хуже отсутствующей.

import React from 'react';
import { BigButton, Panel, palette } from '../ui';

interface Props {
  playerName: string;
  hasLibrary: boolean;
  libraryNote: string | null;
  questionCount: number;
  onPlay: () => void;
  onAlphabet: () => void;
  onQuestionCount: () => void;
  onChangePlayer: () => void;
  onStatistics: () => void;
  onSettings: () => void;
  onMyContent: () => void;
}

const MenuScreen: React.FC<Props> = ({
  playerName,
  hasLibrary,
  libraryNote,
  questionCount,
  onPlay,
  onAlphabet,
  onQuestionCount,
  onChangePlayer,
  onStatistics,
  onSettings,
  onMyContent,
}) => (
  <Panel testId="menu">
    <h2 style={{ margin: 0, fontSize: 30 }}>Занимается {playerName}</h2>

    {!hasLibrary && libraryNote && (
      <div
        data-testid="menu-library-note"
        style={{
          background: 'rgba(0,0,0,0.25)',
          borderRadius: 12,
          padding: '12px 18px',
          fontSize: 20,
          color: palette.textDim,
        }}
      >
        {libraryNote}
      </div>
    )}

    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
      <BigButton onClick={onPlay} wide disabled={!hasLibrary} testId="menu-play">
        Играть
      </BigButton>
      <BigButton onClick={onAlphabet} tone="secondary" disabled={!hasLibrary} testId="menu-alphabet">
        Алфавит
      </BigButton>
      <BigButton onClick={onQuestionCount} tone="secondary" testId="menu-count">
        Вопросов в игре: {questionCount}
      </BigButton>
      <BigButton onClick={onChangePlayer} tone="secondary" testId="menu-change-player">
        Сменить игрока
      </BigButton>
      {/* Два пункта ниже закрыты паролем — рубеж ставит рантайм, не экран */}
      <BigButton onClick={onStatistics} tone="secondary" testId="menu-statistics">
        🔒 Статистика
      </BigButton>
      <BigButton onClick={onSettings} tone="secondary" testId="menu-settings">
        🔒 Настройки
      </BigButton>
      <BigButton onClick={onMyContent} tone="secondary" testId="menu-my-content">
        🔒 Свои слова
      </BigButton>
    </div>
  </Panel>
);

export default MenuScreen;
