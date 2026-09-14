// packages/player/src/chimiq/ChimiqRuntime.tsx
//
// Фаза 3 (игровой поток плеера, план реализации Тип9_ХимIQ §5): интро →
// настройка → игровое поле → результаты, полностью рабочий цикл. Пока на
// ВСТРОЕННОМ демо-контенте (chimiqDemoContent.json — синтетическая сетка
// 4×3, не финальные изображения-карты) — реальный контент с изображениями
// по уровням и полным банком из 168 вопросов подключается в Фазе 7, когда
// изображения будут выбраны и измерены. Редактор (каталог/создание своих
// викторин/учительский режим) — Фаза 4, ещё не подключён: кнопка "Режим
// учителя" на интро пока не имеет действия дальше самого экрана-заглушки.
import React, { useState } from 'react';
import './chimiqTheme.css';
import IntroScreen from './screens/IntroScreen.tsx';
import GameSetupScreen, { type GameSetupResult } from './screens/GameSetupScreen.tsx';
import GameBoardScreen from './screens/GameBoardScreen.tsx';
import ResultsScreen from './screens/ResultsScreen.tsx';
import { ChimiqQuizSchema, type ChimiqQuestion, type ChimiqQuiz } from './model/schema.ts';
import { assignQuestions, type ChimiqAnswerEvent } from './gameLogic.ts';
import demoContentJson from './content/chimiqDemoContent.json' with { type: 'json' };

// Изображение-карта — плоская строка пути в public/, без import (см.
// урок §4 ретроспективы Тип7: import.meta ломает non-module сборку
// packages/player в собранном .exe, даже когда исходный синтаксис — обычный
// import). Путь строится из quiz.images[level].fileName динамически, не
// хардкодом одного имени — реальный контент Фазы 7 будет менять имя файла.
function levelImageUrl(fileName: string): string {
  return `./chimiq/${fileName}`;
}

const BUILTIN_QUIZ: ChimiqQuiz = ChimiqQuizSchema.parse(demoContentJson);

interface Props {
  properties: { title?: string };
}

type Phase = 'intro' | 'setup' | 'board' | 'results';

export default function ChimiqRuntime({ properties }: Props) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [setup, setSetup] = useState<GameSetupResult | null>(null);
  const [questionsByPlayer, setQuestionsByPlayer] = useState<ChimiqQuestion[][]>([]);
  const [answers, setAnswers] = useState<ChimiqAnswerEvent[]>([]);

  const quiz = BUILTIN_QUIZ;

  function handlePlay() {
    setPhase('setup');
  }

  function handleTeacherMode() {
    // Фаза 4 (редактор/учительский режим) ещё не подключена — оставлено
    // как явный no-op, не тихая заглушка без обратной связи.
  }

  function handleSetupComplete(result: GameSetupResult) {
    const pool = quiz.questions.filter((q) => q.level === result.level);
    const assigned = assignQuestions(pool, result.playerNames.length, result.questionsPerPlayer);
    setSetup(result);
    setQuestionsByPlayer(assigned);
    setPhase('board');
  }

  function handleBoardFinished(finalAnswers: ChimiqAnswerEvent[]) {
    setAnswers(finalAnswers);
    setPhase('results');
  }

  function handleRestart() {
    setSetup(null);
    setQuestionsByPlayer([]);
    setAnswers([]);
    setPhase('intro');
  }

  if (phase === 'intro') {
    return <IntroScreen quiz={quiz} onPlay={handlePlay} onTeacherMode={handleTeacherMode} />;
  }

  if (phase === 'setup') {
    return <GameSetupScreen quiz={quiz} onComplete={handleSetupComplete} />;
  }

  if (phase === 'board' && setup) {
    const image = quiz.images[String(setup.level)];
    const decoyPoints = quiz.genericDecoyPoints.filter((p) => p.level === setup.level);
    return (
      <GameBoardScreen
        imageUrl={levelImageUrl(image.fileName)}
        imageWidth={image.width}
        imageHeight={image.height}
        playerNames={setup.playerNames}
        questionsByPlayer={questionsByPlayer}
        genericDecoyPoints={decoyPoints}
        onFinished={handleBoardFinished}
      />
    );
  }

  if (phase === 'results' && setup) {
    return (
      <ResultsScreen
        playerNames={setup.playerNames}
        answers={answers}
        questionsByPlayer={questionsByPlayer}
        onRestart={handleRestart}
      />
    );
  }

  // Недостижимо при корректном порядке фаз — оставлено как явный fallback,
  // а не пустой рендер, если сюда всё же попадём (например, phase==='board'
  // без setup из-за гонки состояния).
  return <IntroScreen quiz={quiz} onPlay={handlePlay} onTeacherMode={handleTeacherMode} />;
}
