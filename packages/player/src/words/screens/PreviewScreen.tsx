// packages/player/src/words/screens/PreviewScreen.tsx
// Вводная сцена темы. Закрывает СРАЗУ ДВА требования ТЗ — строку 49
// («просмотр тематической заставки») и строку 60 («вводную часть для каждой
// темы»): у эталона это тоже один и тот же экран, и разбор это подтвердил.
//
// ЗАГЛУШКА: у эталона на каждую тему нарисована собственная SVG-композиция с
// персонажами и предметами (15 отдельных компонентов — самая трудоёмкая часть
// художественной работы). Здесь — обложка темы, персонажи и предметы темы
// вперемешку. Заменяется вместе с приходом настоящего контента.

import React from 'react';
import { BigButton, palette } from '../ui';
import Character from '../components/Character';
import { themeCoverUrl, wordImageUrl } from '../mediaUrl';
import type { WordsLibrary } from '@kiosk/shared';

interface Props {
  library: WordsLibrary | null;
  themeId: string;
  onBack: () => void;
  onStart: () => void;
}

const PreviewScreen: React.FC<Props> = ({ library, themeId, onBack, onStart }) => {
  const theme = library?.themes.find((t) => t.id === themeId);
  const preview = (theme?.wordIds ?? []).slice(0, 5);

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
      <h1 data-testid="preview-title" style={{ margin: 0, fontSize: 48 }}>
        {theme?.title ?? 'Тема'}
      </h1>

      <img
        src={themeCoverUrl(themeId)}
        alt=""
        style={{ width: 560, borderRadius: 16 }}
      />

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20 }}>
        <Character kind="girl" mood="speaking" size={130} />
        <div style={{ display: 'flex', gap: 14 }}>
          {preview.map((wordId) => (
            <img
              key={wordId}
              src={wordImageUrl(wordId)}
              alt=""
              style={{ width: 96, height: 96, borderRadius: 12, background: palette.panel }}
            />
          ))}
        </div>
        <Character kind="boy" mood="idle" size={130} />
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <BigButton onClick={onBack} tone="secondary" testId="preview-back">
          ← К темам
        </BigButton>
        <BigButton onClick={onStart} wide testId="preview-start">
          Начать игру
        </BigButton>
      </div>
    </div>
  );
};

export default PreviewScreen;
