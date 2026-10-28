// «Наблюдательность»: найти отличия, понять, что появилось, пропало, изменилось.
import React, { useMemo, useState } from 'react';
import Stars from './Stars.tsx';
import { ShapeGlyph } from '../components/SceneView.tsx';
import { runtimeRng } from '../rng.ts';
import { observationLevels, scenesForLevel, sceneStars, startScenePlay, tapScene, type ObservationData, type SceneShape, type ScenePlay } from '../observationLogic.ts';

interface Props {
  data: ObservationData;
  level: number;
  onExit: () => void;
}

function SceneSvg({ shapes, size, onTap, marks, label }: { shapes: SceneShape[]; size: number; onTap?: (p: { x: number; y: number }) => void; marks: { x: number; y: number }[]; label: string }) {
  return (
    <svg className="eumk-scene" viewBox={`-6 -6 ${size + 12} ${size + 12}`} role="img" aria-label={label}
      onClick={onTap ? (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        onTap({ x: ((e.clientX - rect.left) / rect.width) * (size + 12) - 6, y: ((e.clientY - rect.top) / rect.height) * (size + 12) - 6 });
      } : undefined} style={{ cursor: onTap ? 'crosshair' : 'default' }}>
      {shapes.map((s, i) => (
        <g key={i} transform={`translate(${s.x} ${s.y}) scale(${s.size / 34})`}><ShapeGlyph shape={s.shape} color={s.color} size={34} /></g>
      ))}
      {marks.map((m, i) => <circle key={i} cx={m.x} cy={m.y} r={9} fill="none" stroke="#1f8a4c" strokeWidth={1.6} />)}
    </svg>
  );
}

export default function ObservationGame({ data, level, onExit }: Props) {
  const [run, setRun] = useState(0);
  const scenes = useMemo(() => scenesForLevel(data, level, runtimeRng()), [data, level, run]);
  const [index, setIndex] = useState(0);
  const [play, setPlay] = useState<ScenePlay | null>(null);
  const [total, setTotal] = useState(0);
  const [missed, setMissed] = useState(false);

  const restart = () => { setRun(run + 1); setIndex(0); setPlay(null); setTotal(0); };
  const scene = scenes[index];
  const current = play && play.scene.id === scene?.id ? play : scene ? startScenePlay(scene) : null;

  if (!scene || !current) {
    return <div className="eumk-card"><p>Для этого уровня нет картинок.</p><button type="button" className="eumk-btn" onClick={onExit}>Назад</button></div>;
  }
  if (index >= scenes.length) {
    return (
      <div className="eumk-card">
        <h3 style={{ marginTop: 0 }}>Игра пройдена</h3>
        <p><Stars count={Math.round(total / scenes.length) as 0 | 1 | 2 | 3} /></p>
        <div className="eumk-row">
          <button type="button" className="eumk-btn primary" onClick={restart}>Сыграть ещё</button>
          <button type="button" className="eumk-btn" onClick={onExit}>К списку игр</button>
        </div>
      </div>
    );
  }

  const marks = current.found.map((i) => ({ x: scene.differences[i].x, y: scene.differences[i].y }));
  const tap = (point: { x: number; y: number }) => {
    const before = current.errors;
    const after = tapScene(current, point, data.tolerance);
    setMissed(after.errors > before);
    setPlay(after);
  };
  const size = scene.canvas.width;

  return (
    <div>
      <div className="eumk-row"><span>Картинка {index + 1} из {scenes.length}</span><span className="eumk-grow" /><span>Найдено {current.found.length} из {scene.differences.length}</span><span>Ошибок: {current.errors}</span></div>
      <h3>{scene.prompt}</h3>
      <div className="eumk-row" style={{ alignItems: 'flex-start' }}>
        <div className="eumk-grow" style={{ minWidth: 260 }}><SceneSvg shapes={scene.sceneA} size={size} marks={[]} label="Первая картинка" /><p className="eumk-muted">Первая картинка</p></div>
        <div className="eumk-grow" style={{ minWidth: 260 }}><SceneSvg shapes={scene.sceneB} size={size} onTap={current.finished ? undefined : tap} marks={marks} label="Вторая картинка: нажимай сюда" /><p className="eumk-muted">Вторая картинка: нажимай на отличия здесь</p></div>
      </div>
      {missed && !current.finished && <div className="eumk-note bad" role="status">Здесь отличия нет. Посмотри внимательнее.</div>}
      {current.found.length > 0 && <ul>{current.found.map((i) => <li key={i}>{scene.differences[i].text}</li>)}</ul>}
      {current.finished && (
        <div className="eumk-row">
          <button type="button" className="eumk-btn primary" onClick={() => { setTotal(total + sceneStars(current)); setPlay(null); setMissed(false); setIndex(index + 1); }}>
            {index === scenes.length - 1 ? 'Завершить' : 'Дальше'}
          </button>
        </div>
      )}
    </div>
  );
}

export { observationLevels };
