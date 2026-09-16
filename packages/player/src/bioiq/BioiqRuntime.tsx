// packages/player/src/bioiq/BioiqRuntime.tsx
//
// Фаза 4 (редактор, план реализации Тип10_БиоIQ §5): полная машина
// состояний — интро → (учитель: PIN → каталог → редактор) / (игрок:
// настройка → поле → результаты). Прямая адаптация rusiq/RusiqRuntime.tsx
// (Тип 7). Встроенная методическая викторина — 120 вопросов по биологии
// (bioiqRealContent.json), по одной карте на каждый из трёх уровней.
// bioiqDemoContent.json — образец на 12 вопросов для тестов редактора,
// собирается тем же tools/bioiq/build-content.mjs из того же банка.
import React, { useEffect, useState } from 'react';
import './bioiqTheme.css';
import IntroScreen from './screens/IntroScreen.tsx';
import GameSetupScreen, { type GameSetupResult } from './screens/GameSetupScreen.tsx';
import GameBoardScreen from './screens/GameBoardScreen.tsx';
import ResultsScreen from './screens/ResultsScreen.tsx';
import TeacherGateScreen from './editor/TeacherGateScreen.tsx';
import QuizCatalogScreen from './editor/QuizCatalogScreen.tsx';
import EditorScreen from './editor/EditorScreen.tsx';
import DailyStatsScreen from './screens/DailyStatsScreen.tsx';
import ThematicGalleryScreen from './screens/ThematicGalleryScreen.tsx';
import { loadQuiz, saveQuiz, saveQuizLevelImage } from './editor/quizStore.ts';
import { BioiqQuizSchema, BIOIQ_USERDATA_SCHEMA_VERSION, type BioiqQuestion, type BioiqQuiz, type BioiqUserData } from './model/schema.ts';
import { assignQuestions, summarizeResults, type BioiqAnswerEvent } from './gameLogic.ts';
import { loadUserData, saveUserData } from './userDataStorage.ts';
import realContentJson from './content/bioiqRealContent.json' with { type: 'json' };

// Изображение-карта — плоская строка пути в public/, без import (см. урок
// §4 ретроспективы Тип7: import.meta ломает non-module сборку
// packages/player в собранном .exe). Путь строится динамически из
// quiz.images[level].fileName.
function levelImageUrl(fileName: string): string {
  return `./bioiq/${fileName}`;
}

const BUILTIN_QUIZ: BioiqQuiz = BioiqQuizSchema.parse(realContentJson);

interface Props {
  properties: { title?: string };
}

type Phase = 'loading' | 'intro' | 'setup' | 'board' | 'results' | 'teacherGate' | 'catalog' | 'editor' | 'dailyStats' | 'thematicGallery';

const INITIAL_USER_DATA: BioiqUserData = {
  schemaVersion: BIOIQ_USERDATA_SCHEMA_VERSION,
  sessions: [],
  soundOn: true,
  boardZoomed: false,
  activeQuizId: null,
  teacherPinHash: null,
};

