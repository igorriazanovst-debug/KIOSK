// packages/player/src/alphabet/screens/AlphabetScreen.tsx
// Алфавит целым списком — первая половина требования ТЗ строки 70
// («алфавит списком и побуквенно»). Вторая половина — LetterScreen.
//
// Это НЕ игра, а справочник: ребёнок и педагог смотрят буквы и слова к ним.
// Поэтому здесь нет ни счёта, ни ошибок — нажатие на букву открывает её
// страницу.
//
// Буква без слов показывается серой и не нажимается. Пустая страница буквы
// хуже, чем видимое «сюда пока нечего смотреть»: первое выглядит поломкой,
// второе — состоянием контента.

import React from 'react';
import type { AlphabetLibrary } from '../types';
import { BigButton, Panel, ScrollArea, palette } from '../ui';
import { LetterTile } from '../components/GamePieces';

interface Props {
  library: AlphabetLibrary;
  onOpenLetter: (letterNumber: number) => void;
  onBack: () => void;
}

const AlphabetScreen: React.FC<Props> = ({ library, onOpenLetter, onBack }) => (
  <Panel testId="alphabet-screen">
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <BigButton onClick={onBack} tone="secondary" testId="alphabet-screen-back">
        ← Назад
      </BigButton>
      <h2 style={{ margin: 0, fontSize: 30 }}>Алфавит</h2>
    </div>

    <ScrollArea testId="alphabet-letters">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, paddingRight: 8 }}>
        {library.letters.map((letter) => {
          const empty = letter.wordIds.length === 0;
          return (
            <div
              key={letter.number}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
            >
              <LetterTile
                letter={letter.name}
                size={84}
                disabled={empty}
                onClick={() => onOpenLetter(letter.number)}
                testId={`alphabet-letter-${letter.number}`}
              />
              <span style={{ fontSize: 15, color: empty ? palette.textDim : palette.text }}>
                {empty ? 'нет слов' : `${letter.wordIds.length}`}
              </span>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  </Panel>
);

export default AlphabetScreen;
