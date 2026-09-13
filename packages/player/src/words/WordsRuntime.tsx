// packages/player/src/words/WordsRuntime.tsx
// Рантайм виджета «Я знаю много слов» (Тип 2): конечный автомат экранов и
// склейка домена (@kiosk/shared/words) с локальным хранилищем (wordsAPI).
//
// Вся игровая логика живёт в домене и покрыта юнит-тестами; здесь — только
// переходы между экранами, загрузка данных и озвучка. Такое разделение
// сознательное: то, что можно проверить без запуска приложения, должно быть
// проверяемо без него.
//
// Сцена рисуется в логических 1024×768 и подгоняется под вьюпорт одним
// transform: scale с полями по бокам — приём эталона ОС3. Виджет занимает
// весь экран (Player.tsx, isStandaloneAppProject), поэтому адаптивной
// вёрстки не требуется.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  WordsWidgetProperties,
  WordsLibrary,
  WordsSettings,
  GameSession,
  AwardTier, WordImageOverrides } from '@kiosk/shared';
import {
  buildSession,
  answer as answerStep,
  currentStep,
  effectiveLevel,
  awardForPlayer,
  schemeHasAudio,
  wordAudioPaths,
  WORDS_DEFAULT_OPTIONS_PER_STEP,
  WORDS_DEFAULT_STEPS_PER_PLAYER,
} from '@kiosk/shared';

import type { Profile, Screen, ScoreBook, WordsContext, UserWordDraft, SetDraft } from './types';
import type { UserWord, UserSet } from '@kiosk/shared';
import { setWordsPlatform, detectPlatformKind } from './platform/WordsPlatform';
import { createElectronPlatform } from './platform/electronPlatform';
import { createWebPlatform } from './platform/webPlatform';
import { palette, SCREEN_THEME_COLORS } from './ui';
import { libraryAssetUrl, wordImageUrl, userMediaUrl } from './mediaUrl';
import { AudioBus, createHtmlAudioPlayer } from './audio/AudioBus';

import MenuScreen from './screens/MenuScreen';
import PlayersScreen from './screens/PlayersScreen';
import SettingsScreen from './screens/SettingsScreen';
import MapScreen from './screens/MapScreen';
import PreviewScreen from './screens/PreviewScreen';
import ArrangementScreen from './screens/ArrangementScreen';
import PlayScreen from './screens/PlayScreen';
import ScoreScreen from './screens/ScoreScreen';
import MyWordsScreen from './screens/MyWordsScreen';
import WordImagesScreen from './screens/WordImagesScreen';
import PasswordPrompt from './components/PasswordPrompt';
import WordEditorScreen from './screens/WordEditorScreen';
import SetEditorScreen from './screens/SetEditorScreen';

/**
 * МИНИМАЛЬНАЯ логическая сцена. Раньше она была единственной: всё рисовалось
 * в 1024×768 и масштабировалось целиком, а окно другого соотношения сторон
 * получало чёрные поля по краям.
 *
 * Теперь это именно минимум. Сцена растягивается до фактического соотношения
 * окна: по одной оси остаётся ровно минимум, по другой логического места
 * становится БОЛЬШЕ. Меньше не становится никогда, поэтому вёрстка, которая
 * помещалась в 1024×768, помещается и дальше — а на широком или высоком окне
 * получает запас вместо полей.
 */
const SCENE_MIN_WIDTH = 1024;
const SCENE_MIN_HEIGHT = 768;

/** Сколько держать «проявленный» предмет перед следующим шагом, мс */
const REVEAL_MS = 1200;
/** Сколько подсвечивать ошибку */
const WRONG_MS = 700;

const DEFAULT_SETTINGS: WordsSettings = {
  schemaVersion: 1,
  volume: 70,
  device: 'board',
  levelOverrides: {},
};

interface Props {
  properties: Partial<WordsWidgetProperties>;
  width: number;
  height: number;
}

const GUEST: Profile = { id: 'guest', name: 'Гость', createdAt: '' };

