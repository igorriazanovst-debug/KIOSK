// packages/player/src/words/screens/ScoreScreen.tsx
// Итоги партии (ТЗ строка 52 в части «что видит пользователь»).
//
// Порядок строк — порядок хода, а не по убыванию результата: экран итогов
// здесь обратная связь каждому ребёнку, а не турнирная таблица. Ступень
// показывается заработанная за партию; в хранилище она попадает только если
// выше уже имеющейся (понизить достижение нельзя).

import React from 'react';
import { BigButton, palette, TIER_LABEL } from '../ui';
import Character from '../components/Character';
import type { GameSession, AwardTier, WordsLibrary } from '@kiosk/shared';
import { summarizeSession, awardForPlayer } from '@kiosk/shared';
import type { Profile } from '../types';

interface Props {
  session: GameSession;
  library: WordsLibrary | null;
  players: Profile[];
  /** Что реально записалось в хранилище: игрок → ступень или null */
  savedAwards: Record<string, AwardTier | null>;
  onAgain: () => void;
  onMenu: () => void;
}

const ScoreScreen: React.FC<Props> = ({ session, library, players, savedAwards, onAgain, onMenu }) => {
  const rows = summarizeSession(session);
  const themeTitle = library?.themes.find((t) => t.id === session.themeId)?.title ?? session.themeId;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        padding: 36,
        boxSizing: 'border-box',
        color: palette.text,
      }}
    >
      <h1 style={{ margin: 0, fontSize: 44 }}>Тема пройдена: {themeTitle}</h1>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 32 }}>
        <Character kind="girl" mood="speaking" size={120} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 560 }}>
          {rows.map((row) => {
            const player = players.find((p) => p.id === row.playerId);
            const earned = awardForPlayer(session, row.playerId);
            const saved = savedAwards[row.playerId];
            const badge = earned ? TIER_LABEL[earned] : null;
            return (
              <div
                key={row.playerId}
                data-testid={`score-${player?.name ?? row.playerId}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  background: palette.panel,
                  borderRadius: 12,
                  padding: '14px 22px',
                }}
              >
                <span style={{ fontSize: 28 }}>{player?.name ?? 'Гость'}</span>
                <span style={{ fontSize: 22, color: palette.textMuted }}>
                  без ошибок: {row.flawless} из {row.completed} · ошибок: {row.errors}
                </span>
                {badge && (
                  <span data-testid={`tier-${player?.name}`} style={{ fontSize: 24, color: badge.color }}>
                    ★ {badge.text}
                    {saved === null && (
                      <span style={{ fontSize: 16, color: palette.textMuted }}> · рекорд не побит</span>
                    )}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <Character kind="boy" mood="idle" size={120} />
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <BigButton onClick={onAgain} wide testId="again">
          Ещё раз
        </BigButton>
        <BigButton onClick={onMenu} tone="secondary" testId="to-menu">
          В меню
        </BigButton>
      </div>
    </div>
  );
};

export default ScoreScreen;
