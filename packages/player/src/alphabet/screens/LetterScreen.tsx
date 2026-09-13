// packages/player/src/alphabet/screens/LetterScreen.tsx
// Страница одной буквы — вторая половина требования ТЗ строки 70
// («алфавит списком и побуквенно») и место, где видно требование строки 71:
// иллюстраций на букву должно быть не меньше двух.
//
// Иллюстрации ПЕРЕЛИСТЫВАЮТСЯ по одной, а не лежат сеткой. Так у эталона, и
// это разумно: ребёнку показывают одно крупное изображение и произносят
// слово, а не предлагают выбрать из витрины — выбирать он будет в игре.
//
// Слово подписано ВСЕГДА, даже когда озвучки нет. Подпись — не дубликат
// звука: по ней педагог понимает, что именно нарисовано, когда рисунок
// неоднозначен, а ребёнок постарше начинает узнавать написание.

import React, { useState } from 'react';
import type { AlphabetLibrary } from '../types';
import { BigButton, Panel, palette } from '../ui';
import { WordPicture } from '../components/GamePieces';
import { wordImageUrl } from '../mediaUrl';

interface Props {
  library: AlphabetLibrary;
  letterNumber: number;
  hasAudio: boolean;
  onSpeakLetter: () => void;
  onSpeakWord: (wordId: string) => void;
  onBack: () => void;
}

const LetterScreen: React.FC<Props> = ({
  library,
  letterNumber,
  hasAudio,
  onSpeakLetter,
  onSpeakWord,
  onBack,
}) => {
  const [index, setIndex] = useState(0);
  const letter = library.letters.find((l) => l.number === letterNumber);
  const wordIds = letter?.wordIds ?? [];
  // Индекс держим в границах сам: список слов буквы может измениться под
  // нами, когда педагог удалит своё слово (Фаза 5)
  const safeIndex = wordIds.length === 0 ? 0 : Math.min(index, wordIds.length - 1);
  const wordId = wordIds[safeIndex];
  const word = library.words.find((w) => w.id === wordId);

  const step = (delta: number) => {
    if (wordIds.length === 0) return;
    setIndex((current) => (current + delta + wordIds.length) % wordIds.length);
  };

  return (
    <Panel testId="letter-screen">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <BigButton onClick={onBack} tone="secondary" testId="letter-back">
          ← Алфавит
        </BigButton>
        <h2 data-testid="letter-name" style={{ margin: 0, fontSize: 44, color: palette.accent }}>
          {letter?.name ?? '?'}
        </h2>
        <BigButton
          onClick={onSpeakLetter}
          tone="secondary"
          disabled={!hasAudio}
          testId="letter-speak"
        >
          {hasAudio ? '🔊 Буква' : '🔇 Озвучка ещё не записана'}
        </BigButton>
        <span data-testid="letter-count" style={{ fontSize: 20, color: palette.textDim }}>
          {wordIds.length === 0
            ? 'у этой буквы пока нет слов'
            : `${safeIndex + 1} из ${wordIds.length}`}
        </span>
      </div>

      {wordId && (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 24,
          }}
        >
          <BigButton onClick={() => step(-1)} tone="secondary" testId="letter-prev">
            ‹
          </BigButton>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <WordPicture
              src={wordImageUrl(wordId)}
              alt={word?.name ?? ''}
              size={260}
              testId="letter-picture"
            />
            <div data-testid="letter-word" style={{ fontSize: 36, fontWeight: 800 }}>
              {word?.name ?? wordId}
            </div>
            <BigButton
              onClick={() => onSpeakWord(wordId)}
              disabled={!hasAudio}
              testId="letter-speak-word"
            >
              {hasAudio ? '🔊 Слово' : '🔇 Озвучка ещё не записана'}
            </BigButton>
          </div>
          <BigButton onClick={() => step(1)} tone="secondary" testId="letter-next">
            ›
          </BigButton>
        </div>
      )}
    </Panel>
  );
};

export default LetterScreen;