const WordsRuntime: React.FC<Props> = ({ properties, width, height }) => {
  // Масштаб по более тесной оси — как и раньше. Логический размер считается
  // обратно из него, поэтому сцена заполняет окно ровно, без полей.
  const scale = Math.min(width / SCENE_MIN_WIDTH, height / SCENE_MIN_HEIGHT);
  const sceneWidth = Math.max(SCENE_MIN_WIDTH, Math.round(width / scale));
  const sceneHeight = Math.max(SCENE_MIN_HEIGHT, Math.round(height / scale));
  // Платформа выбирается один раз: Electron на Windows, веб-реализация в
  // браузере и в будущей Android-сборке. Экраны и домен о ней не знают.
  const platformRef = useRef<ReturnType<typeof createWebPlatform> | null>(null);
  if (!platformRef.current) {
    platformRef.current =
      detectPlatformKind() === 'electron' && window.wordsAPI
        ? createElectronPlatform(window.wordsAPI)
        : createWebPlatform();
    setWordsPlatform(platformRef.current);
  }
  const api = platformRef.current;

  const [context, setContext] = useState<WordsContext | null>(null);
  const [library, setLibrary] = useState<WordsLibrary | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [settings, setSettings] = useState<WordsSettings>(DEFAULT_SETTINGS);
  const [scores, setScores] = useState<ScoreBook>({});
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [userWords, setUserWords] = useState<UserWord[]>([]);
  const [sets, setSets] = useState<UserSet[]>([]);

  const [screen, setScreen] = useState<Screen>({ name: 'menu' });
  const [session, setSession] = useState<GameSession | null>(null);
  const [lastOutcome, setLastOutcome] = useState<'correct' | 'wrong' | null>(null);
  const [savedAwards, setSavedAwards] = useState<Record<string, AwardTier | null>>({});
  const [locked, setLocked] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Итог экспорта/импорта комплекта — текст под списками, до следующего действия */
  const [archiveNotice, setArchiveNotice] = useState<string | null>(null);
  /** Свои картинки педагога для поставочных слов (ТЗ строка 42) */
  const [wordImages, setWordImages] = useState<WordImageOverrides>({});
  /** Раздел, в который просят пароль. null — окна ввода нет */
  const [gate, setGate] = useState<null | { screen: Screen; title: string }>(null);
  /** Открыт ли ввод нового пароля (из настроек) */
  const [changingPassword, setChangingPassword] = useState(false);
  /** Стандартный ли ещё пароль — от этого зависит подсказка в окне ввода */
  const [defaultPassword, setDefaultPassword] = useState(false);

  const busRef = useRef<AudioBus | null>(null);
  if (!busRef.current) busRef.current = new AudioBus(createHtmlAudioPlayer());
  const bus = busRef.current;

  const hasAudio = library ? schemeHasAudio(library.audioScheme) : false;

  // ── загрузка ──────────────────────────────────────────────────────────
  const reloadProfiles = useCallback(async () => {
    if (!api) return;
    const res = await api.listProfiles();
    if (res.ok) setProfiles(res.data ?? []);
    else setError(res.error ?? 'Не удалось прочитать список игроков');
  }, [api]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [ctx, lib, prof, sett, sc, uw, us] = await Promise.all([
        api.getContext(),
        api.getLibrary(),
        api.listProfiles(),
        api.getSettings(),
        api.getScores(),
        api.listUserWords(),
        api.listSets(),
      ]);
      if (cancelled) return;

      if (ctx.ok) setContext(ctx.data ?? null);
      if (lib.ok) setLibrary(lib.data ?? null);
      else setError(lib.error ?? 'Пакет учебного контента не подключён');
      if (prof.ok) setProfiles(prof.data ?? []);
      if (sett.ok && sett.data) setSettings(sett.data);
      if (sc.ok) setScores(sc.data ?? {});
      if (uw.ok) setUserWords(uw.data ?? []);
      if (us.ok) setSets(us.data ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  // Громкость виджета — стартовое значение; на устройстве её меняют в настройках
  useEffect(() => {
    bus.setVolume(settings.volume ?? properties.volume ?? 70);
  }, [bus, settings.volume, properties.volume]);

  useEffect(() => () => bus.stop(), [bus]);

  // ── озвучка слова ─────────────────────────────────────────────────────
  const sayWord = useCallback(
    (wordId: string, roundId: string) => {
      if (!library || !hasAudio) return;
      const paths = wordAudioPaths(wordId, library.audioScheme);
      if (paths.length === 0) return;
      // Один случайный вариант из имеющихся: за 20 шагов одна и та же фраза
      // приедается. Отсутствующий файл озвучки очередь не роняет.
      const pick = paths[Math.floor(Math.random() * paths.length)];
      void bus.say([libraryAssetUrl(pick)], roundId);
    },
    [bus, hasAudio, library]
  );

  // Слово может быть поставочным или своим — экраны об этом не знают
  const userWordById = useMemo(() => new Map(userWords.map((w) => [w.id, w])), [userWords]);

  const wordName = useCallback(
    (wordId: string): string =>
      userWordById.get(wordId)?.name ??
      library?.words.find((w) => w.id === wordId)?.name ??
      wordId,
    [library, userWordById]
  );

  const imageUrlFor = useCallback(
    (wordId: string): string | null => {
      const own = userWordById.get(wordId);
      if (own) return own.imageFile ? userMediaUrl(own.imageFile) : null;
      // Подмена педагога важнее поставочной картинки — в этом весь смысл
      const replaced = wordImages[wordId];
      if (replaced) return userMediaUrl(replaced);
      return wordImageUrl(wordId);
    },
    [userWordById, wordImages]
  );

  const reloadContent = useCallback(async () => {
    if (!api) return;
    const [uw, us, wi] = await Promise.all([
      api.listUserWords(),
      api.listSets(),
      api.listWordImages(),
    ]);
    if (uw.ok) setUserWords(uw.data ?? []);
    if (us.ok) setSets(us.data ?? []);
    if (wi.ok) setWordImages(wi.data ?? {});
    const ps = await api.teacherPasswordState();
    if (ps.ok) setDefaultPassword(ps.data?.isDefault ?? false);
  }, [api]);

  /**
   * Общий путь для действий редактора: показать ошибку понятным текстом,
   * перечитать списки и, если действие успешно, вернуться назад. Без этого
   * каждый обработчик повторял бы одно и то же четыре раза.
   */
  const runContentAction = useCallback(
    async (action: () => Promise<{ ok: boolean; error?: string }>, onSuccess?: () => void) => {
      setBusy(true);
      setArchiveNotice(null);
      const res = await action();
      setBusy(false);
      if (!res.ok) {
        setError(res.error ?? 'Не удалось выполнить действие');
        return;
      }
      setError(null);
      await reloadContent();
      onSuccess?.();
    },
    [reloadContent]
  );

  /**
   * Произнести слово вне партии — чтобы педагог слышал, к чему подбирает
   * картинку. Раунд заводится свой: очередь отбрасывает запоздалую озвучку по
   * roundId, и без нового раунда предпросмотр глушился бы прошлой партией.
   */
  const speakWordNow = useCallback(
    (wordId: string) => {
      if (!library || !hasAudio) return;
      const paths = wordAudioPaths(wordId, library.audioScheme);
      if (paths.length === 0) return;
      const roundId = `preview-${Date.now()}`;
      bus.startRound(roundId);
      void bus.say([libraryAssetUrl(paths[0])], roundId);
    },
    [bus, hasAudio, library]
  );

  /** Поставить поставочному слову свою картинку */
  const pickWordImage = useCallback(
    async (wordId: string) => {
      if (!api) return;
      setBusy(true);
      const res = await api.pickWordImage(wordId);
      setBusy(false);
      if (!res.ok) {
        setError(res.error ?? 'Не удалось заменить картинку');
        return;
      }
      setError(null);
      const data = res.data;
      if (!data || data.canceled) return;
      setWordImages(data.overrides);
    },
    [api]
  );

  /** Вернуть слову картинку из поставки */
  const clearWordImage = useCallback(
    async (wordId: string) => {
      if (!api) return;
      setBusy(true);
      const res = await api.clearWordImage(wordId);
      setBusy(false);
      if (!res.ok) {
        setError(res.error ?? 'Не удалось вернуть поставочную картинку');
        return;
      }
      setError(null);
      setWordImages(res.data ?? {});
    },
    [api]
  );

  /**
   * Экспорт комплекта. Диалог сохранения открывает главный процесс, сюда
   * возвращается только отчёт — что уехало. Отказ от диалога не считается
   * ошибкой и ничего не пишет на экран.
   */
  const exportSet = useCallback(
    async (setId: string) => {
      if (!api) return;
      setBusy(true);
      const res = await api.exportSet(setId);
      setBusy(false);
      if (!res.ok) {
        setError(res.error ?? 'Не удалось сохранить комплект');
        return;
      }
      setError(null);
      const data = res.data;
      if (!data || data.canceled) return;
      setArchiveNotice(
        `Комплект «${data.title}» сохранён: слов ${data.words}, из них своих ${data.ownWords}, файлов ${data.files}.`
      );
    },
    [api]
  );

  /**
   * Импорт комплекта. Слова, которых нет на этом устройстве, перечисляются
   * явно: молча укоротившийся комплект педагог заметит только на занятии.
   */
  const importSet = useCallback(async () => {
    if (!api) return;
    setBusy(true);
    const res = await api.importSet();
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Не удалось прочитать файл комплекта');
      return;
    }
    setError(null);
    const data = res.data;
    if (!data || data.canceled) return;

    await reloadContent();
    const parts = [`Комплект «${data.set.title}» добавлен`];
    if (data.addedWords > 0) parts.push(`новых слов: ${data.addedWords}`);
    if (data.reusedWords > 0) parts.push(`уже было: ${data.reusedWords}`);
    if (data.skippedWords.length > 0) {
      parts.push(`не найдено на устройстве: ${data.skippedWords.join(', ')}`);
    }
    setArchiveNotice(`${parts.join('. ')}.`);
  }, [api, reloadContent]);

  // ── партия ────────────────────────────────────────────────────────────
  const players: Profile[] = useMemo(() => {
    const chosen = profiles.filter((p) => selectedProfileIds.includes(p.id));
    return chosen.length > 0 ? chosen : [GUEST];
  }, [profiles, selectedProfileIds]);

  const startGame = useCallback(
    (themeId: string) => {
      if (!library) return;
      // Играть можно и поставочную тему, и свой комплект — движку партии
      // разницы нет, отличается только откуда взялся список слов
      const theme = library.themes.find((t) => t.id === themeId);
      const set = sets.find((s) => s.id === themeId);
      const themeWordIds = theme?.wordIds ?? set?.wordIds;
      if (!themeWordIds) {
        setError('Тема не найдена');
        return;
      }

      const baseLevelOf = (wordId: string) =>
        library.words.find((w) => w.id === wordId)?.level ?? 0;

      const built = buildSession({
        roundId: `${themeId}-${Date.now()}`,
        themeId,
        playerIds: players.map((p) => p.id),
        themeWordIds: [...themeWordIds],
        // Дистракторы добираются из остальных тем, когда своих слов мало
        fallbackWordIds: library.words.map((w) => w.id).filter((id) => !themeWordIds.includes(id)),
        stepsPerPlayer: properties.stepsPerPlayer ?? WORDS_DEFAULT_STEPS_PER_PLAYER,
        optionsPerStep: WORDS_DEFAULT_OPTIONS_PER_STEP,
        levelOf: (wordId) =>
          effectiveLevel(wordId, baseLevelOf(wordId) as 0 | 1 | 2, settings.levelOverrides),
      });

      bus.startRound(built.roundId);
      setSession(built);
      setLastOutcome(null);
      setLocked(false);
      setScreen({ name: 'play', themeId });

      const first = currentStep(built);
      // Озвучка НЕ запускается сама: вопрос написан текстом на поле, а
      // звучит только по нажатию «Озвучка вопроса» (решение пользователя от
      // 13.09.2026). Раунд всё равно открываем — очередь по нему отбрасывает
      // запоздалую озвучку прошлой партии, если ребёнок успел нажать кнопку.

    },
    [bus, library, players, properties.stepsPerPlayer, sets, settings.levelOverrides]
  );

  const finishGame = useCallback(
    async (finished: GameSession) => {
      const awards: Record<string, AwardTier | null> = {};
      for (const player of finished.playerIds) {
        const earned = awardForPlayer(finished, player);
        awards[player] = null;
        if (earned && api && player !== GUEST.id) {
          const res = await api.saveScore(player, finished.themeId, earned);
          // changed === false означает «рекорд не побит»: понизить ступень
          // нельзя ни отсюда, ни из хранилища
          awards[player] = res.ok && res.data?.changed ? earned : null;
        }
      }
      setSavedAwards(awards);
      if (api) {
        const sc = await api.getScores();
        if (sc.ok) setScores(sc.data ?? {});
      }
      setScreen({ name: 'score', themeId: finished.themeId });
    },
    [api]
  );

  const onAnswer = useCallback(
    (wordId: string) => {
      if (!session || locked) return;
      const result = answerStep(session, wordId);
      if (result.outcome === 'ignored') return;

      if (result.outcome === 'wrong') {
        setSession(result.session);
        setLastOutcome('wrong');
        window.setTimeout(() => setLastOutcome(null), WRONG_MS);
        return;
      }

      // Верно: держим предмет «проявленным», и только потом переходим к
      // следующему шагу — иначе ребёнок не увидит результат своего действия
      setLastOutcome('correct');
      setLocked(true);
      window.setTimeout(() => {
        setLastOutcome(null);
        setLocked(false);
        setSession(result.session);
        if (result.session.finished) {
          void finishGame(result.session);
        } else {
          const next = currentStep(result.session);
          // Следующий шаг тоже молчит: озвучка только по кнопке
        }
      }, REVEAL_MS);
    },
    [finishGame, locked, session]
  );

  const repeatWord = useCallback(() => {
    if (!session) return;
    const step = currentStep(session);
    if (step) sayWord(step.targetWordId, session.roundId);
  }, [sayWord, session]);

  // ── действия с профилями и настройками ───────────────────────────────
  const createProfile = useCallback(
    async (name: string): Promise<boolean> => {
      if (!api) return false;
      setBusy(true);
      const res = await api.createProfile(name);
      setBusy(false);
      if (!res.ok) {
        setError(res.error ?? 'Не удалось создать игрока');
        return false;
      }
      setError(null);
      await reloadProfiles();
      return true;
    },
    [api, reloadProfiles]
  );

  const deleteProfile = useCallback(
    async (id: string) => {
      if (!api) return;
      setBusy(true);
      const res = await api.deleteProfile(id);
      setBusy(false);
      if (!res.ok) {
        setError(res.error ?? 'Не удалось удалить игрока');
        return;
      }
      setSelectedProfileIds((ids) => ids.filter((x) => x !== id));
      await reloadProfiles();
    },
    [api, reloadProfiles]
  );

  const changeSettings = useCallback(
    (next: WordsSettings) => {
      setSettings(next);
      if (api) void api.saveSettings(next);
    },
    [api]
  );

  const goMap = useCallback(() => {
    setError(null);
    setScreen({ name: 'map' });
  }, []);

  // ── экраны ────────────────────────────────────────────────────────────
  const firstPlayerAwards = scores[players[0]?.id ?? ''] ?? {};

  let content: React.ReactNode = null;

  if (screen.name === 'menu') {
    content = (
      <MenuScreen
        title={properties.title || 'Я знаю много слов'}
        profiles={profiles}
        selectedProfileIds={selectedProfileIds}
        error={error}
        onSingle={() => {
          setSelectedProfileIds((ids) => ids.slice(0, 1));
          goMap();
        }}
        onMulti={() => setScreen({ name: 'players' })}
        onPlayers={() => setScreen({ name: 'players' })}
        onSettings={() => setGate({ screen: { name: 'settings' }, title: 'Настройки' })}
        onMyWords={() => setGate({ screen: { name: 'myWords' }, title: 'Мои слова' })}
      />
    );
  } else if (screen.name === 'players') {
    content = (
      <PlayersScreen
        profiles={profiles}
        selectedProfileIds={selectedProfileIds}
        error={error}
        busy={busy}
        onBack={() => setScreen({ name: 'menu' })}
        onCreate={createProfile}
        onDelete={(id) => void deleteProfile(id)}
        onToggleSelected={(id) =>
          setSelectedProfileIds((ids) =>
            ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
          )
        }
        onPlay={goMap}
      />
    );
  } else if (screen.name === 'settings') {
    content = (
      <SettingsScreen
        library={library}
        settings={settings}
        error={error}
        onBack={() => setScreen({ name: 'menu' })}
        onChange={changeSettings}
      />
    );
  } else if (screen.name === 'map') {
    content = (
      <MapScreen
        library={library}
        sets={sets}
        error={error}
        awards={firstPlayerAwards}
        onBack={() => setScreen({ name: 'menu' })}
        onPick={(themeId) =>
          setScreen(
            players.length > 1 ? { name: 'arrangement', themeId } : { name: 'preview', themeId }
          )
        }
      />
    );
  } else if (screen.name === 'arrangement') {
    content = (
      <ArrangementScreen
        players={players}
        onBack={goMap}
        onStart={() => setScreen({ name: 'preview', themeId: screen.themeId })}
      />
    );
  } else if (screen.name === 'preview') {
    content = (
      <PreviewScreen
        library={library}
        themeId={screen.themeId}
        onBack={goMap}
        onStart={() => startGame(screen.themeId)}
      />
    );
  } else if (screen.name === 'play' && session) {
    content = (
      <PlayScreen
        session={session}
        wordName={wordName}
        imageUrlFor={imageUrlFor}
        players={players}
        hasAudio={hasAudio}
        sceneWidth={sceneWidth}
        sceneHeight={sceneHeight}
        lastOutcome={lastOutcome}
        onAnswer={onAnswer}
        onRepeat={repeatWord}
        onExit={() => {
          bus.stop();
          setSession(null);
          setScreen({ name: 'menu' });
        }}
      />
    );
  } else if (screen.name === 'myWords') {
    content = (
      <MyWordsScreen
        words={userWords}
        sets={sets}
        library={library}
        error={error}
        busy={busy}
        onBack={() => setScreen({ name: 'menu' })}
        onNewWord={() => setScreen({ name: 'wordEditor', wordId: null })}
        onEditWord={(wordId) => setScreen({ name: 'wordEditor', wordId })}
        onDeleteWord={(wordId) => void runContentAction(() => api.deleteUserWord(wordId))}
        onNewSet={() => setScreen({ name: 'setEditor', setId: null })}
        onEditSet={(setId) => setScreen({ name: 'setEditor', setId })}
        onDeleteSet={(setId) => void runContentAction(() => api.deleteSet(setId))}
        onExportSet={(setId) => void exportSet(setId)}
        onImportSet={() => void importSet()}
        onWordImages={() => setScreen({ name: 'wordImages' })}
        notice={archiveNotice}
      />
    );
  } else if (screen.name === 'wordImages') {
    content = (
      <WordImagesScreen
        library={library}
        overrides={wordImages}
        error={error}
        busy={busy}
        imageUrlFor={imageUrlFor}
        onBack={() => setScreen({ name: 'myWords' })}
        onPick={(wordId) => void pickWordImage(wordId)}
        onClear={(wordId) => void clearWordImage(wordId)}
        onSpeak={(wordId) => speakWordNow(wordId)}
      />
    );
  } else if (screen.name === 'wordEditor') {
    const editing = screen.wordId ? (userWordById.get(screen.wordId) ?? null) : null;
    content = (
      <WordEditorScreen
        api={api}
        editing={editing}
        error={error}
        busy={busy}
        onCancel={() => {
          setError(null);
          setScreen({ name: 'myWords' });
        }}
        onSave={(draft: UserWordDraft) =>
          void runContentAction(
            () => (editing ? api.updateUserWord(editing.id, draft) : api.createUserWord(draft)),
            () => setScreen({ name: 'myWords' })
          )
        }
      />
    );
  } else if (screen.name === 'setEditor') {
    const editingSet = screen.setId ? (sets.find((s) => s.id === screen.setId) ?? null) : null;
    content = (
      <SetEditorScreen
        library={library}
        userWords={userWords}
        editing={editingSet}
        error={error}
        busy={busy}
        onCancel={() => {
          setError(null);
          setScreen({ name: 'myWords' });
        }}
        onSave={(draft: SetDraft) =>
          void runContentAction(
            () => (editingSet ? api.updateSet(editingSet.id, draft) : api.createSet(draft)),
            () => setScreen({ name: 'myWords' })
          )
        }
      />
    );
  } else if (screen.name === 'score' && session) {
    content = (
      <ScoreScreen
        session={session}
        library={library}
        players={players}
        savedAwards={savedAwards}
        onAgain={() => startGame(session.themeId)}
        onMenu={() => {
          setSession(null);
          setScreen({ name: 'menu' });
        }}
      />
    );
  }

  return (
    <div
      data-testid="words-runtime"
      data-screen={screen.name}
      style={{
        width,
        height,
        background: '#0f1c18',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <div
        data-scene=""
        data-scene-size={`${sceneWidth}x${sceneHeight}`}
        style={{
          width: sceneWidth,
          height: sceneHeight,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          // Цвет экрана — из настроек педагога (ТЗ раздел 6)
          background: SCREEN_THEME_COLORS[settings.screenTheme]?.bg ?? palette.bg,
          color: palette.text,
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {content}

        {/* Окно пароля живёт в рантайме, а не в меню: закрытых разделов два,
            и правило входа должно быть одно на оба. */}
        {gate && (
          <PasswordPrompt
            sectionTitle={gate.title}
            onCheck={async (password) => {
              if (!api) return false;
              const res = await api.checkTeacherPassword(password);
              return res.ok === true && res.data?.ok === true;
            }}
            onCancel={() => setGate(null)}
            onSuccess={() => {
              const target = gate.screen;
              setGate(null);
              setScreen(target);
            }}
          />
        )}

        {/* Смена пароля. Тот же компонент, но проверка заменена на запись:
            подтверждать старый пароль здесь незачем — педагог уже прошёл
            рубеж, иначе он не попал бы в настройки. */}
        {changingPassword && (
          <PasswordPrompt
            sectionTitle="Новый пароль"
            onCheck={async (password) => {
              if (!api) return false;
              const res = await api.setTeacherPassword(password);
              if (!res.ok) {
                setError(res.error ?? 'Не удалось сменить пароль');
                return false;
              }
              setDefaultPassword(res.data?.isDefault ?? false);
              return true;
            }}
            onCancel={() => setChangingPassword(false)}
            onSuccess={() => setChangingPassword(false)}
          />
        )}
        {context?.isFallback && (
          <div
            style={{
              position: 'absolute',
              bottom: 8,
              right: 12,
              fontSize: 14,
              color: palette.textMuted,
            }}
          >
            данные занятия сохраняются в профиль пользователя: нет прав на общий каталог
          </div>
        )}
      </div>
    </div>
  );
};

export default WordsRuntime;
