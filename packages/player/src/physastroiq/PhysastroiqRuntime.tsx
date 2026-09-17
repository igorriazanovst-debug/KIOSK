// packages/player/src/physastroiq/PhysastroiqRuntime.tsx
//
// Полная машина состояний — интро → (учитель: PIN → каталог → редактор) /
// (игрок: настройка → поле → результаты). Прямая адаптация
// rusiq/RusiqRuntime.tsx (Тип 7).
//
// ВСТРОЕННЫХ ВИКТОРИН ДВЕ, ПО ЧИСЛУ ПРЕДМЕТОВ (FR-004, строка 325: «Предмет —
// физика, астрономия»; FR-021, строка 342: методические материалы в виде
// готовой игры-викторины). У каждой свои три карты и свои 90 вопросов.
//
// ПОЧЕМУ ПРЕДМЕТ ВЫБИРАЕТСЯ НА ИНТРО-ЭКРАНЕ, А НЕ В РЕЖИМЕ УЧИТЕЛЯ. Выбор
// между физикой и астрономией — это выбор урока, его делают каждый раз, а не
// настраивают однажды под PIN-кодом. Но если педагог назначил активной свою
// собственную викторину, переключатель прячется: его выбор не должен
// сбрасываться первым же нажатием.
//
// physastroiqDemoContent.json — образец на 12 вопросов для тестов редактора,
// собирается тем же tools/physastroiq/build-content.mjs из тех же банков.
import React, { useEffect, useState } from 'react';
import './physastroiqTheme.css';
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
import { PhysastroiqQuizSchema, PHYSASTROIQ_USERDATA_SCHEMA_VERSION, type PhysastroiqQuestion, type PhysastroiqQuiz, type PhysastroiqUserData } from './model/schema.ts';
import { assignQuestions, summarizeResults, type PhysastroiqAnswerEvent } from './gameLogic.ts';
import { loadUserData, saveUserData } from './userDataStorage.ts';
import physicsContentJson from './content/physastroiqPhysicsContent.json' with { type: 'json' };
import astroContentJson from './content/physastroiqAstroContent.json' with { type: 'json' };

// Изображение-карта — плоская строка пути в public/, без import (см. урок
// §4 ретроспективы Тип7: import.meta ломает non-module сборку
// packages/player в собранном .exe). Путь строится динамически из
// quiz.images[level].fileName.
function levelImageUrl(fileName: string): string {
  return `./physastroiq/${fileName}`;
}

const BUILTIN_QUIZZES: PhysastroiqQuiz[] = [
  PhysastroiqQuizSchema.parse(physicsContentJson),
  PhysastroiqQuizSchema.parse(astroContentJson),
];

/**
 * Викторина, которая открывается, пока ничего не выбрано.
 *
 * Она же — запасной вариант, если сохранённый activeQuizId указывает в
 * никуда: собственную викторину педагог мог удалить, а запись о ней осталась.
 * Показать в этом случае пустой экран было бы хуже, чем показать физику.
 */
const DEFAULT_BUILTIN = BUILTIN_QUIZZES[0];

function findBuiltin(quizId: string | null): PhysastroiqQuiz | undefined {
  return BUILTIN_QUIZZES.find((q) => q.id === quizId);
}

interface Props {
  properties: { title?: string };
}

type Phase = 'loading' | 'intro' | 'setup' | 'board' | 'results' | 'teacherGate' | 'catalog' | 'editor' | 'dailyStats' | 'thematicGallery';

const INITIAL_USER_DATA: PhysastroiqUserData = {
  schemaVersion: PHYSASTROIQ_USERDATA_SCHEMA_VERSION,
  sessions: [],
  soundOn: true,
  boardZoomed: false,
  activeQuizId: null,
  teacherPinHash: null,
};