export default function BioiqRuntime({ properties }: Props) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [activeQuiz, setActiveQuiz] = useState<BioiqQuiz>(BUILTIN_QUIZ);
  const [setup, setSetup] = useState<GameSetupResult | null>(null);
  const [questionsByPlayer, setQuestionsByPlayer] = useState<BioiqQuestion[][]>([]);
  const [finalAnswers, setFinalAnswers] = useState<BioiqAnswerEvent[]>([]);
  const [userData, setUserData] = useState<BioiqUserData>(INITIAL_USER_DATA);
  const [editingQuiz, setEditingQuiz] = useState<{ quiz: BioiqQuiz; pendingLevel1Image: { buffer: ArrayBuffer; mimeType: string } | null } | null>(null);
  // Сохранённые данные (история партий, PIN учителя) существовали на диске,
  // но не смогли загрузиться - НЕ первый запуск, а повреждённый файл (см.
  // BioiqStoreError в electron/bioiq/ipc.js). Показывается один раз на
  // интро-экране, чтобы педагог не принял пустую статистику за "ещё не
  // играли". Проверяется пунктом 7.1 программы испытаний
  // (docs/bioiq-test-plan.md).
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  useEffect(() => {
    loadUserData()
      .then(async ({ data: loaded, corrupted }) => {
        setUserData(loaded);
        if (corrupted) {
          setStorageWarning('Не удалось прочитать сохранённые данные БиоIQ (история партий, статистика) — файл повреждён. Начато с чистого состояния; сохранение новых партий работает как обычно.');
        }
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

  function handleGameFinished(answers: BioiqAnswerEvent[]) {
    setFinalAnswers(answers);
    setPhase('results');
    if (setup) {
      const summaries = summarizeResults(setup.playerNames, answers);
      const updated: BioiqUserData = {
        ...userData,
        sessions: [
          ...userData.sessions,
          { id: `session-${Date.now()}`, quizId: activeQuiz.id, playedAtIso: new Date().toISOString(), players: summaries },
        ],
      };
      setUserData(updated);
      saveUserData(updated);
    }
  }

  // Общий обработчик для настроек игрового поля, которые должны пережить
  // перезапуск и новую партию (звук, «Крупнее») - тот же принцип, что уже
  // применяется к teacherPinHash ниже: правка одного поля userData не
  // должна требовать отдельного обработчика на каждую настройку.
  function handleBoardPreferenceChange(patch: Partial<Pick<BioiqUserData, 'soundOn' | 'boardZoomed'>>) {
    const updated: BioiqUserData = { ...userData, ...patch };
    setUserData(updated);
    saveUserData(updated);
  }

  function handleRestart() {
    setPhase('intro');
    setSetup(null);
    setQuestionsByPlayer([]);
    setFinalAnswers([]);
  }

  async function handleTeacherUnlocked(newPinHash?: string) {
    if (newPinHash) {
      const updated: BioiqUserData = { ...userData, teacherPinHash: newPinHash };
      setUserData(updated);
      saveUserData(updated);
    }
    setPhase('catalog');
  }

  // Дублирует встроенную демо-викторину как отправную точку для
  // собственной — копирует ВСЕ изображения её уровней (не одно, как у
  // rusiq: там на всю викторину одна картинка), т.к. до сохранения
  // duplicated.images всё ещё ссылается на demo_grid.png из public/,
  // недоступный по bioiqmedia://.
  async function handleDuplicateBuiltin() {
    try {
      const newId = crypto.randomUUID();
      const patchedImages: typeof BUILTIN_QUIZ.images = {};
      for (const levelKey of Object.keys(BUILTIN_QUIZ.images)) {
        const meta = BUILTIN_QUIZ.images[levelKey];
        const response = await fetch(levelImageUrl(meta.fileName));
        if (!response.ok) throw new Error('fetch failed for level ' + levelKey);
        const buffer = await response.arrayBuffer();
        const saved = await saveQuizLevelImage(newId, Number(levelKey), buffer, 'image/png');
        if (!saved.ok || !saved.fileName) throw new Error('saveQuizLevelImage failed for level ' + levelKey);
        patchedImages[levelKey] = { ...meta, fileName: saved.fileName };
      }
      const duplicated: BioiqQuiz = {
        ...BUILTIN_QUIZ,
        id: newId,
        title: `${BUILTIN_QUIZ.title} (копия)`,
        passwordHash: null,
        images: patchedImages,
      };
      const ok = await saveQuiz(duplicated);
      if (!ok) throw new Error('saveQuiz failed');
    } catch {
      alert('Не удалось продублировать встроенную викторину — попробуйте ещё раз.');
    }
  }

  if (phase === 'loading') return <p style={{ textAlign: 'center', marginTop: 60, fontFamily: 'sans-serif' }}>Загрузка…</p>;

  if (phase === 'intro') {
    return (
      <IntroScreen
        quiz={activeQuiz}
        onPlay={() => setPhase('setup')}
        onTeacherMode={() => setPhase('teacherGate')}
        onShowThematicGallery={() => setPhase('thematicGallery')}
        storageWarning={storageWarning}
      />
    );
  }

  if (phase === 'thematicGallery') {
    return <ThematicGalleryScreen onExit={() => setPhase('intro')} />;
  }

  if (phase === 'teacherGate') {
    return <TeacherGateScreen teacherPinHash={userData.teacherPinHash} onUnlocked={handleTeacherUnlocked} onCancel={() => setPhase('intro')} />;
  }

  if (phase === 'setup') {
    return <GameSetupScreen quiz={activeQuiz} onComplete={handleSetupComplete} />;
  }

  if (phase === 'board' && setup) {
    const image = activeQuiz.images[String(setup.level)];
    const decoyPoints = activeQuiz.genericDecoyPoints.filter((p) => p.level === setup.level);
    const levelQuestions = activeQuiz.questions.filter((q) => q.level === setup.level);
    return (
      <GameBoardScreen
        imageUrl={levelImageUrl(image.fileName)}
        imageWidth={image.width}
        imageHeight={image.height}
        playerNames={setup.playerNames}
        questionsByPlayer={questionsByPlayer}
        levelQuestions={levelQuestions}
        genericDecoyPoints={decoyPoints}
        onFinished={handleGameFinished}
        soundOn={userData.soundOn}
        onSoundToggle={() => handleBoardPreferenceChange({ soundOn: !userData.soundOn })}
        initialZoomed={userData.boardZoomed}
        onZoomedChange={(zoomed) => handleBoardPreferenceChange({ boardZoomed: zoomed })}
      />
    );
  }

  if (phase === 'results' && setup) {
    return <ResultsScreen playerNames={setup.playerNames} answers={finalAnswers} questionsByPlayer={questionsByPlayer} onRestart={handleRestart} />;
  }

  if (phase === 'catalog') {
    return (
      <QuizCatalogScreen
        builtinQuizTitle={BUILTIN_QUIZ.title}
        activeQuizId={userData.activeQuizId}
        onSetActiveQuiz={async (quizId) => {
          const updated: BioiqUserData = { ...userData, activeQuizId: quizId };
          setUserData(updated);
          saveUserData(updated);
          if (quizId !== null) {
            const custom = await loadQuiz(quizId);
            setActiveQuiz(custom ?? BUILTIN_QUIZ);
          } else {
            setActiveQuiz(BUILTIN_QUIZ);
          }
        }}
        onEditQuiz={(quiz, pendingLevel1Image) => {
          setEditingQuiz({ quiz, pendingLevel1Image });
          setPhase('editor');
        }}
        onDuplicateBuiltin={handleDuplicateBuiltin}
        onShowDailyStats={() => setPhase('dailyStats')}
        onExit={() => setPhase('intro')}
      />
    );
  }

  if (phase === 'dailyStats') {
    return <DailyStatsScreen sessions={userData.sessions} onExit={() => setPhase('catalog')} />;
  }

  if (phase === 'editor' && editingQuiz) {
    return (
      <EditorScreen
        initialQuiz={editingQuiz.quiz}
        pendingLevel1Image={editingQuiz.pendingLevel1Image}
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

  // Недостижимо при корректном порядке фаз (phase==='editor' без
  // editingQuiz) — явный fallback вместо немого рендера.
  return (
    <IntroScreen
      quiz={activeQuiz}
      onPlay={() => setPhase('setup')}
      onTeacherMode={() => setPhase('teacherGate')}
      onShowThematicGallery={() => setPhase('thematicGallery')}
    />
  );
}
