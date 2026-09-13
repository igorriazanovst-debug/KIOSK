// packages/player/src/alphabet/AlphabetRuntime.tsx
// Рантайм виджета «АзбукоСлов» (Тип 3): состояние, маршрутизация экранов,
// ход партии, запись статистики.
//
// ИГРОВЫЕ ПРАВИЛА ЗДЕСЬ НЕ ЖИВУТ. Отбор заданий, проверка ответа, очерёдность
// и слияние статистики — в @kiosk/shared (пространство имён alphabet), потому
// что продукт по ТЗ (строка 67) выходит на две платформы, а Electron под
// Android не работает. Здесь остаётся только то, что нельзя разделить с
// нативной реализацией: React-состояние и вёрстка.
//
// МАСШТАБИРОВАНИЕ СЦЕНЫ — интерфейс вёрстан в логических пикселях, сцена
// целиком растягивается трансформом. Диапазон устройств от планшета до
// 4K-доски, и пересчитывать каждый шрифт под размер окна значило бы
// переписывать вёрстку при каждой правке.
//
// Сцена ЗАПОЛНЯЕТ окно, а не сидит в коробке 1024×768 с полями: логический
// размер берётся из реального, делённого на масштаб.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { alphabet } from '@kiosk/shared';
import type { AlphabetWidgetProperties, AlphabetStage } from '@kiosk/shared';
import {
  ALPHABET_DEFAULT_PROPS,
  ALPHABET_QUESTION_COUNTS,
  ALPHABET_DEFAULT_QUESTION_COUNT,
} from '@kiosk/shared';
import { SCREEN_THEME_COLORS, palette } from './ui';
import { createElectronPlatform } from './platform/electronPlatform';
import { createWebPlatform } from './platform/webPlatform';
import { detectPlatformKind, setAlphabetPlatform } from './platform/AlphabetPlatform';
import type { AlphabetPlatform } from './platform/AlphabetPlatform';
import type { AlphabetContext, AlphabetLibrary, Profile } from './types';
import ProfilesScreen from './screens/ProfilesScreen';
import MenuScreen from './screens/MenuScreen';
import AlphabetScreen from './screens/AlphabetScreen';
import LetterScreen from './screens/LetterScreen';
import PlayScreen from './screens/PlayScreen';
import { QuestionCountScreen, ResultsScreen, StageSelectScreen } from './screens/SetupScreens';
import { letterAudioUrl, wordAudioUrl, wordWithoutLastSyllableAudioUrl } from './mediaUrl';

const SCENE_MIN_WIDTH = 1024;
const SCENE_MIN_HEIGHT = 768;

/** Сколько держать подсветку верного ответа перед переходом к следующему, мс */
const CORRECT_HOLD_MS = 700;

interface Props {
  properties: Partial<AlphabetWidgetProperties>;
  width: number;
  height: number;
}

type Screen =
  | { name: 'profiles' }
  | { name: 'menu' }
  | { name: 'stages' }
  | { name: 'count' }
  | { name: 'alphabet' }
  | { name: 'letter'; letterNumber: number }
  | { name: 'play' }
  | { name: 'results' };

type Session = ReturnType<typeof alphabet.buildAlphabetSession>;

function createPlatform(): AlphabetPlatform {
  if (detectPlatformKind() === 'electron' && window.alphabetAPI) {
    return createElectronPlatform(window.alphabetAPI);
  }
  return createWebPlatform();
}

