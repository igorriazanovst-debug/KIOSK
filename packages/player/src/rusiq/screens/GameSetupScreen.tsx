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
      <div className="riq-page">
        <div className="riq-page-narrow" style={{ textAlign: 'center' }}>
          <h2 className="riq-heading riq-heading-section">Сколько игроков?</h2>
          <div className="riq-divider" />
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
            {[1, 2, 3].map((count) => (
              <button key={count} onClick={() => handlePlayerCount(count)} className="riq-btn riq-btn-lg riq-btn-tile">
                {count}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (step === 'names') {
    // Находка 5 финального ревью: пустое/пробельное имя, дошедшее до
    // сохранения, ломает RusiqPlayerResultSchema.name (min(1)) при
    // следующей загрузке и молча стирает ВСЮ историю игр (safeParse
    // схемы падает целиком, не по одной записи). Правильное место фикса —
    // источник, не приёмник: не пускать пустое имя дальше этого экрана.
    const hasEmptyName = names.some((name) => name.trim().length === 0);

    return (
      <div className="riq-page">
        <div className="riq-page-narrow">
          <h2 className="riq-heading riq-heading-section" style={{ textAlign: 'center' }}>
            Имена игроков
          </h2>
          <div className="riq-divider" />
          {names.map((name, i) => (
            <input
              key={i}
              value={name}
              onChange={(e) => setNames((prev) => prev.map((n, j) => (j === i ? e.target.value : n)))}
              className="riq-input"
              style={{ marginBottom: 10, fontSize: 16 }}
            />
          ))}
          {hasEmptyName && <p className="riq-error">Введите имя для каждого игрока — пустых имён быть не может.</p>}
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button onClick={handleNamesConfirmed} disabled={hasEmptyName} className="riq-btn">
              Далее
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'level') {
    return (
      <div className="riq-page">
        <div className="riq-page-narrow" style={{ textAlign: 'center' }}>
          <h2 className="riq-heading riq-heading-section">Уровень сложности</h2>
          <div className="riq-divider" />
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
            {quiz.levels.map((lvl) => (
              <button key={lvl.id} onClick={() => handleLevelChosen(lvl.id)} className="riq-btn riq-btn-lg">
                {lvl.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Пул вопросов пользовательской викторины Фазы 2a может быть намного
  // меньше, чем у встроенной "Обучение грамоте" (сотни на уровень) - для
  // неё фиксированные 5/10/15 всегда помещались, поэтому граничный случай
  // никогда не проявлялся. assignQuestions() бросает исключение, если
  // pool.length < playerCount * questionsPerPlayer - без этой фильтрации
  // нажатие на непомещающийся вариант молча не делает ничего (исключение
  // из обработчика клика не рушит React-дерево, экран просто "зависает"
  // на этом шаге без объяснения) - найдено живой проверкой Задачи 12.
  const pool = quiz.questions.filter((q) => q.level === level);
  const maxAffordable = Math.floor(pool.length / playerCount);
  const availableOptions = QUESTION_COUNT_OPTIONS.filter((count) => count <= maxAffordable);
  const options = availableOptions.length > 0 ? availableOptions : maxAffordable > 0 ? [maxAffordable] : [];

  return (
    <div className="riq-page">
      <div className="riq-page-narrow" style={{ textAlign: 'center' }}>
        <h2 className="riq-heading riq-heading-section">Сколько вопросов на игрока?</h2>
        <div className="riq-divider" />
        {options.length === 0 ? (
          <p className="riq-error">
            В викторине недостаточно вопросов уровня «{quiz.levels.find((lvl) => lvl.id === level)?.label ?? level}» для {playerCount} игрок(ов).
          </p>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
            {options.map((count) => (
              <button key={count} onClick={() => handleQuestionCountChosen(count)} className="riq-btn riq-btn-lg riq-btn-tile">
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
