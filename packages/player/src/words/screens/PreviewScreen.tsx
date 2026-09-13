// packages/player/src/words/screens/PreviewScreen.tsx
// Вводная сцена темы. Закрывает СРАЗУ ДВА требования ТЗ — строку 49
// («просмотр тематической заставки») и строку 60 («вводную часть для каждой
// темы»): у эталона это тоже один и тот же экран, и разбор это подтвердил.
//
// ВВОДНАЯ ЧАСТЬ БЕРЁТСЯ ИЗ ТЕМЫ. До 14.09.2026 сова произносила одинаковую для
// всех тем фразу «Сейчас будем искать слова темы X» — это закрывало ТЗ строку
// 60 лишь по форме: общий текст вводной частью ТЕМЫ не является. Теперь у
// каждой темы свой текст в пакете контента, и он же звучит в озвучке заставки.
//
// Шаблон оставлен как запасной: пакет, собранный до появления поля intro,
// обязан открываться, а не показывать пустоту.

import React from 'react';
import { BigButton, palette } from '../ui';
import OwlHelper from '../components/OwlHelper';
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

      {/* Обложка ДОЛЖНА сжиматься. Раньше у неё была только ширина 560, а
          высота бралась из пропорций картинки — квадратная обложка давала 560
          и по высоте, и вместе с заголовком, совой и кнопками экран перерастал
          сцену: заголовок срезался сверху, кнопки снизу. Теперь картинка —
          гибкий элемент колонки и ужимается первой, а текст и кнопки остаются
          на месте при любом размере окна. */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center' }}>
        <img
          src={themeCoverUrl(themeId)}
          alt=""
          style={{ maxWidth: 560, maxHeight: '100%', objectFit: 'contain', borderRadius: 16 }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20 }}>
        <OwlHelper
          mood="speaking"
          size={140}
          hint={theme?.intro ?? `Сейчас будем искать слова темы «${theme?.title ?? ''}». Слушай внимательно.`}
          bubbleSide="left"
          testId="owl-preview"
        />
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
