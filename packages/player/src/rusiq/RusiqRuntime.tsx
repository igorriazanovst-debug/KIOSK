// packages/player/src/rusiq/RusiqRuntime.tsx
import React, { useEffect, useState } from 'react';
import './rusiqTheme.css';
import IntroScreen from './screens/IntroScreen.tsx';
import GameSetupScreen, { type GameSetupResult } from './screens/GameSetupScreen.tsx';
import GameBoardScreen from './screens/GameBoardScreen.tsx';
import ResultsScreen from './screens/ResultsScreen.tsx';
import { RusiqQuizSchema, type RusiqQuestion, type RusiqQuiz, type RusiqUserData, RUSIQ_USERDATA_SCHEMA_VERSION } from './model/schema.ts';
import { assignQuestions, summarizeResults, type RusiqAnswerEvent } from './gameLogic.ts';
import { loadUserData, saveUserData } from './userDataStorage.ts';
import { loadQuiz, saveQuiz, saveQuizBackground } from './editor/quizStore.ts';
import TeacherGateScreen from './editor/TeacherGateScreen.tsx';
import QuizCatalogScreen from './editor/QuizCatalogScreen.tsx';
import EditorScreen from './editor/EditorScreen.tsx';
import { rusiqBackgroundMediaUrl } from './rusiqMediaUrl.ts';
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
    loadUserData()
      .then(async (loaded) => {
        setUserData(loaded);
        if (loaded.activeQuizId !== null) {
          const custom = await loadQuiz(loaded.activeQuizId);
          setActiveQuiz(custom ?? BUILTIN_QUIZ);
        } else {
          setActiveQuiz(BUILTIN_QUIZ);
        }
        setPhase('intro');
      })
      .catch(() => setPhase('intro'));
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

  async function handleDuplicateBuiltin() {
    // Встроенная викторина рендерится из бандлового ALPHABET_IMAGE_URL
    // (спецкейс по id ниже, в phase === 'board') - у дубликата новый id,
    // поэтому без явного копирования файла фона он падает на
    // `rusiqmedia:///alphabet.png`, которого не существует в папке
    // пользовательских викторин: дубликат (608 вопросов, 476 ложных точек)
    // рендерился бы на пустой серой заглушке и в редакторе, и в игре
    // (найдено ревью Задачи 11, Important) - копируем сам файл через уже
    // существующий IPC saveQuizBackground ДО сохранения самой викторины.
    // try/catch и явное сообщение об ошибке - находка финального ревью:
    // fetch/saveQuizBackground/saveQuiz могли молча ничего не делать при
    // сбое, без единого следа для учителя.
    try {
      const newId = crypto.randomUUID();
      const response = await fetch(ALPHABET_IMAGE_URL);
      if (!response.ok) throw new Error('fetch failed');
      const buffer = await response.arrayBuffer();
      const bgResult = await saveQuizBackground(newId, buffer, 'image/png');
      if (!bgResult.ok || !bgResult.fileName) throw new Error('saveQuizBackground failed');
      const duplicated: RusiqQuiz = {
        ...BUILTIN_QUIZ,
        id: newId,
        title: `${BUILTIN_QUIZ.title} (копия)`,
        passwordHash: null,
        image: { ...BUILTIN_QUIZ.image, fileName: bgResult.fileName },
      };
      const ok = await saveQuiz(duplicated);
      if (!ok) throw new Error('saveQuiz failed');
    } catch {
      alert('Не удалось продублировать встроенную викторину — попробуйте ещё раз.');
    }
  }

  if (phase === 'loading') return <p style={{ textAlign: 'center', marginTop: 60, fontFamily: 'sans-serif' }}>Загрузка…</p>;
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
        imageUrl={activeQuiz.id === BUILTIN_QUIZ.id ? ALPHABET_IMAGE_URL : rusiqBackgroundMediaUrl(activeQuiz.image.fileName)}
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
        onSetActiveQuiz={async (quizId) => {
          const updated: RusiqUserData = { ...userData, activeQuizId: quizId };
          setUserData(updated);
          saveUserData(updated);
          // Без этого "Играть эту" меняет только activeQuizId на диске/в
          // userData, а реально показываемая activeQuiz остаётся прежней
          // до перезапуска приложения (activeQuiz иначе выставляется только
          // в эффекте монтирования) - найдено живой проверкой Задачи 12.
          if (quizId !== null) {
            const custom = await loadQuiz(quizId);
            setActiveQuiz(custom ?? BUILTIN_QUIZ);
          } else {
            setActiveQuiz(BUILTIN_QUIZ);
          }
        }}
        onEditQuiz={(quiz, pendingBackground) => {
          setEditingQuiz({ quiz, pendingBackground });
          setPhase('editor');
        }}
        onDuplicateBuiltin={handleDuplicateBuiltin}
        onExit={() => setPhase('intro')}
      />
    );
  }
  if (phase === 'editor' && editingQuiz) {
    return (
      <EditorScreen
        initialQuiz={editingQuiz.quiz}
        pendingBackground={editingQuiz.pendingBackground}
        onExit={(savedQuiz) => {
          if (savedQuiz && userData.activeQuizId === savedQuiz.id) {
            setActiveQuiz(savedQuiz);
          }
          setEditingQuiz(null);
          setPhase('catalog');
        }}
      />
    );
  }
  if (phase === 'editor') {
    // editingQuiz null здесь недостижимо в норме (оба выставляются вместе
    // в onEditQuiz), но явный фолбэк лучше немого экрана, если когда-то
    // перестанет быть так - находка финального ревью.
    return null;
  }
  return null;
};

export default RusiqRuntime;
