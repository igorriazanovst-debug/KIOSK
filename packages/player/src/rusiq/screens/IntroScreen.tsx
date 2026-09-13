// packages/player/src/rusiq/screens/IntroScreen.tsx
import React from 'react';
import type { RusiqQuiz } from '../model/schema.ts';

interface Props {
  quiz: RusiqQuiz;
  onPlay: () => void;
  onTeacherMode: () => void;
}

const IntroScreen: React.FC<Props> = ({ quiz, onPlay, onTeacherMode }) => (
  <div className="riq-page">
    <div className="riq-page-narrow" style={{ position: 'relative', textAlign: 'center' }}>
      <button onClick={onTeacherMode} className="riq-btn riq-btn-ghost riq-btn-small" style={{ position: 'absolute', top: 0, right: 0 }}>
        Режим учителя
      </button>
      <p className="riq-heading" style={{ fontSize: 13, letterSpacing: '0.2em', color: 'var(--riq-blue)', marginBottom: 4 }}>
        РусIQ
      </p>
      <h1 className="riq-heading riq-heading-hero">{quiz.title}</h1>
      <div className="riq-divider" />
      {quiz.intro.length > 0 && <p style={{ color: 'var(--riq-text-muted)', lineHeight: 1.6 }}>{quiz.intro}</p>}
      {quiz.themes.length > 0 && (
        <ul style={{ textAlign: 'left', display: 'inline-block', color: 'var(--riq-text-muted)', lineHeight: 1.8, marginTop: 8 }}>
          {quiz.themes.map((theme) => (
            <li key={theme}>{theme}</li>
          ))}
        </ul>
      )}
      <div style={{ marginTop: 32 }}>
        <button onClick={onPlay} className="riq-btn riq-btn-lg">
          Играть!
        </button>
      </div>
    </div>
  </div>
);

export default IntroScreen;
