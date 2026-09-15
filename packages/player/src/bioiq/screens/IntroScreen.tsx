// packages/player/src/bioiq/screens/IntroScreen.tsx
import React from 'react';
import type { BioiqQuiz } from '../model/schema.ts';

interface Props {
  quiz: BioiqQuiz;
  onPlay: () => void;
  onTeacherMode: () => void;
  onShowThematicGallery: () => void;
  storageWarning?: string | null;
}

const IntroScreen: React.FC<Props> = ({ quiz, onPlay, onTeacherMode, onShowThematicGallery, storageWarning }) => (
  <div className="ciq-page">
    <div className="ciq-page-narrow" style={{ position: 'relative', textAlign: 'center' }}>
      <button onClick={onTeacherMode} className="ciq-btn ciq-btn-ghost ciq-btn-small" style={{ position: 'absolute', top: 0, right: 0 }}>
        Режим учителя
      </button>
      <button onClick={onShowThematicGallery} className="ciq-btn ciq-btn-ghost ciq-btn-small" style={{ position: 'absolute', top: 0, left: 0 }}>
        Справочные материалы
      </button>
      <p className="ciq-heading" style={{ fontSize: 13, letterSpacing: '0.2em', color: 'var(--ciq-blue)', marginBottom: 4 }}>
        БиоIQ
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
      {storageWarning && (
        <p data-testid="bioiq-storage-warning" style={{ marginTop: 24, fontSize: 13, color: 'var(--ciq-text-muted)' }}>
          {storageWarning}
        </p>
      )}
    </div>
  </div>
);

export default IntroScreen;
