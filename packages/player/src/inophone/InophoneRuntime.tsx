// packages/player/src/inophone/InophoneRuntime.tsx
// Рантайм виджета «Инофон» (Тип 4): состояние, маршрутизация экранов, ход
// партии, запись результатов.
//
// ИГРОВЫЕ ПРАВИЛА ЗДЕСЬ НЕ ЖИВУТ. Отбор заданий, проверка ответа, очерёдность
// и слияние статистики — в @kiosk/shared (пространство имён inophone), потому
// что продукт по ТЗ (строка 84) выходит на две платформы, а Electron под
// Android не работает. Здесь остаётся только то, что нельзя разделить с
// нативной реализацией: React-состояние и вёрстка.
//
// МАСШТАБИРОВАНИЕ СЦЕНЫ — интерфейс вёрстан в логических пикселях, сцена
// целиком растягивается трансформом. Диапазон устройств от планшета до
// 4K-доски, и пересчитывать каждый шрифт под размер окна значило бы
// переписывать вёрстку при каждой правке.
//
// ПОВОРОТ К ИГРОКУ — ВМЕСТЕ С ПОЛЕМ, а не отдельной накладкой. Требование
// пользователя по Типу 2, перенесённое сюда дословно: при переходе хода
// поворачивается вся сцена вместе с верхней полосой, иначе сидящий слева
// читает «Ходит: Аня» вверх ногами.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { inophone, seatRotationFor } from '@kiosk/shared';
import type { InophoneWidgetProperties, InophoneScreenMode } from '@kiosk/shared';
import { INOPHONE_DEFAULT_PROPS } from '@kiosk/shared';

import { SCREEN_THEME_COLORS, Banner, BigButton, palette } from './ui';
import { createElectronPlatform } from './platform/electronPlatform';
import { createWebPlatform } from './platform/webPlatform';
import { detectPlatformKind, setInophonePlatform } from './platform/InophonePlatform';
import type { InophonePlatform } from './platform/InophonePlatform';
import type {
  InophoneContext,
  InophoneLibrary,
  InophoneSettings,
  InophoneStatistics,
  IpcResult,
  LanguageCode,
  Profile,
  TallyByLanguage,
} from './types';
import { speak, speakSequence, stopSpeech } from './audio';
import ProfilesScreen from './screens/ProfilesScreen';
import CatalogueScreen from './screens/CatalogueScreen';
import DiagnosticsScreen from './screens/DiagnosticsScreen';
import SetupScreen, { type SetupValues } from './screens/SetupScreen';
import SceneScreen from './screens/SceneScreen';
import ResultsScreen from './screens/ResultsScreen';
import DictionaryScreen from './screens/DictionaryScreen';
import SettingsScreen from './screens/SettingsScreen';
import StatisticsScreen from './screens/StatisticsScreen';

/** Логический размер сцены: 16:10, как у подложек (см. INOPHONE_DEFAULT_SIZE) */
const SCENE_MIN_WIDTH = 1280;
const SCENE_MIN_HEIGHT = 800;

/** Сколько держать показ ответа перед следующим ходом, мс */
const VERDICT_HOLD_MS = 900;

interface Props {
  properties: Partial<InophoneWidgetProperties>;
  width: number;
  height: number;
}

type Screen =
  | { name: 'profiles' }
  | { name: 'catalogue' }
  | { name: 'setup'; sceneId: string }
  | { name: 'scene'; sceneId: string }
  | { name: 'results'; sceneId: string }
  | { name: 'dictionary' }
  | { name: 'settings' }
  | { name: 'statistics' }
  | { name: 'diagnostics' };

type Session = ReturnType<typeof inophone.buildInophoneSession>;

function createPlatform(): InophonePlatform {
  if (detectPlatformKind() === 'electron' && window.inophoneAPI) {
    return createElectronPlatform(window.inophoneAPI);
  }
  return createWebPlatform();
}

