// packages/player/src/physastroiq/screens/GameSetupScreen.tsx
import React, { useState } from 'react';
import type { PhysastroiqQuiz, PhysastroiqLevelId } from '../model/schema.ts';

export interface GameSetupResult {
  playerNames: string[];
  level: PhysastroiqLevelId;
  questionsPerPlayer: number;
}

interface Props {
  quiz: PhysastroiqQuiz;
  onComplete: (result: GameSetupResult) => void;
}

type Step = 'count' | 'names' | 'level' | 'questionCount';

const QUESTION_COUNT_OPTIONS = [5, 10, 15];

const GameSetupScreen: React.FC<Props> = ({ quiz, onComplete }) => {
  const [step, setStep] = useState<Step>('count');
  const [playerCount, setPlayerCount] = useState(1);
  const [names, setNames] = useState<string[]>(['']);
  const [level, setLevel] = useState<PhysastroiqLevelId>(1);

  function handlePlayerCount(count: number) {
    setPlayerCount(count);
    setNames(Array.from({ length: count }, (_, i) => `Игрок ${i + 1}`));
    setStep('names');
  }

  function handleNamesConfirmed() {
    setStep('level');
  }

  function handleLevelChosen(chosenLevel: PhysastroiqLevelId) {
    setLevel(chosenLevel);
    setStep('questionCount');
  }

  function handleQuestionCountChosen(count: number) {
    onComplete({ playerNames: names, level, questionsPerPlayer: count });
  }

  if (step === 'count') {
    return (
      <div className="ciq-page">
        <div className="ciq-page-narrow" style={{ textAlign: 'center' }}>
          <h2 className="ciq-heading ciq-heading-section">Сколько игроков?</h2>
          <div className="ciq-divider" />
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
            {[1, 2, 3].map((count) => (
              <button key={count} onClick={() => handlePlayerCount(count)} className="ciq-btn ciq-btn-lg ciq-btn-tile">
                {count}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (step === 'names') {
    // Тот же класс риска, что нашли на РусIQ (Тип7): пустое/пробельное имя,
    // дошедшее до сохранения, ломает PhysastroiqPlayerResultSchema.name (min(1))
    // при следующей загрузке. Не пускаем пустое имя дальше этого экрана.
    const hasEmptyName = names.some((name) => name.trim().length === 0);

    return (
      <div className="ciq-page">
        <div className="ciq-page-narrow">
          <h2 className="ciq-heading ciq-heading-section" style={{ textAlign: 'center' }}>
            Имена игроков
          </h2>
          <div className="ciq-divider" />
          {names.map((name, i) => (
            <input
              key={i}
              value={name}
              onChange={(e) => setNames((prev) => prev.map((n, j) => (j === i ? e.target.value : n)))}
              className="ciq-input"
              style={{ marginBottom: 10, fontSize: 16 }}
            />
          ))}
          {hasEmptyName && <p className="ciq-error">Введите имя для каждого игрока — пустых имён быть не может.</p>}
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button onClick={handleNamesConfirmed} disabled={hasEmptyName} className="ciq-btn">
              Далее
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'level') {
    return (
      <div className="ciq-page">
        <div className="ciq-page-narrow" style={{ textAlign: 'center' }}>
          <h2 className="ciq-heading ciq-heading-section">Уровень сложности</h2>
          <div className="ciq-divider" />
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
            {quiz.levels.map((lvl) => (
              <button key={lvl.id} onClick={() => handleLevelChosen(lvl.id)} className="ciq-btn ciq-btn-lg">
                {lvl.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Тот же граничный случай, что у РусIQ: пул вопросов пользовательской
  // викторины может быть меньше, чем фиксированные варианты 5/10/15 —
  // без фильтрации нажатие на непомещающийся вариант "зависает" без
  // объяснения (assignQuestions() бросает исключение вне обработчика клика).
  const pool = quiz.questions.filter((q) => q.level === level);
  const maxAffordable = Math.floor(pool.length / playerCount);
  const availableOptions = QUESTION_COUNT_OPTIONS.filter((count) => count <= maxAffordable);
  const options = availableOptions.length > 0 ? availableOptions : maxAffordable > 0 ? [maxAffordable] : [];

  return (
    <div className="ciq-page">
      <div className="ciq-page-narrow" style={{ textAlign: 'center' }}>
        <h2 className="ciq-heading ciq-heading-section">Сколько вопросов на игрока?</h2>
        <div className="ciq-divider" />
        {options.length === 0 ? (
          <p className="ciq-error">
            В викторине недостаточно вопросов уровня «{quiz.levels.find((lvl) => lvl.id === level)?.label ?? level}» для {playerCount} игрок(ов).
          </p>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
            {options.map((count) => (
              <button key={count} onClick={() => handleQuestionCountChosen(count)} className="ciq-btn ciq-btn-lg ciq-btn-tile">
                {count}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GameSetupScreen;
