// Игры: список по блокам теории (как задания в TasksScreen), правила,
// выбор уровня, сама игра.
import React, { useMemo, useState } from 'react';
import ErrorBoundary from '../components/ErrorBoundary.tsx';
import RoundGame from '../games/RoundGame.tsx';
import AttentionGame from '../games/AttentionGame.tsx';
import ObservationGame from '../games/ObservationGame.tsx';
import { gameLevels, ROUND_GAME_TYPES } from '../gameRounds.ts';
import { attentionLevels, type AttentionData } from '../attentionLogic.ts';
import { observationData, observationLevels } from '../observationLogic.ts';
import { groupGamesByBlock } from '../gameGroups.ts';
import type { EumkContent, EumkGame } from '../model/schema.ts';

interface LevelChoice {
  key: number;
  name: string;
}

function levelChoices(game: EumkGame): LevelChoice[] {
  if (game.type === 'attention') return attentionLevels(game.data as unknown as AttentionData).map((l) => ({ key: l.id, name: l.name }));
  if (game.type === 'observation') return observationLevels(observationData(game)).map((l) => ({ key: l, name: `Уровень ${l}` }));
  return gameLevels(game).map((l) => {
    const named = game.levels.find((c) => Number(c.level) === l);
    return { key: l, name: named?.name ? String(named.name) : `Уровень ${l}` };
  });
}

export default function GamesScreen({ content }: { content: EumkContent }) {
  const [gameId, setGameId] = useState<string | null>(null);
  const [level, setLevel] = useState<number | null>(null);
  const game = content.games.find((g) => g.id === gameId) ?? null;
  const observation = useMemo(() => (game && game.type === 'observation' ? observationData(game) : null), [game]);

  const back = () => { setLevel(null); };

  if (!game) {
    // Группировка по блокам теории (Д-1), как у заданий в TasksScreen:
    // непустые блоки в учебном порядке, игры без привязки - «Другое».
    const groups = groupGamesByBlock(content.theory, content.games);
    return (
      <div className="eumk-narrow">
        <h2>Игры</h2>
        {groups.map((g) => (
          <div key={g.key}>
            <h3>{g.title}</h3>
            <div className="eumk-tiles">
              {g.games.map((item) => (
                <button key={item.id} type="button" className="eumk-tile" onClick={() => { setGameId(item.id); setLevel(null); }}>
                  <b>{item.title}</b>
                  <span>{item.description}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const choices = levelChoices(game);
  if (level === null) {
    return (
      <div className="eumk-narrow">
        <button type="button" className="eumk-btn" onClick={() => setGameId(null)}>← Все игры</button>
        <h2 style={{ marginTop: 16 }}>{game.title}</h2>
        <p>{game.description}</p>
        {game.rules && <div className="eumk-note info"><b>Правила.</b> {game.rules}</div>}
        <h3>Выбери уровень</h3>
        <div className="eumk-tiles">
          {choices.map((c) => (
            <button key={c.key} type="button" className="eumk-tile" style={{ minHeight: 80 }} onClick={() => setLevel(c.key)}><b>{c.name}</b></button>
          ))}
        </div>
      </div>
    );
  }

  let play: React.ReactNode = null;
  if (game.type === 'attention') {
    const data = game.data as unknown as AttentionData;
    const chosen = attentionLevels(data).find((l) => l.id === level);
    if (chosen) play = <AttentionGame key={`${game.id}-${level}`} data={data} level={chosen} onExit={back} />;
  } else if (game.type === 'observation') {
    play = <ObservationGame key={`${game.id}-${level}`} data={observation!} level={level} onExit={back} />;
  } else if (ROUND_GAME_TYPES.includes(game.type)) {
    play = <RoundGame key={`${game.id}-${level}`} game={game} level={level} onExit={back} />;
  }
  return (
    <div className="eumk-narrow">
      <button type="button" className="eumk-btn" onClick={back}>← {game.title}: уровни</button>
      <div style={{ marginTop: 16 }}><ErrorBoundary key={`${game.id}-${level}`} label="Игра не запустилась." onReset={back}>{play}</ErrorBoundary></div>
    </div>
  );
}
