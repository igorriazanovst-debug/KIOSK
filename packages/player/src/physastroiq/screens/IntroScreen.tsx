// packages/player/src/physastroiq/screens/IntroScreen.tsx
import React from 'react';
import type { PhysastroiqQuiz } from '../model/schema.ts';

interface Props {
  quiz: PhysastroiqQuiz;
  /**
   * Встроенные викторины — по одной на предмет (FR-004, строка 325: «Предмет —
   * физика, астрономия»).
   */
  subjects: { id: string; title: string }[];
  onSelectSubject: (quizId: string) => void;
  onPlay: () => void;
  onTeacherMode: () => void;
  onShowThematicGallery: () => void;
  storageWarning?: string | null;
}

const IntroScreen: React.FC<Props> = ({ quiz, subjects, onSelectSubject, onPlay, onTeacherMode, onShowThematicGallery, storageWarning }) => (
  <div className="ciq-page">
    <div className="ciq-page-narrow" style={{ position: 'relative', textAlign: 'center' }}>
      <button onClick={onTeacherMode} className="ciq-btn ciq-btn-ghost ciq-btn-small" style={{ position: 'absolute', top: 0, right: 0 }}>
        Режим учителя
      </button>
      <button onClick={onShowThematicGallery} className="ciq-btn ciq-btn-ghost ciq-btn-small" style={{ position: 'absolute', top: 0, left: 0 }}>
        Справочные материалы
      </button>
      <p className="ciq-heading" style={{ fontSize: 13, letterSpacing: '0.2em', color: 'var(--ciq-blue)', marginBottom: 4 }}>
        ФизАстроIQ
      </p>
      <h1 className="ciq-heading ciq-heading-hero">{quiz.title}</h1>
      <div className="ciq-divider" />
      {/*
        Переключатель предмета показывается, только пока играют во встроенную
        викторину. Если педагог назначил активной свою собственную, кнопки
        предметов исчезают: иначе первое же нажатие сбросило бы его выбор, и
        понять, куда делась своя викторина, было бы не по чему.
      */}
      {subjects.some((s) => s.id === quiz.id) && subjects.length > 1 && (
        <div data-testid="physastroiq-subject-switch" style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 18 }}>
          {subjects.map((subject) => (
            <button
              key={subject.id}
              onClick={() => onSelectSubject(subject.id)}
              className={`ciq-btn ciq-btn-small ${subject.id === quiz.id ? '' : 'ciq-btn-muted'}`}
              aria-pressed={subject.id === quiz.id}
            >
              {subject.title}
            </button>
          ))}
        </div>
      )}
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
        <p data-testid="physastroiq-storage-warning" style={{ marginTop: 24, fontSize: 13, color: 'var(--ciq-text-muted)' }}>
          {storageWarning}
        </p>
      )}
    </div>
  </div>
);

export default IntroScreen;
