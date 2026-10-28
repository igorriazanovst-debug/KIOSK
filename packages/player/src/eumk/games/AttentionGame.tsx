// «Концентрация внимания»: найти знаки или слова среди похожих, таблица Шульте.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Stars from './Stars.tsx';
import { runtimeRng } from '../rng.ts';
import { buildAttentionBoard, effectiveSeconds, startPlay, starsFor, tapCell, type AttentionData, type AttentionLevel } from '../attentionLogic.ts';

interface Props {
  data: AttentionData;
  level: AttentionLevel;
  onExit: () => void;
}

export default function AttentionGame({ data, level, onExit }: Props) {
  const [run, setRun] = useState(0);
  const board = useMemo(() => buildAttentionBoard(level, data, runtimeRng()), [level, data, run]);
  const [play, setPlay] = useState(() => startPlay(board, level));
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(Date.now());
  const timedOut = elapsed >= level.timeLimitSec;
  const over = play.finished || timedOut;

  useEffect(() => {
    setPlay(startPlay(board, level));
    setElapsed(0);
    startedAt.current = Date.now();
  }, [board, level]);

  useEffect(() => {
    if (over) return;
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 250);
    return () => window.clearInterval(timer);
  }, [over, board]);

  const goal = level.mode === 'schulte' ? board.cells.length : level.targetCount;
  const next = (level.numbersFrom ?? 1) + play.found.length;

  if (over) {
    const stars = starsFor({ errors: play.errors, seconds: elapsed, finished: play.finished }, level, data);
    return (
      <div className="eumk-card">
        <h3 style={{ marginTop: 0 }}>{play.finished ? 'Готово!' : 'Время вышло'}</h3>
        <p><Stars count={stars} /></p>
        <p>Найдено: {play.found.length} из {goal}. Ошибок: {play.errors}. Время: {elapsed} с (с учётом штрафа {effectiveSeconds(elapsed, play.errors, level)} с).</p>
        <div className="eumk-row">
          <button type="button" className="eumk-btn primary" onClick={() => setRun(run + 1)}>Ещё раз</button>
          <button type="button" className="eumk-btn" onClick={onExit}>К списку игр</button>
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="eumk-row" style={{ marginBottom: 12 }}>
        <b style={{ fontSize: 24 }}>{level.mode === 'schulte' ? `Нажми число ${next}` : `Найди: ${board.target}`}</b>
        <span className="eumk-grow" />
        <span>Найдено {play.found.length} из {goal}</span>
        <span>Ошибок: {play.errors}</span>
        <span>Время: {Math.max(0, level.timeLimitSec - elapsed)} с</span>
      </div>
      <div className="eumk-grid" style={{ gridTemplateColumns: `repeat(${level.grid.cols}, minmax(0, 1fr))`, maxWidth: level.grid.cols * 110 }}>
        {board.cells.map((cell) => (
          <button key={cell.id} type="button" className={`eumk-cell${play.found.includes(cell.id) ? ' found' : ''}${play.wrong.includes(cell.id) ? ' miss' : ''}`}
            style={level.mode === 'find_word' ? { fontSize: 18 } : undefined} onClick={() => setPlay(tapCell(play, cell.id))}>
            {play.found.includes(cell.id) ? '✓ ' : play.wrong.includes(cell.id) ? '✗ ' : ''}{cell.text}
          </button>
        ))}
      </div>
    </div>
  );
}