const AlphabetRuntime: React.FC<Props> = ({ properties, width, height }) => {
  const platform = useMemo(() => {
    const created = createPlatform();
    setAlphabetPlatform(created);
    return created;
  }, []);

  const [context, setContext] = useState<AlphabetContext | null>(null);
  const [library, setLibrary] = useState<AlphabetLibrary | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'profiles' });
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState(
    properties.questionCount ?? ALPHABET_DEFAULT_QUESTION_COUNT
  );
  const [session, setSession] = useState<Session | null>(null);
  const [lastChoice, setLastChoice] = useState<{ key: string; correct: boolean } | null>(null);

  const title = properties.title || 'АзбукоСлов';
  const audio = useRef<HTMLAudioElement | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reloadProfiles = useCallback(async () => {
    const result = await platform.listProfiles();
    if (result.ok) {
      setProfiles(result.data ?? []);
      setError(null);
    } else {
      // Повреждённый файл профилей — ОШИБКА, а не «список пуст»: молча
      // обнулившийся список выглядит как потеря работы детей
      setError(result.error ?? 'Не удалось прочитать список игроков');
    }
  }, [platform]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ctx = await platform.getContext();
      if (!cancelled && ctx.ok) setContext(ctx.data ?? null);
      const lib = await platform.getLibrary();
      if (!cancelled && lib.ok && lib.data) setLibrary(lib.data);
      const settings = await platform.getSettings();
      if (!cancelled && settings.ok && settings.data) setQuestionCount(settings.data.questionCount);
      await reloadProfiles();
    })();
    return () => {
      cancelled = true;
    };
  }, [platform, reloadProfiles]);

  // Таймер подсветки обязан умереть вместе с компонентом: иначе он сработает
  // на размонтированном дереве и React справедливо отругается
  useEffect(() => () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
  }, []);

  const scale = Math.min(width / SCENE_MIN_WIDTH, height / SCENE_MIN_HEIGHT);
  const sceneWidth = Math.max(SCENE_MIN_WIDTH, Math.round(width / scale));
  const sceneHeight = Math.max(SCENE_MIN_HEIGHT, Math.round(height / scale));

  const selected = profiles.find((p) => p.id === selectedId) ?? null;
  const hasAudio = !!library && alphabet.schemeHasAudio(library);

  const availability = useMemo(() => {
    const empty = { letterShow: 0, wordCompleting: 0, wordMake: 0 } as Record<AlphabetStage, number>;
    if (!library) return empty;
    for (const stage of Object.keys(empty) as AlphabetStage[]) {
      empty[stage] = alphabet.eligibleWords(library, stage).length;
    }
    return empty;
  }, [library]);

  const play = (url: string) => {
    // Одна и та же дорожка на всё приложение: параллельные реплики в детской
    // игре превращаются в кашу. Тот же приём у эталона — один объект Audio
    if (!audio.current) audio.current = new Audio();
    audio.current.pause();
    audio.current.src = url;
    void audio.current.play().catch(() => {
      /* нет файла или устройство занято — занятие из-за этого не останавливаем */
    });
  };

  const handleCreate = async () => {
    const result = await platform.createProfile(newName);
    if (!result.ok) {
      setError(result.error ?? 'Не удалось добавить игрока');
      return;
    }
    setNewName('');
    setSelectedId(result.data?.id ?? null);
    await reloadProfiles();
  };

  const handleDelete = async (profileId: string) => {
    const result = await platform.deleteProfile(profileId);
    if (!result.ok) {
      setError(result.error ?? 'Не удалось удалить игрока');
      return;
    }
    if (selectedId === profileId) setSelectedId(null);
    await reloadProfiles();
  };

  const handlePickCount = async (count: number) => {
    setQuestionCount(count);
    const result = await platform.saveSettings({ questionCount: count as never });
    if (!result.ok) setError(result.error ?? 'Не удалось сохранить настройку');
    setScreen({ name: 'menu' });
  };

  const startSession = (stage: AlphabetStage) => {
    if (!library || !selected) return;
    try {
      const built = alphabet.buildAlphabetSession(library, {
        roundId: `${Date.now()}`,
        stage,
        playerIds: [selected.id],
        questionsPerPlayer: questionCount,
        rng: Math.random,
      });
      setSession(built);
      setLastChoice(null);
      setError(null);
      setScreen({ name: 'play' });
    } catch (err) {
      // Несобираемая партия называет этап — педагог должен понять, какого
      // контента не хватает, а не увидеть «что-то пошло не так»
      setError(err instanceof Error ? err.message : 'Не удалось собрать игру');
      setScreen({ name: 'stages' });
    }
  };

  const finishSession = useCallback(
    async (finished: Session) => {
      for (const playerId of finished.playerIds) {
        const answers = finished.answers[playerId] ?? [];
        if (answers.length === 0) continue;
        const result = await platform.saveSession(playerId, [...answers]);
        if (!result.ok) setError(result.error ?? 'Не удалось сохранить результаты');
      }
    },
    [platform]
  );

  /**
   * Выход из партии посреди игры. Уже данные ответы СОХРАНЯЮТСЯ.
   *
   * Занятие в детском саду прерывают постоянно, и терять из-за этого всё, что
   * ребёнок успел ответить, — значит показывать педагогу пустой график там,
   * где работа была. Игроки без единого ответа при этом ничего не записывают,
   * так что случайный заход в этап и выход из него статистику не портит.
   */
  const handleExitPlay = () => {
    if (session) void finishSession(session);
    setSession(null);
    setLastChoice(null);
    setScreen({ name: 'menu' });
  };

  const handleAnswer = (choice: string | number) => {
    if (!library || !session) return;
    // Пока держится подсветка верного ответа, новые нажатия игнорируются:
    // иначе быстрый ребёнок «проскакивает» следующий вопрос вслепую
    if (holdTimer.current) return;

    const outcome = alphabet.answer(library, session, choice);
    setLastChoice({ key: String(choice), correct: outcome.correct });

    if (!outcome.correct) {
      setSession(outcome.session);
      return;
    }

    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      setLastChoice(null);
      setSession(outcome.session);
      if (outcome.sessionFinished) {
        void finishSession(outcome.session);
        setScreen({ name: 'results' });
      }
    }, CORRECT_HOLD_MS);
  };

  const speakQuestion = () => {
    if (!library || !session) return;
    const question = alphabet.currentQuestion(session);
    if (!question) return;
    if (question.stage === 'wordCompleting') {
      // На этапе 2 звучит НАЧАЛО слова, а не слово целиком: целое слово
      // содержало бы ответ, который ребёнок должен найти сам
      play(wordWithoutLastSyllableAudioUrl(question.wordId));
    } else {
      play(wordAudioUrl(question.wordId));
    }
  };

  const background = SCREEN_THEME_COLORS.sky;

  const resultsRows = session
    ? session.playerIds.map((playerId) => ({
        playerId,
        name: profiles.find((p) => p.id === playerId)?.name ?? playerId,
        ...session.tally[playerId],
      }))
    : [];

  return (
    <div
      data-testid="alphabet-runtime"
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
      }}
    >
      <div
        data-scene={screen.name}
        data-scene-size={`${sceneWidth}x${sceneHeight}`}
        style={{
          width: sceneWidth,
          height: sceneHeight,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          padding: 28,
          gap: 14,
          color: palette.text,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <header style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
          <h1 data-testid="alphabet-title" style={{ margin: 0, fontSize: 38 }}>
            {title}
          </h1>
          {selected && (
            <span
              data-testid="alphabet-current-player"
              style={{ fontSize: 22, color: palette.textDim }}
            >
              играет {selected.name}
            </span>
          )}
        </header>

        {error && (
          <div
            data-testid="alphabet-error"
            style={{
              background: palette.danger,
              borderRadius: 12,
              padding: '10px 18px',
              fontSize: 19,
            }}
          >
            {error}
          </div>
        )}

        {screen.name === 'profiles' && (
          <ProfilesScreen
            profiles={profiles}
            selectedId={selectedId}
            newName={newName}
            onNewName={setNewName}
            onSelect={setSelectedId}
            onCreate={handleCreate}
            onDelete={handleDelete}
            onStart={() => setScreen({ name: 'menu' })}
          />
        )}

        {screen.name === 'menu' && (
          <MenuScreen
            playerName={selected?.name ?? ''}
            hasLibrary={!!library}
            libraryNote={context?.libraryError ?? null}
            questionCount={questionCount}
            onPlay={() => setScreen({ name: 'stages' })}
            onAlphabet={() => setScreen({ name: 'alphabet' })}
            onQuestionCount={() => setScreen({ name: 'count' })}
            onChangePlayer={() => setScreen({ name: 'profiles' })}
          />
        )}

        {screen.name === 'stages' && (
          <StageSelectScreen
            availability={availability}
            onPick={startSession}
            onBack={() => setScreen({ name: 'menu' })}
          />
        )}

        {screen.name === 'count' && (
          <QuestionCountScreen
            counts={ALPHABET_QUESTION_COUNTS}
            current={questionCount}
            onPick={handlePickCount}
            onBack={() => setScreen({ name: 'menu' })}
          />
        )}

        {screen.name === 'alphabet' && library && (
          <AlphabetScreen
            library={library}
            onOpenLetter={(letterNumber) => setScreen({ name: 'letter', letterNumber })}
            onBack={() => setScreen({ name: 'menu' })}
          />
        )}

        {screen.name === 'letter' && library && (
          <LetterScreen
            library={library}
            letterNumber={screen.letterNumber}
            hasAudio={hasAudio}
            onSpeakLetter={() => play(letterAudioUrl(screen.letterNumber))}
            onSpeakWord={(wordId) => play(wordAudioUrl(wordId))}
            onBack={() => setScreen({ name: 'alphabet' })}
          />
        )}

        {screen.name === 'play' && library && session && (
          <PlayScreen
            library={library}
            session={session}
            lastChoice={lastChoice}
            hasAudio={hasAudio}
            playerName={
              profiles.find((p) => p.id === alphabet.currentPlayerId(session))?.name ?? ''
            }
            onAnswer={handleAnswer}
            onSpeak={speakQuestion}
            onExit={handleExitPlay}
          />
        )}

        {screen.name === 'results' && (
          <ResultsScreen
            rows={resultsRows}
            onAgain={() => setScreen({ name: 'stages' })}
            onMenu={() => setScreen({ name: 'menu' })}
          />
        )}

        <footer style={{ fontSize: 15, color: palette.textDim }}>
          <span data-testid="alphabet-storage-note">
            {context
              ? `Данные занятия: ${context.baseDir}${context.isFallback ? ' (общий каталог недоступен для записи)' : ''}`
              : 'Подключение к хранилищу…'}
          </span>
          {context && !context.hasLibrary && (
            <span data-testid="alphabet-library-note" style={{ marginLeft: 16 }}>
              {context.libraryError}
            </span>
          )}
          {library && !hasAudio && (
            <span data-testid="alphabet-audio-note" style={{ marginLeft: 16 }}>
              Озвучка ещё не записана
            </span>
          )}
        </footer>
      </div>
    </div>
  );
};

export default AlphabetRuntime;
export { SCENE_MIN_WIDTH, SCENE_MIN_HEIGHT, ALPHABET_DEFAULT_PROPS };
