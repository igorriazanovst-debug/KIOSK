// packages/player/src/words/screens/MapScreen.tsx
// Карта тем (ТЗ строка 48: выбор тем «как в заданном порядке, так и по
// желанию пользователя»). Порядок прохождения не навязывается: блокировок
// тем нет, любая открывается в любой момент — как у эталона.
//
// На обложке показывается заработанная ступень, если игрок выбран: ребёнок
// видит, где у него уже золото, и куда стоит вернуться.

import React from 'react';
import { ErrorBanner, ScreenFrame, ScrollArea, palette, TIER_LABEL } from '../ui';
import { themeCoverUrl } from '../mediaUrl';
import type { WordsLibrary, AwardTier, UserSet } from '@kiosk/shared';

interface Props {
  library: WordsLibrary | null;
  /** Свои комплекты педагога — играются наравне с поставочными темами */
  sets: UserSet[];
  error: string | null;
  /** Достижения первого выбранного игрока: тема → ступень */
  awards: Record<string, AwardTier>;
  onBack: () => void;
  onPick: (themeId: string) => void;
}

const MapScreen: React.FC<Props> = ({ library, sets, error, awards, onBack, onPick }) => (
  <ScreenFrame title="Выберите тему" onBack={onBack}>
    <ErrorBanner text={error} />

    {library && library.themes.length === 0 && (
      <div style={{ fontSize: 24, color: palette.textMuted }}>
        В этой сборке нет ни одной темы: пакет учебного контента не подключён.
      </div>
    )}

    <ScrollArea style={{ flex: 1 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 20,
        }}
      >
        {(library?.themes ?? []).map((theme) => {
          const tier = awards[theme.id];
          const badge = tier ? TIER_LABEL[tier] : null;
          return (
            <button
              key={theme.id}
              data-testid={`theme-${theme.id}`}
              onClick={() => onPick(theme.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                padding: 12,
                borderRadius: 16,
                border: 'none',
                background: palette.panel,
                color: palette.text,
                cursor: 'pointer',
                fontFamily: 'inherit',
                textAlign: 'left',
              }}
            >
              <img
                src={themeCoverUrl(theme.id)}
                alt=""
                style={{ width: '100%', borderRadius: 10, aspectRatio: '512 / 320', objectFit: 'cover' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 26 }}>{theme.title}</span>
                {badge && (
                  <span
                    data-testid={`award-${theme.id}`}
                    style={{ fontSize: 20, color: badge.color }}
                  >
                    ★ {badge.text}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 18, color: palette.textMuted }}>
                слов: {theme.wordIds.length}
              </span>
            </button>
          );
        })}

        {/* Свои комплекты — ТЗ строка 57: объединение слов в темы */}
        {sets.map((set) => {
          const tier = awards[set.id];
          const badge = tier ? TIER_LABEL[tier] : null;
          return (
            <button
              key={set.id}
              data-testid={`set-${set.id}`}
              onClick={() => onPick(set.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                padding: 12,
                borderRadius: 16,
                border: `2px solid ${palette.accent}`,
                background: palette.panel,
                color: palette.text,
                cursor: 'pointer',
                fontFamily: 'inherit',
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  width: '100%',
                  aspectRatio: '512 / 320',
                  borderRadius: 10,
                  background: palette.panelLight,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 48,
                }}
              >
                ✎
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 26 }}>{set.title}</span>
                {badge && <span style={{ fontSize: 20, color: badge.color }}>★ {badge.text}</span>}
              </div>
              <span style={{ fontSize: 18, color: palette.textMuted }}>
                мой комплект · слов: {set.wordIds.length}
              </span>
            </button>
          );
        })}
      </div>
    </ScrollArea>
  </ScreenFrame>
);

export default MapScreen;
