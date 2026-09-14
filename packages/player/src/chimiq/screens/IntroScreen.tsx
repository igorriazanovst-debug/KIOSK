// packages/player/src/chimiq/screens/IntroScreen.tsx
import React from 'react';
import type { ChimiqQuiz } from '../model/schema.ts';

interface Props {
  quiz: ChimiqQuiz;
  onPlay: () => void;
  onTeacherMode: () => void;
}

const IntroScreen: React.FC<Props> = ({ quiz, onPlay, onTeacherMode }) => (
  <div className="ciq-page">
    <div className="ciq-page-narrow" style={{ position: 'relative', textAlign: 'center' }}>
      <button onClick={onTeacherMode} className="ciq-btn ciq-btn-ghost ciq-btn-small" style={{ position: 'absolute', top: 0, right: 0 }}>
        Режим учителя
      </button>
      <p className="ciq-heading" style={{ fontSize: 13, letterSpacing: '0.2em', color: 'var(--ciq-blue)', marginBottom: 4 }}>
        ХимIQ
      </p>
      <h1 className="ciq-heading ciq-heading-hero">{quiz.title}</h1>
      <div className="ciq-divider" />
      {quiz.intro.length > 0 && <p style={{ color: 'var(--ciq-text-muted)', lineHeight: 1.6 }}>{quiz.intro}</p>}
      {quiz.themes.length > 0 && (
        <ul style={{ textAlign: 'left', display: 'inline-block', color: 'var(--ciq-text-muted)', lineHeight: 1.8, marginTop: 8 }}>
          {quiz.themes.map((theme) => (
            <li key={theme}>{theme}</li>
          ))}
        </ul>
      )}
      <div style={{ marginTop: 32 }}>
        <button onClick={onPlay} className="ciq-btn ciq-btn-lg">
          Играть!
        </button>
      </div>
    </div>
  </div>
);

export default IntroScreen;