const InophoneRuntime: React.FC<Props> = ({ properties, width, height }) => {
  const platform = useMemo(() => {
    const created = createPlatform();
    setInophonePlatform(created);
    return created;
  }, []);

  const props = { ...INOPHONE_DEFAULT_PROPS, ...properties };

  const [context, setContext] = useState<InophoneContext | null>(null);
  const [library, setLibrary] = useState<InophoneLibrary | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settings, setSettings] = useState<InophoneSettings>({
    ...inophone.DEFAULT_INOPHONE_SETTINGS,
    interfaceLanguage: props.interfaceLanguage,
    studyLanguages: [...props.studyLanguages],
    volume: props.volume,
  });
  const [statistics, setStatistics] = useState<InophoneStatistics>({});
  const [screenRaw, setScreenRaw] = useState<Screen>({ name: 'profiles' });
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [setup, setSetup] = useState<SetupValues>({
    mode: props.defaultMode,
    playerIds: [],
    questionsPerPlayer: props.questionCount,
    presentation: inophone.DEFAULT_PRESENTATION,
  });
  const [session, setSession] = useState<Session | null>(null);
  const [openedConceptId, setOpenedConceptId] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<{ conceptId: string; correct: boolean } | null>(null);
  /**
   * Счёт партии по ИГРОКАМ и языкам — то, что уйдёт в статистику по окончании.
   *
   * По игрокам, а не одной кучей: в соревновании за доской стоят двое-четверо,
   * и записать партию только выбранному ученику значило бы приписать ему чужие
   * ответы, а остальным — не записать ничего. Поймано живым прогоном
   * соревнования: сводка Ани показала пять ответов, из которых половина была
   * Бориса.
   */
  const byPlayer = useRef<Record<string, Record<string, [number, number]>>>({});

  /**
   * Смена экрана ГАСИТ сообщение и ЗВУК.
   *
   * Сообщение — потому что оно относится к действию, а действие кончилось
   * вместе с экраном (найдено живым прогоном Типа 3: «Игрок уже есть в списке»
   * висело над статистикой до конца работы приложения). Звук — потому что
   * произношение, догоняющее пользователя на другом экране, читается как сбой.
   */
  const setScreen = useCallback((next: Screen) => {
    stopSpeech();
    setError(null);
    setNotice(null);
    setScreenRaw(next);
  }, []);

  /** Разворачивает ответ моста, превращая ok:false в сообщение на экране */
  const unwrap = useCallback(<T,>(res: IpcResult<T>): T | null => {
    if (!res.ok) {
      setError(res.error ?? 'Не удалось выполнить действие');
      return null;
    }
    return (res.data ?? null) as T | null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [ctx, lib, profs, sets, stats] = await Promise.all([
        platform.getContext(),
        platform.getLibrary(),
        platform.listProfiles(),
        platform.getSettings(),
        platform.getStatistics(),
      ]);
      if (cancelled) return;
      if (ctx.ok && ctx.data) setContext(ctx.data);
      if (lib.ok && lib.data) setLibrary(lib.data);
      if (profs.ok && profs.data) setProfiles(profs.data);

      // ОТКАЗ ПРИ ЗАГРУЗКЕ НЕ МОЛЧИТ. Первая версия просто не присваивала
      // данные, и повреждённый profiles.json выглядел на экране как ПУСТОЙ
      // СПИСОК — то есть как потеря работы детей. Хранилище бросает внятную
      // ошибку про резервную копию, а рантайм её проглатывал; поймано
      // разделом 10 программы испытаний, а не тестом.
      const startupError = [profs, sets, stats].find((r) => !r.ok)?.error;
      if (startupError) setError(startupError);
      // Настройки, сохранённые на устройстве, важнее выставленных педагогом в
      // редакторе: их меняли позже и осознанно, уже на этой машине
      if (sets.ok && sets.data) setSettings(sets.data);
      if (stats.ok && stats.data) setStatistics(stats.data);
      // Ошибка чтения библиотеки не молчит: белый экран педагог передать
      // администратору не может, а текст — может
      if (ctx.ok && ctx.data?.libraryError) setError(ctx.data.libraryError);
    })();
    return () => {
      cancelled = true;
    };
  }, [platform]);

  // ─── профили ───────────────────────────────────────────────────────────

  const createProfile = useCallback(async () => {
    setBusy(true);
    const res = unwrap(await platform.createProfile(newName));
    setBusy(false);
    if (res) {
      setProfiles(res);
      setNewName('');
      setNotice('Ученик добавлен');
    }
  }, [platform, newName, unwrap]);

  const deleteProfile = useCallback(
    async (profileId: string) => {
      setBusy(true);
      const res = unwrap(await platform.deleteProfile(profileId));
      setBusy(false);
      if (res) {
        setProfiles(res);
        if (selectedId === profileId) setSelectedId(null);
        setSetup((s) => ({ ...s, playerIds: s.playerIds.filter((p) => p !== profileId) }));
        setNotice('Ученик удалён вместе со своими результатами');
      }
    },
    [platform, selectedId, unwrap]
  );

  // ─── настройки ─────────────────────────────────────────────────────────

  const changeSettings = useCallback(
    (next: InophoneSettings) => {
      setSettings(next);
      // Сохраняем сразу, а не по кнопке «Применить»: настройка, потерянная
      // из-за незамеченной кнопки, — это занятие не на том языке
      void platform.saveSettings(next);
    },
    [platform]
  );

  // ─── партия ────────────────────────────────────────────────────────────

  const interfaceLanguage = settings.interfaceLanguage;
  const studyLanguages = settings.studyLanguages;

  const nameOf = useCallback(
    (playerId: string) => profiles.find((p) => p.id === playerId)?.name ?? '—',
    [profiles]
  );

  /**
   * Язык текущего задания.
   *
   * Языки чередуются ПО ХОДАМ, а не выбираются случайно: при трёх изучаемых
   * языках и десяти вопросах случай легко даёт восемь вопросов на одном языке
   * и один на другом, и сводка «по языкам» после такой партии ничего не
   * говорит. Чередование даёт каждому языку равную долю.
   */
  const taskLanguage = useCallback(
    (s: Session): LanguageCode => {
      const turn = s.questionIndex * s.playerIds.length + s.playerIndex;
      return studyLanguages[turn % studyLanguages.length];
    },
    [studyLanguages]
  );

  const sayTask = useCallback(
    (s: Session) => {
      if (!library || !setup.presentation.audio) return;
      const conceptId = inophone.currentConceptId(s);
      if (!conceptId) return;
      const code = taskLanguage(s);
      const t = inophone.translationOf(library, conceptId, code);
      void speak(conceptId, code, !!t?.hasAudio, { volume: settings.volume });
    },
    [library, setup.presentation.audio, taskLanguage, settings.volume]
  );

  const startGame = useCallback(
    (sceneId: string) => {
      if (!library) return;
      if (setup.mode === 'learning') {
        setSession(null);
        setScreen({ name: 'scene', sceneId });
        return;
      }
      try {
        const built = inophone.buildInophoneSession(library, {
          roundId: `${Date.now()}`,
          mode: setup.mode,
          sceneId,
          playerIds: setup.playerIds,
          questionsPerPlayer: setup.questionsPerPlayer,
          rng: Math.random,
        });
        byPlayer.current = {};
        setSession(built);
        setVerdict(null);
        setScreen({ name: 'scene', sceneId });
        sayTask(built);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось начать партию');
      }
    },
    [library, setup, setScreen, sayTask]
  );

  /**
   * Записать итоги ВСЕХ участников партии, каждому в свой профиль.
   *
   * Записи идут по очереди, а не разом: каждая возвращает новое состояние
   * статистики целиком, и параллельные вызовы затёрли бы друг друга — второй
   * писал бы поверх состояния, прочитанного до первого.
   */
  const recordAndFinish = useCallback(
    async (finished: Session) => {
      let latest: InophoneStatistics | null = null;
      for (const playerId of finished.playerIds) {
        const tally = byPlayer.current[playerId];
        // Игрок без единого ответа не пишется вовсе: пустая запись выглядела
        // бы в сводке как состоявшаяся партия с нулём верных
        if (!tally || Object.keys(tally).length === 0) continue;
        const res = unwrap(
          await platform.recordSession(playerId, finished.sceneId, tally as TallyByLanguage)
        );
        if (res) latest = res;
      }
      if (latest) setStatistics(latest);
      setScreen({ name: 'results', sceneId: finished.sceneId });
    },
    [platform, unwrap, setScreen]
  );

  const pick = useCallback(
    (conceptId: string) => {
      // Обучение: щелчок открывает карточку и произносит слово на всех
      // изучаемых языках подряд — это и есть «все объекты подсвечены»
      if (!session) {
        if (!library) return;
        setOpenedConceptId(conceptId);
        void speakSequence(
          studyLanguages.map((code) => ({
            conceptId,
            code,
            hasAudio: !!inophone.translationOf(library, conceptId, code)?.hasAudio,
          })),
          { volume: settings.volume }
        );
        return;
      }

      if (verdict) return;
      const code = taskLanguage(session);
      const playerId = inophone.currentPlayerId(session);
      const outcome = inophone.answer(session, conceptId);
      const mine = byPlayer.current[playerId] ?? (byPlayer.current[playerId] = {});
      const tally = mine[code] ?? [0, 0];
      mine[code] = [tally[0] + (outcome.correct ? 1 : 0), tally[1] + 1];

      // Показываем ЗАГАДАННЫЙ объект, а не нажатый: ученик должен увидеть, где
      // было правильно, иначе ошибка ничему не учит
      const expected = inophone.currentConceptId(session);
      setVerdict({ conceptId: expected ?? conceptId, correct: outcome.correct });

      window.setTimeout(() => {
        setVerdict(null);
        const next = inophone.clearLastAnswer(outcome.session);
        setSession(next);
        if (outcome.sessionFinished) void recordAndFinish(next);
        else sayTask(next);
      }, VERDICT_HOLD_MS);
    },
    [session, library, studyLanguages, settings.volume, verdict, taskLanguage, recordAndFinish, sayTask]
  );

  const speakOne = useCallback(
    (conceptId: string, code: LanguageCode) => {
      if (!library) return;
      const t = inophone.translationOf(library, conceptId, code);
      void speak(conceptId, code, !!t?.hasAudio, { volume: settings.volume });
    },
    [library, settings.volume]
  );

  // ─── геометрия ─────────────────────────────────────────────────────────

  // Поворот к игроку — только в партии и только когда игроков больше одного:
  // одиночная игра за столом не сидит
  const seatAngle =
    screenRaw.name === 'scene' && session && session.playerIds.length > 1
      ? seatRotationFor(session.playerIndex, session.playerIds.length)
      : 0;
  const quarterTurn = seatAngle === 90 || seatAngle === -90;
  const boxWidth = quarterTurn ? height : width;
  const boxHeight = quarterTurn ? width : height;

  const scale = Math.min(boxWidth / SCENE_MIN_WIDTH, boxHeight / SCENE_MIN_HEIGHT);
  const sceneWidth = Math.max(SCENE_MIN_WIDTH, Math.round(boxWidth / scale));
  const sceneHeight = Math.max(SCENE_MIN_HEIGHT, Math.round(boxHeight / scale));

  const selected = profiles.find((p) => p.id === selectedId) ?? null;
  const sceneOf = (sceneId: string) => library?.scenes.find((s) => s.id === sceneId) ?? null;
  const titleOf = (sceneId: string) => {
    const scene = sceneOf(sceneId);
    return scene ? inophone.localTitle(scene.titles, interfaceLanguage) : sceneId;
  };

  // ─── экраны ────────────────────────────────────────────────────────────

  const menuButtons = (
    <div style={{ display: 'flex', gap: 12 }}>
      <BigButton onClick={() => setScreen({ name: 'dictionary' })} tone="secondary" testId="inophone-open-dictionary">
        Словарь
      </BigButton>
      <BigButton onClick={() => setScreen({ name: 'statistics' })} tone="secondary" testId="inophone-open-stats">
        Результаты
      </BigButton>
      <BigButton onClick={() => setScreen({ name: 'settings' })} tone="secondary" testId="inophone-open-settings">
        Настройки
      </BigButton>
      <BigButton onClick={() => setScreen({ name: 'diagnostics' })} tone="secondary">
        О пакете
      </BigButton>
    </div>
  );

  const body = () => {
    switch (screenRaw.name) {
      case 'profiles':
        return (
          <ProfilesScreen
            profiles={profiles}
            newName={newName}
            onNewNameChange={setNewName}
            onCreate={createProfile}
            onDelete={deleteProfile}
            onChoose={(id) => {
              setSelectedId(id);
              // Выбранный ученик по умолчанию и играет: в одиночной работе это
              // избавляет от второго выбора того же человека
              setSetup((s) => ({ ...s, playerIds: [id] }));
              setScreen({ name: 'catalogue' });
            }}
            error={error}
            notice={notice}
            busy={busy}
          />
        );

      case 'diagnostics':
        return (
          <DiagnosticsScreen
            onBack={() => setScreen({ name: 'catalogue' })}
            baseDir={context?.baseDir ?? '—'}
            isFallback={context?.isFallback ?? false}
            libraryError={context?.libraryError ?? null}
            completeness={context?.completeness ?? null}
            geometry={context?.geometry ?? null}
            quotas={context?.quotas ?? null}
          />
        );

      case 'settings':
        return (
          <SettingsScreen
            settings={settings}
            onChange={changeSettings}
            onBack={() => setScreen({ name: 'catalogue' })}
          />
        );

      case 'statistics':
        return (
          <StatisticsScreen
            statistics={statistics}
            profileId={selectedId}
            profileName={selected?.name ?? '—'}
            library={library}
            interfaceLanguage={interfaceLanguage}
            onClear={async () => {
              if (!selectedId) return;
              const res = unwrap(await platform.clearStatistics(selectedId));
              if (res) {
                setStatistics(res);
                setNotice('Результаты очищены');
              }
            }}
            onBack={() => setScreen({ name: 'catalogue' })}
          />
        );

      case 'dictionary':
        if (!library) break;
        return (
          <DictionaryScreen
            library={library}
            interfaceLanguage={interfaceLanguage}
            studyLanguages={studyLanguages}
            onSpeak={speakOne}
            onBack={() => setScreen({ name: 'catalogue' })}
          />
        );

      case 'setup':
        return (
          <SetupScreen
            sceneTitle={titleOf(screenRaw.sceneId)}
            profiles={profiles}
            values={setup}
            onChange={setSetup}
            onStart={() => startGame(screenRaw.sceneId)}
            onBack={() => setScreen({ name: 'catalogue' })}
          />
        );

      case 'scene': {
        const scene = sceneOf(screenRaw.sceneId);
        if (!scene || !library) break;
        const tally = session ? session.tally[inophone.currentPlayerId(session)] : null;
        const conceptId = session ? inophone.currentConceptId(session) : null;
        return (
          <SceneScreen
            scene={scene}
            library={library}
            mode={setup.mode as InophoneScreenMode as 'learning' | inophone.InophoneMode}
            interfaceLanguage={interfaceLanguage}
            studyLanguages={studyLanguages}
            currentPlayerName={
              session && session.playerIds.length > 1
                ? nameOf(inophone.currentPlayerId(session))
                : null
            }
            progress={
              session
                ? { done: session.questionIndex, total: session.questionsPerPlayer }
                : null
            }
            score={tally ? { success: tally.success, fail: tally.fail } : null}
            task={session && conceptId ? { conceptId, language: taskLanguage(session) } : null}
            presentation={setup.presentation}
            verdict={verdict}
            openedConceptId={openedConceptId}
            onPick={pick}
            onCloseCard={() => {
              stopSpeech();
              setOpenedConceptId(null);
            }}
            onSpeak={speakOne}
            onRepeatTask={() => session && sayTask(session)}
            onExit={() => {
              setSession(null);
              setOpenedConceptId(null);
              setVerdict(null);
              setScreen({ name: 'catalogue' });
            }}
          />
        );
      }

      case 'results': {
        if (!session) break;
        return (
          <ResultsScreen
            sceneTitle={titleOf(screenRaw.sceneId)}
            results={inophone.results(session)}
            winners={inophone.winners(session)}
            nameOf={nameOf}
            showWinners={session.mode === 'challenge'}
            onAgain={() => startGame(screenRaw.sceneId)}
            onBack={() => {
              setSession(null);
              setScreen({ name: 'catalogue' });
            }}
          />
        );
      }

      default:
        break;
    }

    // Каталог — и он же запасной экран, когда показывать нечего
    if (!library) {
      return (
        <div>
          <div style={{ fontSize: 22, color: palette.textDim, marginBottom: 20 }}>
            Пакет учебного контента не подключён — сцены показать не из чего.
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <BigButton onClick={() => setScreen({ name: 'diagnostics' })} tone="secondary">
              Сведения о пакете
            </BigButton>
            <BigButton onClick={() => setScreen({ name: 'profiles' })} tone="secondary">
              Сменить ученика
            </BigButton>
          </div>
        </div>
      );
    }
    return (
      <CatalogueScreen
        library={library}
        interfaceLanguage={interfaceLanguage}
        onOpenScene={(sceneId) => setScreen({ name: 'setup', sceneId })}
        onBack={() => setScreen({ name: 'profiles' })}
        right={menuButtons}
      />
    );
  };

  const onScene = screenRaw.name === 'scene';

  return (
    <div
      data-testid="inophone-runtime"
      style={{
        width,
        height,
        overflow: 'hidden',
        background: SCREEN_THEME_COLORS.night,
        position: 'relative',
      }}
    >
      <div
        data-scene={screenRaw.name}
        data-scene-size={`${sceneWidth}x${sceneHeight}`}
        data-seat-angle={seatAngle}
        style={{
          width: sceneWidth,
          height: sceneHeight,
          // Поворот вокруг ЦЕНТРА окна, а не левого верхнего угла: иначе
          // повёрнутая сцена уезжает за границы
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
          overflowY: onScene ? 'hidden' : 'auto',
        }}
      >
        {!onScene && (
          <header style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <h1 data-testid="inophone-title" style={{ margin: 0, fontSize: 38 }}>
              {props.title || 'Инофон'}
            </h1>
            {selected && (
              <span
                data-testid="inophone-current-player"
                style={{ fontSize: 22, color: palette.textDim }}
              >
                занимается {selected.name}
              </span>
            )}
          </header>
        )}

        {screenRaw.name !== 'profiles' && error && <Banner text={error} tone="error" />}
        {screenRaw.name !== 'profiles' && notice && <Banner text={notice} tone="notice" />}

        <div style={{ flex: 1, minHeight: 0 }}>{body()}</div>
      </div>
    </div>
  );
};

export default InophoneRuntime;
export { SCENE_MIN_WIDTH, SCENE_MIN_HEIGHT, VERDICT_HOLD_MS };
