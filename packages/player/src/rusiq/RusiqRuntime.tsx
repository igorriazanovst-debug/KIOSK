// packages/player/src/rusiq/RusiqRuntime.tsx
import React, { useEffect, useState } from 'react';
import IntroScreen from './screens/IntroScreen.tsx';
import GameSetupScreen, { type GameSetupResult } from './screens/GameSetupScreen.tsx';
import GameBoardScreen from './screens/GameBoardScreen.tsx';
import ResultsScreen from './screens/ResultsScreen.tsx';
import { RusiqQuizSchema, type RusiqQuestion, type RusiqQuiz, type RusiqUserData, RUSIQ_USERDATA_SCHEMA_VERSION } from './model/schema.ts';
import { assignQuestions, summarizeResults, type RusiqAnswerEvent } from './gameLogic.ts';
import { loadUserData, saveUserData } from './userDataStorage.ts';
import { loadQuiz } from './editor/quizStore.ts';
import TeacherGateScreen from './editor/TeacherGateScreen.tsx';
import QuizCatalogScreen from './editor/QuizCatalogScreen.tsx';
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

type Phase = 'loading' | 'intro' | 'setup' | 'board' | 'results' | 'teacherGate' | 'catalog' | 'editor';

// Встроенная методическая викторина "Обучение грамоте" - фолбэк, когда
// activeQuizId === null или пользовательская викторина не грузится
// (удалена/битый файл). Больше не модульная константа "quiz" - см. спеку
// Фазы 2a, разд. 1.1: реальная активная викторина определяется динамически.
const BUILTIN_QUIZ: RusiqQuiz = RusiqQuizSchema.parse(rusiqContentJson);

const INITIAL_USER_DATA: RusiqUserData = {
  schemaVersion: RUSIQ_USERDATA_SCHEMA_VERSION,
  sessions: [],
  soundOn: true,
  activeQuizId: null,
  teacherPinHash: null,
};

const RusiqRuntime: React.FC<Props> = () => {
  const [phase, setPhase] = useState<Phase>('loading');
  const [activeQuiz, setActiveQuiz] = useState<RusiqQuiz>(BUILTIN_QUIZ);
  const [setup, setSetup] = useState<GameSetupResult | null>(null);
  const [questionsByPlayer, setQuestionsByPlayer] = useState<RusiqQuestion[][]>([]);
  const [finalAnswers, setFinalAnswers] = useState<RusiqAnswerEvent[]>([]);
  const [userData, setUserData] = useState<RusiqUserData>(INITIAL_USER_DATA);
  const [editingQuiz, setEditingQuiz] = useState<{ quiz: RusiqQuiz; pendingBackground: { buffer: ArrayBuffer; mimeType: string } | null } | null>(null);

  useEffect(() => {
    loadUserData().then(async (loaded) => {
      setUserData(loaded);
      if (loaded.activeQuizId !== null) {
        const custom = await loadQuiz(loaded.activeQuizId);
        setActiveQuiz(custom ?? BUILTIN_QUIZ);
      } else {
        setActiveQuiz(BUILTIN_QUIZ);
      }
      setPhase('intro');
    });
  }, []);

  function handleSetupComplete(result: GameSetupResult) {
    const pool = activeQuiz.questions.filter((q) => q.level === result.level);
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
            quizId: activeQuiz.id,
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

  async function handleTeacherUnlocked(newPinHash?: string) {
    if (newPinHash) {
      const updated: RusiqUserData = { ...userData, teacherPinHash: newPinHash };
      setUserData(updated);
      saveUserData(updated);
    }
    setPhase('catalog');
  }

  if (phase === 'loading') return null;
  if (phase === 'intro') {
    return <IntroScreen quiz={activeQuiz} onPlay={() => setPhase('setup')} onTeacherMode={() => setPhase('teacherGate')} />;
  }
  if (phase === 'teacherGate') {
    return (
      <TeacherGateScreen
        teacherPinHash={userData.teacherPinHash}
        onUnlocked={handleTeacherUnlocked}
        onCancel={() => setPhase('intro')}
      />
    );
  }
  if (phase === 'setup') return <GameSetupScreen quiz={activeQuiz} onComplete={handleSetupComplete} />;
  if (phase === 'board' && setup) {
    return (
      <GameBoardScreen
        imageUrl={activeQuiz.id === BUILTIN_QUIZ.id ? ALPHABET_IMAGE_URL : `rusiqmedia:///${activeQuiz.image.fileName}`}
        imageWidth={activeQuiz.image.width}
        imageHeight={activeQuiz.image.height}
        playerNames={setup.playerNames}
        questionsByPlayer={questionsByPlayer}
        genericDecoyPoints={activeQuiz.genericDecoyPoints}
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
  if (phase === 'catalog') {
    return (
      <QuizCatalogScreen
        builtinQuizTitle={BUILTIN_QUIZ.title}
        activeQuizId={userData.activeQuizId}
        onSetActiveQuiz={(quizId) => {
          const updated: RusiqUserData = { ...userData, activeQuizId: quizId };
          setUserData(updated);
          saveUserData(updated);
        }}
        onEditQuiz={(quiz, pendingBackground) => {
          setEditingQuiz({ quiz, pendingBackground });
          setPhase('editor');
        }}
        onExit={() => setPhase('intro')}
      />
    );
  }
  if (phase === 'editor') return null; // экран добавит Задача 11
  return null;
};

export default RusiqRuntime;
