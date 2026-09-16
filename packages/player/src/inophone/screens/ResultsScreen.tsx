// packages/player/src/inophone/screens/ResultsScreen.tsx
// Итоги партии (ТЗ строка 89: «в конце статистика»).
//
// ПОБЕДИТЕЛЕЙ МОЖЕТ БЫТЬ НЕСКОЛЬКО. Ничья — обычный исход партии из пяти
// вопросов, и показать одного «победителя» из двух с равным счётом значит
// обмануть второго прямо у доски.
//
// ДОЛЯ ВЕРНЫХ БЕЗ ОТВЕТОВ НЕ ПОКАЗЫВАЕТСЯ ВОВСЕ. Ноль процентов читается как
// «отвечал и всё неверно» — ровно противоположно правде.

import React from 'react';
import { BigButton, Panel, ScreenHeader, palette } from '../ui';
import type { inophone } from '@kiosk/shared';

interface Props {
  sceneTitle: string;
  results: inophone.PlayerResult[];
  winners: string[];
  nameOf: (playerId: string) => string;
  /** Соревнование объявляет победителя, тренировка — нет: там не с кем мериться */
  showWinners: boolean;
  onAgain: () => void;
  onBack: () => void;
}

const ResultsScreen: React.FC<Props> = ({
  sceneTitle,
  results,
  winners,
  nameOf,
  showWinners,
  onAgain,
  onBack,
}) => (
  <div>
    <ScreenHeader title={`Итоги: ${sceneTitle}`} onBack={onBack} />

    {showWinners && winners.length > 0 && (
      <Panel style={{ marginBottom: 18, borderColor: palette.accent }}>
        <div data-testid="inophone-winners" style={{ fontSize: 28, fontWeight: 700, color: palette.accent }}>
          {winners.length === 1
            ? `Победил(а) ${nameOf(winners[0])}`
            : `Ничья: ${winners.map(nameOf).join(', ')}`}
        </div>
      </Panel>
    )}

    <Panel style={{ marginBottom: 18 }}>
      {results.map((r, i) => (
        <div
          key={r.playerId}
          data-testid={`inophone-result-${r.playerId}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            padding: '12px 0',
            // Разделитель ТОЛЬКО между строками: линия над первой висит в
            // воздухе и читается как обрезанная таблица
            borderTop: i === 0 ? 'none' : `1px solid ${palette.panelEdge}`,
            fontSize: 22,
          }}
        >
          <span style={{ flex: 1, fontWeight: 600 }}>{nameOf(r.playerId)}</span>
          <span style={{ color: palette.good }}>верно {r.success}</span>
          <span style={{ color: palette.danger }}>неверно {r.fail}</span>
          <span style={{ width: 90, textAlign: 'right', color: palette.textDim }}>
            {r.share === null ? '—' : `${Math.round(r.share * 100)}%`}
          </span>
        </div>
      ))}
    </Panel>

    <div style={{ display: 'flex', gap: 16 }}>
      <BigButton onClick={onAgain} testId="inophone-again">
        Ещё раз
      </BigButton>
      <BigButton onClick={onBack} tone="secondary" testId="inophone-results-back">
        К темам
      </BigButton>
    </div>
  </div>
);

export default ResultsScreen;
