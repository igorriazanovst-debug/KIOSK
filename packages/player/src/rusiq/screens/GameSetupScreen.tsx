// packages/player/src/rusiq/screens/GameSetupScreen.tsx
import React, { useState } from 'react';
import type { RusiqQuiz, RusiqLevelId } from '../model/schema.ts';

export interface GameSetupResult {
  playerNames: string[];
  level: RusiqLevelId;
  questionsPerPlayer: number;
}

interface Props {
  quiz: RusiqQuiz;
  onComplete: (result: GameSetupResult) => void;
}

type Step = 'count' | 'names' | 'level' | 'questionCount';

const QUESTION_COUNT_OPTIONS = [5, 10, 15];

const GameSetupScreen: React.FC<Props> = ({ quiz, onComplete }) => {
  const [step, setStep] = useState<Step>('count');
  const [playerCount, setPlayerCount] = useState(1);
  const [names, setNames] = useState<string[]>(['']);
  const [level, setLevel] = useState<RusiqLevelId>(1);

  function handlePlayerCount(count: number) {
    setPlayerCount(count);
    setNames(Array.from({ length: count }, (_, i) => `Игрок ${i + 1}`));
    setStep('names');
  }

  function handleNamesConfirmed() {
    setStep('level');
  }

  function handleLevelChosen(chosenLevel: RusiqLevelId) {
    setLevel(chosenLevel);
    setStep('questionCount');
  }

  function handleQuestionCountChosen(count: number) {
    onComplete({ playerNames: names, level, questionsPerPlayer: count });
  }

  if (step === 'count') {
    return (
      <div style={{ textAlign: 'center', marginTop: 60, fontFamily: 'sans-serif' }}>
        <h2>Сколько игроков?</h2>
        {[1, 2, 3].map((count) => (
          <button key={count} onClick={() => handlePlayerCount(count)} style={{ margin: 8, fontSize: 18, padding: '10px 24px' }}>
            {count}
          </button>
        ))}
      </div>
    );
  }

  if (step === 'names') {
    return (
      <div style={{ maxWidth: 400, margin: '60px auto', fontFamily: 'sans-serif' }}>
        <h2>Имена игроков</h2>
        {names.map((name, i) => (
          <input
            key={i}
            value={name}
            onChange={(e) => setNames((prev) => prev.map((n, j) => (j === i ? e.target.value : n)))}
            style={{ display: 'block', width: '100%', fontSize: 16, padding: 8, marginBottom: 8 }}
          />
        ))}
        <button onClick={handleNamesConfirmed} style={{ fontSize: 16, padding: '8px 20px' }}>Далее</button>
      </div>
    );
  }

  if (step === 'level') {
    return (
      <div style={{ textAlign: 'center', marginTop: 60, fontFamily: 'sans-serif' }}>
        <h2>Уровень сложности</h2>
        {quiz.levels.map((lvl) => (
          <button key={lvl.id} onClick={() => handleLevelChosen(lvl.id)} style={{ margin: 8, fontSize: 18, padding: '10px 24px' }}>
            {lvl.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center', marginTop: 60, fontFamily: 'sans-serif' }}>
      <h2>Сколько вопросов на игрока?</h2>
      {QUESTION_COUNT_OPTIONS.map((count) => (
        <button key={count} onClick={() => handleQuestionCountChosen(count)} style={{ margin: 8, fontSize: 18, padding: '10px 24px' }}>
          {count}
        </button>
      ))}
    </div>
  );
};

export default GameSetupScreen;