export default function PhysastroiqRuntime({ properties }: Props) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [activeQuiz, setActiveQuiz] = useState<PhysastroiqQuiz>(DEFAULT_BUILTIN);
  const [setup, setSetup] = useState<GameSetupResult | null>(null);
  const [questionsByPlayer, setQuestionsByPlayer] = useState<PhysastroiqQuestion[][]>([]);
  const [finalAnswers, setFinalAnswers] = useState<PhysastroiqAnswerEvent[]>([]);
  const [userData, setUserData] = useState<PhysastroiqUserData>(INITIAL_USER_DATA);
  const [editingQuiz, setEditingQuiz] = useState<{ quiz: PhysastroiqQuiz; pendingLevel1Image: { buffer: ArrayBuffer; mimeType: string } | null } | null>(null);
  // Сохранённые данные (история партий, PIN учителя) существовали на диске,
  // но не смогли загрузиться - НЕ первый запуск, а повреждённый файл (см.
  // PhysastroiqStoreError в electron/physastroiq/ipc.js). Показывается один раз на
  // интро-экране, чтобы педагог не принял пустую статистику за "ещё не
  // играли". Проверяется пунктом 7.1 программы испытаний
  // (docs/physastroiq-test-plan.md).
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  useEffect(() => {
    loadUserData()
      .then(async ({ data: loaded, corrupted }) => {
        setUserData(loaded);
        if (corrupted) {
          setStorageWarning('Не удалось прочитать сохранённые данные ФизАстроIQ (история партий, статистика) — файл повреждён. Начато с чистого состояния; сохранение новых партий работает как обычно.');
        }
        // Порядок важен: идентификатор встроенной викторины в хранилище
        // пользовательских не найдётся, и без этой проверки выбор предмета
        // молча сбрасывался бы на физику при каждом запуске.
        const builtin = findBuiltin(loaded.activeQuizId);
        if (builtin) {
          setActiveQuiz(builtin);
        } else if (loaded.activeQuizId !== null) {
          const custom = await loadQuiz(loaded.activeQuizId);
          setActiveQuiz(custom ?? DEFAULT_BUILTIN);
        } else {
          setActiveQuiz(DEFAULT_BUILTIN);
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

  function handleGameFinished(answers: PhysastroiqAnswerEvent[]) {
    setFinalAnswers(answers);
    setPhase('results');
    if (setup) {
      const summaries = summarizeResults(setup.playerNames, answers);
      const updated: PhysastroiqUserData = {
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
  function handleBoardPreferenceChange(patch: Partial<Pick<PhysastroiqUserData, 'soundOn' | 'boardZoomed'>>) {
    const updated: PhysastroiqUserData = { ...userData, ...patch };
    setUserData(updated);
    saveUserData(updated);
  }

  /**
   * Назначает активную викторину: встроенную по идентификатору, свою — из
   * хранилища, null — предмет по умолчанию.
   *
   * Обработчик общий для каталога учителя и переключателя предмета на
   * интро-экране: два места, меняющие одно и то же поле userData разными
   * путями, разошлись бы при первой же правке.
   */
  async function handleSetActiveQuiz(quizId: string | null) {
    const updated: PhysastroiqUserData = { ...userData, activeQuizId: quizId };
    setUserData(updated);
    saveUserData(updated);
    const builtin = findBuiltin(quizId);
    if (builtin) {
      setActiveQuiz(builtin);
    } else if (quizId !== null) {
      const custom = await loadQuiz(quizId);
      setActiveQuiz(custom ?? DEFAULT_BUILTIN);
    } else {
      setActiveQuiz(DEFAULT_BUILTIN);
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
      const updated: PhysastroiqUserData = { ...userData, teacherPinHash: newPinHash };
      setUserData(updated);
      saveUserData(updated);
    }
    setPhase('catalog');
  }

  // Дублирует встроенную викторину как отправную точку для собственной —
  // копирует ВСЕ изображения её уровней (не одно, как у rusiq: там на всю
  // викторину одна картинка), т.к. до сохранения duplicated.images всё ещё
  // ссылается на файл из public/, недоступный по physastroiqmedia://.
  //
  // Встроенных викторин две, поэтому дублируется НАЗВАННАЯ, а не «та самая»:
  // педагог, строящий свою викторину по астрономии, не должен получить копию
  // физики.
  async function handleDuplicateBuiltin(sourceId: string) {
    const source = findBuiltin(sourceId) ?? DEFAULT_BUILTIN;
    try {
      const newId = crypto.randomUUID();
      const patchedImages: typeof source.images = {};
      for (const levelKey of Object.keys(source.images)) {
        const meta = source.images[levelKey];
        const response = await fetch(levelImageUrl(meta.fileName));
        if (!response.ok) throw new Error('fetch failed for level ' + levelKey);
        const buffer = await response.arrayBuffer();
        const saved = await saveQuizLevelImage(newId, Number(levelKey), buffer, 'image/png');
        if (!saved.ok || !saved.fileName) throw new Error('saveQuizLevelImage failed for level ' + levelKey);
        patchedImages[levelKey] = { ...meta, fileName: saved.fileName };
      }
      const duplicated: PhysastroiqQuiz = {
        ...source,
        id: newId,
        title: `${source.title} (копия)`,
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
        subjects={BUILTIN_QUIZZES.map((q) => ({ id: q.id, title: q.title }))}
        onSelectSubject={handleSetActiveQuiz}
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
        builtinQuizzes={BUILTIN_QUIZZES.map((q) => ({ id: q.id, title: q.title, questionCount: q.questions.length }))}
        activeQuizId={userData.activeQuizId}
        onSetActiveQuiz={handleSetActiveQuiz}
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
      subjects={BUILTIN_QUIZZES.map((q) => ({ id: q.id, title: q.title }))}
      onSelectSubject={handleSetActiveQuiz}
      onPlay={() => setPhase('setup')}
      onTeacherMode={() => setPhase('teacherGate')}
      onShowThematicGallery={() => setPhase('thematicGallery')}
    />
  );
}
