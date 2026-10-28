// Игры, построенные на раундах-заданиях (логика, слоги, костюмы, режим дня,
// речь, экология, математика): раунды идут один за другим, в конце звёзды.
import React, { useMemo, useState } from 'react';
import TaskView from '../components/TaskView.tsx';
import Stars, { starsForShare } from './Stars.tsx';
import { runtimeRng } from '../rng.ts';
import { buildGameRounds } from '../gameRounds.ts';
import type { EumkGame } from '../model/schema.ts';

interface Props {
  game: EumkGame;
  level: number;
  onExit: () => void;
}

export default function RoundGame({ game, level, onExit }: Props) {
  const [run, setRun] = useState(0);
  const rounds = useMemo(() => buildGameRounds(game, level, runtimeRng()), [game, level, run]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);

  const again = () => { setRun(run + 1); setIndex(0); setScore(0); };

  if (rounds.length === 0) {
    return <div className="eumk-card"><p>Для этого уровня нет заданий.</p><button type="button" className="eumk-btn" onClick={onExit}>Назад</button></div>;
  }
  if (index >= rounds.length) {
    const share = score / rounds.length;
    return (
      <div className="eumk-card">
        <h3 style={{ marginTop: 0 }}>Игра пройдена</h3>
        <p><Stars count={starsForShare(share)} /></p>
        <p>Верно: {score} из {rounds.length}</p>
        <div className="eumk-row">
          <button type="button" className="eumk-btn primary" onClick={again}>Сыграть ещё</button>
          <button type="button" className="eumk-btn" onClick={onExit}>К списку игр</button>
        </div>
      </div>
    );
  }
  const round = rounds[index];
  return (
    <div>
      <div className="eumk-row"><span>Раунд {index + 1} из {rounds.length}</span><span className="eumk-grow" /><span>Верно: {score}</span></div>
      <div className="eumk-progress" aria-hidden="true"><div style={{ width: `${(index / rounds.length) * 100}%` }} /></div>
      <TaskView key={`${run}-${round.id}`} task={round.task} seed={`${run}`} hint={round.hint} scene={round.scene}
        nextLabel={index === rounds.length - 1 ? 'Завершить' : 'Дальше'}
        onNext={(check) => { setScore(score + (check.isCorrect ? 1 : 0)); setIndex(index + 1); }} />
    </div>
  );
}
