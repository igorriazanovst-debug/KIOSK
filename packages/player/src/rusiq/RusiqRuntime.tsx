// packages/player/src/rusiq/RusiqRuntime.tsx
import React, { useEffect, useState } from 'react';
import IntroScreen from './screens/IntroScreen.tsx';
import GameSetupScreen, { type GameSetupResult } from './screens/GameSetupScreen.tsx';
import GameBoardScreen from './screens/GameBoardScreen.tsx';
import ResultsScreen from './screens/ResultsScreen.tsx';
import { RusiqQuizSchema, type RusiqQuestion, type RusiqUserData, RUSIQ_USERDATA_SCHEMA_VERSION } from './model/schema.ts';
import { assignQuestions, summarizeResults, type RusiqAnswerEvent } from './gameLogic.ts';
import { loadUserData, saveUserData } from './userDataStorage.ts';
import rusiqContentJson from './content/rusiqContent.json' with { type: 'json' };

// Изображение сцены НЕ импортируется как JS-модуль (ни плоским `import`, ни
// `new URL(..., import.meta.url)`, ни `?inline`) — оба варианта либо
// кодогенят синтаксически недопустимый в не-ESM-бандле `import.meta`
// (сборка packages/player намеренно отдаёт <script> без type="module" ради
// file:// в Electron), либо раздувают JS base64-инлайном лишние ~780KB.
// Тот же паттерн, что уже используется в этом кодбейзе для статических
// картинок — см. packages/player/src/mathmachine/Mascot.tsx: файл лежит в
// packages/player/public/rusiq/alphabet.png, Vite копирует public/* в
// dist/* БЕЗ бандлинга, картинка просто отдаётся плоским относительным
// путём — никакого импорта, никаких ambient-типов, ноль байт в JS-бандле.
const ALPHABET_IMAGE_URL = './rusiq/alphabet.png';

interface Props {
  properties: { title?: string };
}

type Phase = 'intro' | 'setup' | 'board' | 'results';

const quiz = RusiqQuizSchema.parse(rusiqContentJson);
const INITIAL_USER_DATA: RusiqUserData = { schemaVersion: RUSIQ_USERDATA_SCHEMA_VERSION, sessions: [], soundOn: true, activeQuizId: null, teacherPinHash: null };

const RusiqRuntime: React.FC<Props> = () => {
  const [phase, setPhase] = useState<Phase>('intro');
  const [setup, setSetup] = useState<GameSetupResult | null>(null);
  const [questionsByPlayer, setQuestionsByPlayer] = useState<RusiqQuestion[][]>([]);
  const [finalAnswers, setFinalAnswers] = useState<RusiqAnswerEvent[]>([]);
  const [userData, setUserData] = useState<RusiqUserData>(INITIAL_USER_DATA);

  useEffect(() => {
    loadUserData().then(setUserData);
  }, []);

  function handleSetupComplete(result: GameSetupResult) {
    const pool = quiz.questions.filter((q) => q.level === result.level);
    const assigned = assignQuestions(pool, result.playerNames.length, result.questionsPerPlayer);
    setSetup(result);
    setQuestionsByPlayer(assigned);
    setPhase('board');
  }

  function handleGameFinished(answers: RusiqAnswerEvent[]) {
    setFinalAnswers(answers);
    setPhase('results');
    if (setup) {
      const summaries = summarizeResults(setup.playerNames, answers);
      const updated: RusiqUserData = {
        ...userData,
        sessions: [
          ...userData.sessions,
          {
            id: `session-${Date.now()}`,
            quizId: quiz.id,
            playedAtIso: new Date().toISOString(),
            players: summaries,
          },
        ],
      };
      setUserData(updated);
      saveUserData(updated);
    }
  }

  function handleRestart() {
    setPhase('intro');
    setSetup(null);
    setQuestionsByPlayer([]);
    setFinalAnswers([]);
  }

  if (phase === 'intro') return <IntroScreen quiz={quiz} onPlay={() => setPhase('setup')} />;
  if (phase === 'setup') return <GameSetupScreen quiz={quiz} onComplete={handleSetupComplete} />;
  if (phase === 'board' && setup) {
    return (
      <GameBoardScreen
        imageUrl={ALPHABET_IMAGE_URL}
        imageWidth={quiz.image.width}
        imageHeight={quiz.image.height}
        playerNames={setup.playerNames}
        questionsByPlayer={questionsByPlayer}
        genericDecoyPoints={quiz.genericDecoyPoints}
        onFinished={handleGameFinished}
      />
    );
  }
  if (phase === 'results' && setup) {
    return (
      <ResultsScreen
        playerNames={setup.playerNames}
        answers={finalAnswers}
        questionsByPlayer={questionsByPlayer}
        onRestart={handleRestart}
      />
    );
  }
  return null;
};

export default RusiqRuntime;
