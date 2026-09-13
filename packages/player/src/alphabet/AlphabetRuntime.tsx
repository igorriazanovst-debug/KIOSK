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
  ALPHABET_MAX_PLAYERS,
} from '@kiosk/shared';
import { SCREEN_THEME_COLORS, palette } from './ui';
import { createElectronPlatform } from './platform/electronPlatform';
import { createWebPlatform } from './platform/webPlatform';
import { detectPlatformKind, setAlphabetPlatform } from './platform/AlphabetPlatform';
import type { AlphabetPlatform } from './platform/AlphabetPlatform';
import type {
  AlphabetContext,
  AlphabetLibrary,
  AlphabetSettings,
  Profile,
  Statistics,
  UserContent,
  VoiceKind,
  WordReadiness,
} from './types';
import ProfilesScreen from './screens/ProfilesScreen';
import MenuScreen from './screens/MenuScreen';
import AlphabetScreen from './screens/AlphabetScreen';
import LetterScreen from './screens/LetterScreen';
import PlayScreen from './screens/PlayScreen';
import { QuestionCountScreen, ResultsScreen, StageSelectScreen } from './screens/SetupScreens';
import StatisticsScreen from './screens/StatisticsScreen';
import SettingsScreen from './screens/SettingsScreen';
import PasswordPrompt from './components/PasswordPrompt';
import VoiceRecorder from './components/VoiceRecorder';
import NewSyllablePrompt from './components/NewSyllablePrompt';
import ConfirmPrompt from './components/ConfirmPrompt';
import Seats, { SEAT_ANGLES } from './components/Seats';
import MyContentScreen from './screens/MyContentScreen';
import WordEditorScreen from './screens/WordEditorScreen';
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
  | { name: 'results' }
  | { name: 'statistics' }
  | { name: 'settings' }
  | { name: 'myContent' }
  | { name: 'wordEditor'; wordId: string | null };

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
  /** Игроки партии в порядке хода. Один — одиночная игра, до четырёх — за столом */
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [screen, setScreenRaw] = useState<Screen>({ name: 'profiles' });
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  /**
   * Сообщение об УДАЧНОМ действии. Отдельно от ошибки: «комплект загружен,
   * два слова не нашлись» — не ошибка, но педагог обязан это увидеть, иначе
   * обнаружит на занятии.
   */
  const [notice, setNotice] = useState<string | null>(null);

  /**
   * Смена экрана ГАСИТ сообщение об ошибке.
   *
   * Без этого «Игрок уже есть в списке» из экрана профилей висело над
   * статистикой и настройками до конца работы приложения — увидено на живом
   * прогоне. Сообщение об ошибке относится к действию, а действие кончилось
   * вместе с экраном.
   */
  const setScreen = useCallback((next: Screen) => {
    setError(null);
    setNotice(null);
    setScreenRaw(next);
  }, []);
  const [settings, setSettings] = useState<AlphabetSettings>({
    ...alphabet.DEFAULT_ALPHABET_SETTINGS,
    questionCount: (properties.questionCount ??
      ALPHABET_DEFAULT_QUESTION_COUNT) as AlphabetSettings['questionCount'],
  });
  const [statistics, setStatistics] = useState<Statistics>({});
  const [passwordIsDefault, setPasswordIsDefault] = useState(false);
  /** Куда идём после ввода пароля; null — окно закрыто */
  const [gate, setGate] = useState<{ title: string; next: Screen } | null>(null);
  /** Открыто окно СМЕНЫ пароля, а не входа */
  const [changingPassword, setChangingPassword] = useState(false);
  const [userContent, setUserContent] = useState<UserContent>({ words: [], syllables: [], sets: [] });
  const [readiness, setReadiness] = useState<Record<string, WordReadiness>>({});
  /** Какие записи уже есть — пересобирается вместе с готовностью слов */
  const [voices, setVoices] = useState<Set<string>>(new Set());
  const [recording, setRecording] = useState<{ kind: VoiceKind; id: string; title: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [newSyllable, setNewSyllable] = useState<{ name: string; letters: string } | null>(null);
  /**
   * Подтверждение необратимого действия. Держится состоянием, а не window.confirm:
   * на киоске системные диалоги выглядят чужеродно и не масштабируются вместе
   * со сценой — на 4K-панели они остаются крошечными.
   */
  const [confirming, setConfirming] = useState<{
    title: string;
    consequence: string;
    confirmLabel: string;
    run: () => void;
  } | null>(null);
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
      const loaded = await platform.getSettings();
      if (!cancelled && loaded.ok && loaded.data) setSettings(loaded.data);
      const pass = await platform.teacherPasswordState();
      if (!cancelled && pass.ok) setPasswordIsDefault(pass.data?.isDefault ?? false);
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

  const chosen = selectedIds
    .map((id) => profiles.find((p) => p.id === id))
    .filter(Boolean) as Profile[];
  /** Первый выбранный — он же «текущий» там, где игрок нужен один */
  const selected = chosen[0] ?? null;

  /**
   * Выбор игрока переключателем, а не заменой: за столом играют двое-четверо,
   * и порядок хода — это порядок выбора.
   */
  const togglePlayer = (profileId: string) =>
    setSelectedIds((ids) =>
      ids.includes(profileId)
        ? ids.filter((id) => id !== profileId)
        : ids.length >= ALPHABET_MAX_PLAYERS
          ? ids
          : [...ids, profileId]
    );

  /**
   * Библиотека, которую видит ИГРА: поставочный пакет плюс контент педагога.
   * Своё слово должно играться наравне с поставочными — ТЗ строка 78
   * требует именно этого, а не отдельного раздела «мои слова».
   */
  const playable = useMemo(
    () => (library ? alphabet.mergeUserContent(library, userContent) : null),
    [library, userContent]
  );
  const hasAudio = !!library && alphabet.schemeHasAudio(library);

  /**
   * Поворот сцены к тому, чей ход — ТЗ строка 75 («для каждой стороны
   * интерактивного стола»). Только на доске и столе: на планшете игроки
   * сидят рядом и вертеть экран незачем.
   *
   * При повороте на 90° и 270° СТОРОНЫ МЕНЯЮТСЯ МЕСТАМИ: сцена, которая
   * после поворота должна заполнить окно шириной W и высотой H, до поворота
   * обязана быть H на W. Без этого повёрнутое поле торчит за края.
   */
  const seatAngle =
    screen.name === 'play' && session && chosen.length > 1 && settings.device !== 'tablet'
      ? SEAT_ANGLES[session.playerIndex % SEAT_ANGLES.length]
      : 0;
  const quarterTurn = seatAngle === 90 || seatAngle === -90;
  const boxWidth = quarterTurn ? height : width;
  const boxHeight = quarterTurn ? width : height;

  const scale = Math.min(boxWidth / SCENE_MIN_WIDTH, boxHeight / SCENE_MIN_HEIGHT);
  const sceneWidth = Math.max(SCENE_MIN_WIDTH, Math.round(boxWidth / scale));
  const sceneHeight = Math.max(SCENE_MIN_HEIGHT, Math.round(boxHeight / scale));


  const availability = useMemo(() => {
    const empty = { letterShow: 0, wordCompleting: 0, wordMake: 0 } as Record<AlphabetStage, number>;
    if (!playable) return empty;
    for (const stage of Object.keys(empty) as AlphabetStage[]) {
      empty[stage] = alphabet.eligibleWords(playable, stage).length;
    }
    return empty;
  }, [playable]);

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
    if (result.data) togglePlayer(result.data.id);
    await reloadProfiles();
  };

  const askDeleteProfile = (profileId: string) => {
    const profile = profiles.find((p) => p.id === profileId);
    if (!profile) return;
    setConfirming({
      title: `Удалить игрока «${profile.name}»?`,
      consequence:
        'Вместе с игроком пропадёт вся его статистика по буквам — и за последнюю игру, и за всё время. Вернуть её будет нельзя.',
      confirmLabel: 'Удалить игрока',
      run: () => void handleDelete(profileId),
    });
  };

  const handleDelete = async (profileId: string) => {
    const result = await platform.deleteProfile(profileId);
    if (!result.ok) {
      setError(result.error ?? 'Не удалось удалить игрока');
      return;
    }
    setSelectedIds((ids) => ids.filter((id) => id !== profileId));
    await reloadProfiles();
  };

  const changeSettings = async (patch: Partial<AlphabetSettings>) => {
    const next = { ...settings, ...patch };
    // Сначала показываем, потом пишем: ползунок громкости иначе дёргается,
    // дожидаясь диска на каждом шаге
    setSettings(next);
    const result = await platform.saveSettings(next);
    if (!result.ok) setError(result.error ?? 'Не удалось сохранить настройку');
    else if (result.data) setSettings(result.data);
  };

  const handlePickCount = async (count: number) => {
    await changeSettings({ questionCount: count as AlphabetSettings['questionCount'] });
    setScreen({ name: 'menu' });
  };

  const reloadStatistics = useCallback(async () => {
    const result = await platform.getStatistics();
    if (result.ok) setStatistics(result.data ?? {});
    else setError(result.error ?? 'Не удалось прочитать статистику');
  }, [platform]);

  /**
   * Вход в закрытый раздел. Пароль спрашивается КАЖДЫЙ раз, а не один раз за
   * запуск: приложение работает весь день на одном устройстве, и «вошёл
   * утром — открыто до вечера» не защищает ни от чего.
   */
  const openGated = (title: string, next: Screen) => setGate({ title, next });

  /**
   * Перечитывает контент педагога вместе с готовностью слов.
   *
   * Готовность считает ГЛАВНЫЙ ПРОЦЕСС: наличие файла записи знает только он.
   * Наличие записей приходит в том же ответе — иначе редактор спрашивал бы
   * про каждую запись отдельно, а их у слова из трёх слогов пять.
   */
  const reloadUserContent = useCallback(async () => {
    const content = await platform.getUserContent();
    if (content.ok) setUserContent(content.data ?? { words: [], syllables: [], sets: [] });
    const r = await platform.wordReadiness();
    if (r.ok) {
      const map = r.data ?? {};
      setReadiness(map);
      // Готовность уже знает, чего не хватает; здесь восстанавливаем, ЧТО
      // есть, чтобы редактор отмечал записанное построчно
      const present = new Set<string>();
      for (const [wordId, info] of Object.entries(map)) {
        if (!info.missing.some((m) => /слова целиком/.test(m))) present.add(`word:${wordId}`);
        if (!info.missing.some((m) => /без последнего слога/.test(m))) present.add(`bgn:${wordId}`);
      }
      setVoices(present);
    }
  }, [platform]);

  const hasVoice = (kind: VoiceKind, id: string) => voices.has(`${kind}:${id}`);

  const runEdit = async (action: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Не удалось сохранить');
      return false;
    }
    setError(null);
    await reloadUserContent();
    return true;
  };

  const askClearStatistics = () => {
    if (!selected) return;
    setConfirming({
      title: `Очистить статистику: ${selected.name}?`,
      consequence:
        'Пропадут результаты по всем буквам — и за последнюю игру, и накопленные за всё время. Сам игрок останется.',
      confirmLabel: 'Очистить',
      run: () => void handleClearStatistics(),
    });
  };

  const handleClearStatistics = async () => {
    if (!selected) return;
    const result = await platform.clearStatistics(selected.id);
    if (!result.ok) {
      setError(result.error ?? 'Не удалось очистить статистику');
      return;
    }
    await reloadStatistics();
  };

  const startSession = (stage: AlphabetStage) => {
    if (!playable || chosen.length === 0) return;
    try {
      const built = alphabet.buildAlphabetSession(playable, {
        roundId: `${Date.now()}`,
        stage,
        playerIds: chosen.map((p) => p.id),
        questionsPerPlayer: settings.questionCount,
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
    if (!playable || !session) return;
    // Пока держится подсветка верного ответа, новые нажатия игнорируются:
    // иначе быстрый ребёнок «проскакивает» следующий вопрос вслепую
    if (holdTimer.current) return;

    const outcome = alphabet.answer(playable, session, choice);
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
    if (!playable || !session) return;
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

  const background = SCREEN_THEME_COLORS[settings.screenTheme] ?? SCREEN_THEME_COLORS.sky;

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
        // Система координат для повёрнутой сцены и для подписей мест
        position: 'relative',
      }}
    >
      {screen.name === 'play' && session && chosen.length > 1 && (
        <Seats
          seats={chosen.map((p) => ({ playerId: p.id, name: p.name }))}
          activeIndex={session.playerIndex}
        />
      )}
      <div
        data-scene={screen.name}
        data-scene-size={`${sceneWidth}x${sceneHeight}`}
        data-seat-angle={seatAngle}
        style={{
          width: sceneWidth,
          height: sceneHeight,
          // Поворот вокруг ЦЕНТРА окна, а не левого верхнего угла: иначе
          // повёрнутая сцена уезжает за границы.
          //
          // position тут делает две работы сразу: при повороте — привязку к
          // центру окна, а без поворота — систему координат для окон пароля
          // и записи, которые лежат ВНУТРИ масштабированной сцены (position:
          // fixed внутри трансформа ведёт себя не так, как ожидается)
          position: seatAngle === 0 ? 'relative' : 'absolute',
          left: seatAngle !== 0 ? '50%' : undefined,
          top: seatAngle !== 0 ? '50%' : undefined,
          transform:
            seatAngle === 0
              ? `scale(${scale})`
              : `translate(-50%, -50%) rotate(${seatAngle}deg) scale(${scale})`,
          transformOrigin: seatAngle === 0 ? 'top left' : 'center center',
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

        {notice && (
          <div
            data-testid="alphabet-notice"
            style={{
              background: '#2f6b4a',
              borderRadius: 12,
              padding: '10px 18px',
              fontSize: 19,
            }}
          >
            {notice}
          </div>
        )}

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
            selectedIds={selectedIds}
            maxPlayers={ALPHABET_MAX_PLAYERS}
            newName={newName}
            onNewName={setNewName}
            onToggle={togglePlayer}
            onCreate={handleCreate}
            onDelete={askDeleteProfile}
            onStart={() => setScreen({ name: 'menu' })}
          />
        )}

        {screen.name === 'menu' && (
          <MenuScreen
            playerName={selected?.name ?? ''}
            hasLibrary={!!library}
            libraryNote={context?.libraryError ?? null}
            questionCount={settings.questionCount}
            onPlay={() => setScreen({ name: 'stages' })}
            onAlphabet={() => setScreen({ name: 'alphabet' })}
            onQuestionCount={() => setScreen({ name: 'count' })}
            onChangePlayer={() => setScreen({ name: 'profiles' })}
            onStatistics={() => openGated('Статистика', { name: 'statistics' })}
            onSettings={() => openGated('Настройки', { name: 'settings' })}
            onMyContent={() => openGated('Свои слова', { name: 'myContent' })}
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
            current={settings.questionCount}
            onPick={handlePickCount}
            onBack={() => setScreen({ name: 'menu' })}
          />
        )}

        {screen.name === 'alphabet' && playable && (
          <AlphabetScreen
            library={playable}
            onOpenLetter={(letterNumber) => setScreen({ name: 'letter', letterNumber })}
            onBack={() => setScreen({ name: 'menu' })}
          />
        )}

        {screen.name === 'letter' && playable && (
          <LetterScreen
            library={playable}
            letterNumber={screen.letterNumber}
            hasAudio={hasAudio}
            onSpeakLetter={() => play(letterAudioUrl(screen.letterNumber))}
            onSpeakWord={(wordId) => play(wordAudioUrl(wordId))}
            onBack={() => setScreen({ name: 'alphabet' })}
          />
        )}

        {screen.name === 'play' && playable && session && (
          <PlayScreen
            library={playable}
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

        {screen.name === 'statistics' && playable && selected && (
          <StatisticsScreen
            library={playable}
            statistics={statistics}
            profileId={selected.id}
            profileName={selected.name}
            onClear={askClearStatistics}
            onBack={() => setScreen({ name: 'menu' })}
          />
        )}

        {screen.name === 'settings' && (
          <SettingsScreen
            settings={settings}
            passwordIsDefault={passwordIsDefault}
            onChange={changeSettings}
            onChangePassword={() => setChangingPassword(true)}
            onBack={() => setScreen({ name: 'menu' })}
          />
        )}

        {screen.name === 'myContent' && playable && (
          <MyContentScreen
            allWords={playable.words}
            userWords={userContent.words}
            sets={playable.sets}
            readiness={readiness}
            busy={busy}
            onNewWord={() => setScreen({ name: 'wordEditor', wordId: null })}
            onEditWord={(wordId) => setScreen({ name: 'wordEditor', wordId })}
            onDeleteWord={(wordId) => {
              const word = userContent.words.find((w) => w.id === wordId);
              if (!word) return;
              setConfirming({
                title: `Удалить слово «${word.name}»?`,
                consequence:
                  'Вместе со словом пропадут его иллюстрация и записи голоса, и оно исчезнет из всех комплектов, где стояло.',
                confirmLabel: 'Удалить слово',
                run: () => void runEdit(() => platform.deleteUserWord(wordId)),
              });
            }}
            onSaveSet={(setId, title, wordIds) =>
              void runEdit(() =>
                setId
                  ? platform.updateSet(setId, { title, wordIds })
                  : platform.createSet({ title, wordIds })
              )
            }
            onDeleteSet={(setId) => {
              const set = playable.sets.find((x) => x.id === setId);
              if (!set) return;
              setConfirming({
                title: `Удалить комплект «${set.title}»?`,
                // Слова остаются: комплект — это только список, и путать
                // удаление списка с удалением слов нельзя
                consequence: `Пропадёт только список из ${set.wordIds.length} слов. Сами слова останутся на месте.`,
                confirmLabel: 'Удалить комплект',
                run: () => void runEdit(() => platform.deleteSet(setId)),
              });
            }}
            onExportSet={async (setId) => {
              setBusy(true);
              const result = await platform.exportSet(setId);
              setBusy(false);
              if (!result.ok) {
                setError(result.error ?? 'Не удалось выгрузить комплект');
                return;
              }
              // null — диалог закрыли, это не ошибка и не повод сообщать
              if (result.data) {
                setNotice(
                  `Комплект «${result.data.title}» выгружен: слов ${result.data.words}, файлов ${result.data.files}`
                );
              }
            }}
            onImportSet={async () => {
              setBusy(true);
              const result = await platform.importSet();
              setBusy(false);
              if (!result.ok) {
                setError(result.error ?? 'Не удалось загрузить комплект');
                return;
              }
              if (!result.data) return;
              const r = result.data;
              // Педагог должен знать, если комплект приехал НЕ целиком:
              // иначе он обнаружит это на занятии
              const parts = [`Комплект «${r.set.title}» загружен: слов ${r.words}`];
              if (r.renamed) parts.push('название было занято, комплект переименован');
              if (r.dropped.length > 0) {
                parts.push(`не нашлось слов из другого пакета контента: ${r.dropped.length}`);
              }
              setNotice(parts.join('. '));
              await reloadUserContent();
            }}
            onBack={() => setScreen({ name: 'menu' })}
          />
        )}

        {screen.name === 'wordEditor' && playable && (
          <WordEditorScreen
            syllables={playable.syllables}
            word={
              screen.wordId ? userContent.words.find((w) => w.id === screen.wordId) ?? null : null
            }
            readiness={screen.wordId ? readiness[screen.wordId] ?? null : null}
            hasVoice={hasVoice}
            busy={busy}
            onSave={async (draft) => {
              const id = screen.name === 'wordEditor' ? screen.wordId : null;
              const ok = await runEdit(() =>
                id ? platform.updateUserWord(id, draft) : platform.createUserWord(draft)
              );
              // После СОЗДАНИЯ остаёмся в редакторе: картинка и записи
              // адресуются идентификатором слова, а у нового его до сих пор не
              // было — уйти сейчас значило бы вернуться через минуту
              if (ok && !id) {
                const content = await platform.getUserContent();
                const created = content.data?.words[content.data.words.length - 1];
                if (created) setScreen({ name: 'wordEditor', wordId: created.id });
              }
            }}
            onPickImage={async () => {
              const id = screen.name === 'wordEditor' ? screen.wordId : null;
              if (!id) return;
              setBusy(true);
              const picked = await platform.pickWordImage();
              setBusy(false);
              if (!picked.ok) {
                setError(picked.error ?? 'Не удалось выбрать картинку');
                return;
              }
              // Диалог закрыли без выбора — это не ошибка
              if (!picked.data) return;
              const word = userContent.words.find((w) => w.id === id);
              if (!word) return;
              const fileName = picked.data.fileName;
              void runEdit(() =>
                platform.updateUserWord(word.id, {
                  name: word.name,
                  syllableIds: word.syllableIds,
                  hasWithoutLastSyllable: word.hasWithoutLastSyllable,
                  imageFile: fileName,
                })
              );
            }}
            onRecord={(kind, id) =>
              setRecording({
                kind,
                id,
                title:
                  kind === 'word'
                    ? 'Запись слова целиком'
                    : kind === 'bgn'
                      ? 'Запись слова без последнего слога'
                      : 'Запись слога',
              })
            }
            onPlayVoice={(kind, id) => play(platform.userMediaUrl(`voice/${kind}-${id}.webm`))}
            onNewSyllable={() => setNewSyllable({ name: '', letters: '' })}
            onBack={() => setScreen({ name: 'myContent' })}
          />
        )}

        {/* Запись голоса (ТЗ строка 76) */}
        {recording && (
          <VoiceRecorder
            title={recording.title}
            onSave={async (bytes) => {
              const saved = await platform.saveVoice(recording.kind, recording.id, bytes);
              if (!saved.ok) {
                setError(saved.error ?? 'Не удалось сохранить запись');
                return;
              }
              // Флаг «без последнего слога» ставится ФАКТОМ записи: у слова он
              // означает не намерение педагога, а наличие файла
              if (recording.kind === 'bgn') {
                const word = userContent.words.find((w) => w.id === recording.id);
                if (word && !word.hasWithoutLastSyllable) {
                  await platform.updateUserWord(word.id, {
                    name: word.name,
                    syllableIds: word.syllableIds,
                    hasWithoutLastSyllable: true,
                    imageFile: word.imageFile ?? null,
                  });
                }
              }
              setVoices((v) => new Set(v).add(`${recording.kind}:${recording.id}`));
              setRecording(null);
              await reloadUserContent();
            }}
            onCancel={() => setRecording(null)}
          />
        )}

        {/* Новый слог заводится отдельно, а не разбором строки с дефисами:
            слог — самостоятельная сущность со своей озвучкой */}
        {newSyllable && (
          <NewSyllablePrompt
            value={newSyllable}
            onChange={setNewSyllable}
            onCancel={() => setNewSyllable(null)}
            onSave={async () => {
              const letters = newSyllable.letters
                .split(/[\s,]+/)
                .map((n) => Number(n))
                .filter((n) => Number.isInteger(n) && n >= 1 && n <= 33);
              const ok = await runEdit(() =>
                platform.createSyllable({ name: newSyllable.name, letterNumbers: letters })
              );
              if (ok) setNewSyllable(null);
            }}
          />
        )}

        {confirming && (
          <ConfirmPrompt
            title={confirming.title}
            consequence={confirming.consequence}
            confirmLabel={confirming.confirmLabel}
            onConfirm={() => {
              const action = confirming.run;
              setConfirming(null);
              action();
            }}
            onCancel={() => setConfirming(null)}
          />
        )}

        {/* Вход в закрытый раздел */}
        {gate && (
          <PasswordPrompt
            sectionTitle={gate.title}
            onCheck={async (password) => {
              const result = await platform.checkTeacherPassword(password);
              return result.ok && result.data === true;
            }}
            onCancel={() => setGate(null)}
            onSuccess={() => {
              const next = gate.next;
              setGate(null);
              if (next.name === 'statistics') void reloadStatistics();
              if (next.name === 'myContent') void reloadUserContent();
              setScreen(next);
            }}
          />
        )}

        {/* Смена пароля: то же окно, но введённое становится НОВЫМ паролем */}
        {changingPassword && (
          <PasswordPrompt
            sectionTitle="Новый пароль педагога"
            onCheck={async (password) => {
              const result = await platform.setTeacherPassword(password);
              if (!result.ok) {
                setError(result.error ?? 'Не удалось сменить пароль');
                return false;
              }
              setPasswordIsDefault(result.data?.isDefault ?? false);
              return true;
            }}
            onCancel={() => setChangingPassword(false)}
            onSuccess={() => setChangingPassword(false)}
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
