// packages/player/src/rusiq/screens/IntroScreen.tsx
import React from 'react';
import type { RusiqQuiz } from '../model/schema.ts';

interface Props {
  quiz: RusiqQuiz;
  onPlay: () => void;
}

const IntroScreen: React.FC<Props> = ({ quiz, onPlay }) => (
  <div style={{ maxWidth: 640, margin: '60px auto', textAlign: 'center', fontFamily: 'sans-serif' }}>
    <h1>{quiz.title}</h1>
    <p>{quiz.intro}</p>
    <ul style={{ textAlign: 'left', display: 'inline-block' }}>
      {quiz.themes.map((theme) => (
        <li key={theme}>{theme}</li>
      ))}
    </ul>
    <div>
      <button onClick={onPlay} style={{ fontSize: 20, padding: '12px 32px', marginTop: 24 }}>
        Играть!
      </button>
    </div>
  </div>
);

export default IntroScreen;
