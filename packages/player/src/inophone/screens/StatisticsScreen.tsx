// packages/player/src/inophone/screens/StatisticsScreen.tsx
// Результаты ученика (ТЗ строка 93).
//
// СВОДКА ПО ЯЗЫКАМ — ГЛАВНАЯ, и стоит она первой. Смысл пособия в языках:
// педагогу нужно видеть, что по-английски ребёнок уверен, а по-немецки
// путается. Сводка только по сценам этого не показывает — она говорит, где
// ребёнок занимался, а не что у него получается.
//
// «Последняя партия» и «всего» РАЗДЕЛЕНЫ. Одно накопленное число прячет и
// прогресс, и провал: сорок верных из пятидесяти выглядят одинаково хорошо,
// был ли последний раз удачным или нет.
//
// ПУСТАЯ ДОЛЯ — ПРОЧЕРК, А НЕ НОЛЬ. Ноль читается как «отвечал и всё неверно».

import React from 'react';
import { inophone } from '@kiosk/shared';
import type { InophoneLibrary, InophoneStatistics, LanguageCode } from '../types';
import { BigButton, Panel, ScreenHeader, palette } from '../ui';

interface Props {
  statistics: InophoneStatistics;
  profileId: string | null;
  profileName: string;
  library: InophoneLibrary | null;
  interfaceLanguage: LanguageCode;
  onClear: () => void;
  onBack: () => void;
}

const share = (stat: inophone.SceneStat | undefined, which: 'lastSession' | 'total') => {
  const v = inophone.successShare(stat, which);
  return v === null ? '—' : `${Math.round(v * 100)}%`;
};

const Row: React.FC<{ label: string; stat: inophone.SceneStat; testId: string }> = ({
  label,
  stat,
  testId,
}) => (
  <div
    data-testid={testId}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '10px 0',
      borderTop: `1px solid ${palette.panelEdge}`,
      fontSize: 20,
    }}
  >
    <span style={{ flex: 1, fontWeight: 600 }}>{label}</span>
    <span style={{ width: 210, color: palette.textDim }}>
      прошлый раз {stat.lastSession[0]} из {stat.lastSession[1]} ({share(stat, 'lastSession')})
    </span>
    <span style={{ width: 190, textAlign: 'right' }}>
      всего {stat.total[0]} из {stat.total[1]} ({share(stat, 'total')})
    </span>
  </div>
);

const StatisticsScreen: React.FC<Props> = ({
  statistics,
  profileId,
  profileName,
  library,
  interfaceLanguage,
  onClear,
  onBack,
}) => {
  const mine = profileId ? statistics[profileId] : undefined;
  const byLanguage = mine ? Object.entries(mine.byLanguage) : [];
  const byScene = mine ? Object.entries(mine.byScene) : [];

  const sceneTitle = (sceneId: string) => {
    const scene = library?.scenes.find((s) => s.id === sceneId);
    return scene ? inophone.localTitle(scene.titles, interfaceLanguage) : sceneId;
  };

  return (
    <div>
      <ScreenHeader title={`Результаты: ${profileName}`} onBack={onBack} />

      {byLanguage.length === 0 && byScene.length === 0 ? (
        <div style={{ fontSize: 20, color: palette.textDim }}>
          Партий ещё не было — как только ученик сыграет, результаты появятся здесь.
        </div>
      ) : (
        <>
          <Panel style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: palette.accent, marginBottom: 6 }}>
              По языкам
            </div>
            {byLanguage.map(([code, stat]) => (
              <Row
                key={code}
                testId={`inophone-stat-lang-${code}`}
                label={
                  inophone.isLanguageCode(code)
                    ? `${inophone.languageInfo(code).nativeName} — ${inophone.languageInfo(code).russianName}`
                    : code
                }
                stat={stat}
              />
            ))}
          </Panel>

          <Panel style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>По сценам</div>
            {byScene.map(([sceneId, stat]) => (
              <Row
                key={sceneId}
                testId={`inophone-stat-scene-${sceneId}`}
                label={sceneTitle(sceneId)}
                stat={stat}
              />
            ))}
          </Panel>

          <BigButton onClick={onClear} tone="danger" testId="inophone-clear-stats">
            Очистить результаты этого ученика
          </BigButton>
        </>
      )}
    </div>
  );
};

export default StatisticsScreen;
