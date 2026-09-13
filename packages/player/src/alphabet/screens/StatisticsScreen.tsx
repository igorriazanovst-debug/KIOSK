// packages/player/src/alphabet/screens/StatisticsScreen.tsx
// Статистика по буквам — ТЗ строка 72 (FR-009).
//
// Две пары показателей на букву: последняя сессия и накопленный итог. Так у
// эталона, и это правильнее, чем одна ступень достижения на тему в Тип 2:
// педагогу нужно и то и другое — итог показывает прогресс за месяцы, сессия
// показывает сегодняшнее занятие.
//
// БУКВА БЕЗ ОТВЕТОВ ПОКАЗЫВАЕТСЯ ПУСТОЙ, А НЕ НУЛЁМ. Нулевой столбик читается
// как «отвечал и всё неверно» — ровно противоположно правде «ещё не
// отвечал», и педагог по такому графику примет неверное решение о том, что
// повторять. Домен возвращает для таких букв null, здесь это прочерк.
//
// Показываются ВСЕ 33 буквы, включая нетронутые: пробел в занятиях виден
// только тогда, когда видно и то, чего не было.

import React from 'react';
import { alphabet } from '@kiosk/shared';
import type { AlphabetLibrary, Statistics } from '../types';
import { BigButton, Panel, ScrollArea, palette } from '../ui';

interface Props {
  library: AlphabetLibrary;
  statistics: Statistics;
  profileId: string;
  profileName: string;
  onClear: () => void;
  onBack: () => void;
}

const BAR_HEIGHT = 92;

const StatisticsScreen: React.FC<Props> = ({
  library,
  statistics,
  profileId,
  profileName,
  onClear,
  onBack,
}) => {
  const rows = alphabet.letterChartRows(
    statistics,
    profileId,
    library.letters.map((l) => l.number)
  );
  const answered = rows.filter((r) => r.totalAnswers > 0).length;

  const bar = (share: number | null, color: string, testId: string) => (
    <div
      data-testid={testId}
      data-share={share === null ? 'нет' : share.toFixed(2)}
      style={{
        width: 16,
        height: BAR_HEIGHT,
        background: 'rgba(0,0,0,0.22)',
        borderRadius: 4,
        display: 'flex',
        alignItems: 'flex-end',
        overflow: 'hidden',
      }}
    >
      {share !== null && (
        <div style={{ width: '100%', height: `${Math.round(share * 100)}%`, background: color }} />
      )}
    </div>
  );

  return (
    <Panel testId="statistics">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <BigButton onClick={onBack} tone="secondary" testId="stats-back">
          ← Назад
        </BigButton>
        <h2 style={{ margin: 0, fontSize: 28 }}>Статистика: {profileName}</h2>
        <span data-testid="stats-answered" style={{ fontSize: 19, color: palette.textDim }}>
          букв в работе: {answered} из {rows.length}
        </span>
        <BigButton onClick={onClear} tone="danger" testId="stats-clear">
          Очистить
        </BigButton>
      </div>

      <div style={{ display: 'flex', gap: 20, fontSize: 18 }}>
        <span>
          <span style={{ display: 'inline-block', width: 14, height: 14, background: palette.accent, borderRadius: 3, marginRight: 6 }} />
          последняя игра
        </span>
        <span>
          <span style={{ display: 'inline-block', width: 14, height: 14, background: '#8ed0a0', borderRadius: 3, marginRight: 6 }} />
          за всё время
        </span>
      </div>

      <ScrollArea testId="stats-chart">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingRight: 8 }}>
          {rows.map((row) => {
            const letter = library.letters.find((l) => l.number === row.letterNumber);
            return (
              <div
                key={row.letterNumber}
                data-testid={`stats-letter-${row.letterNumber}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  background: 'rgba(255,255,255,0.10)',
                  borderRadius: 10,
                  padding: '8px 6px',
                  minWidth: 58,
                }}
              >
                <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end' }}>
                  {bar(row.lastSession, palette.accent, `stats-last-${row.letterNumber}`)}
                  {bar(row.total, '#8ed0a0', `stats-total-${row.letterNumber}`)}
                </div>
                <span style={{ fontSize: 22, fontWeight: 800 }}>{letter?.name ?? '?'}</span>
                <span style={{ fontSize: 14, color: palette.textDim }}>
                  {row.totalAnswers === 0 ? '—' : `${row.totalAnswers}`}
                </span>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </Panel>
  );
};

export default StatisticsScreen;
