// packages/player/src/inophone/InophoneRuntime.tsx
// Рантайм виджета «Инофон» (Тип 4): состояние, маршрутизация экранов, запись
// результатов.
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
// Сцена ЗАПОЛНЯЕТ окно, а не сидит в коробке 1280×800 с полями: логический
// размер берётся из реального, делённого на масштаб.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { InophoneWidgetProperties } from '@kiosk/shared';
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
  Profile,
} from './types';
import ProfilesScreen from './screens/ProfilesScreen';
import CatalogueScreen from './screens/CatalogueScreen';
import DiagnosticsScreen from './screens/DiagnosticsScreen';

/** Логический размер сцены: 16:10, как у подложек (см. INOPHONE_DEFAULT_SIZE) */
const SCENE_MIN_WIDTH = 1280;
const SCENE_MIN_HEIGHT = 800;

interface Props {
  properties: Partial<InophoneWidgetProperties>;
  width: number;
  height: number;
}

type Screen = { name: 'profiles' } | { name: 'catalogue' } | { name: 'diagnostics' };

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
  const [settings, setSettings] = useState<InophoneSettings | null>(null);
  const [, setStatistics] = useState<InophoneStatistics>({});
  const [screenRaw, setScreenRaw] = useState<Screen>({ name: 'profiles' });
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * Смена экрана ГАСИТ сообщение.
   *
   * Взято из Типа 3, где отсутствие этого нашли живым прогоном: «Игрок уже
   * есть в списке» из экрана профилей висело над статистикой и настройками до
   * конца работы приложения. Сообщение относится к действию, а действие
   * кончилось вместе с экраном.
   */
  const setScreen = useCallback((next: Screen) => {
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
        setNotice('Ученик удалён вместе со своими результатами');
      }
    },
    [platform, selectedId, unwrap]
  );

  const interfaceLanguage = settings?.interfaceLanguage ?? props.interfaceLanguage;

  const scale = Math.min(width / SCENE_MIN_WIDTH, height / SCENE_MIN_HEIGHT);
  const sceneWidth = Math.max(SCENE_MIN_WIDTH, Math.round(width / scale));
  const sceneHeight = Math.max(SCENE_MIN_HEIGHT, Math.round(height / scale));

  const selected = profiles.find((p) => p.id === selectedId) ?? null;

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
            quotas={context?.quotas ?? null}
          />
        );
      case 'catalogue':
      default:
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
            onOpenScene={() => {
              // Экран сцены появляется в Фазе 3. Сообщение ЧЕСТНОЕ: молчащая
              // кнопка читается как поломка, а не как «ещё не сделано»
              setNotice('Экран сцены появится в следующей версии сборки');
            }}
            onBack={() => setScreen({ name: 'profiles' })}
            right={
              <BigButton onClick={() => setScreen({ name: 'diagnostics' })} tone="secondary">
                Сведения о пакете
              </BigButton>
            }
          />
        );
    }
  };

  return (
    <div
      data-testid="inophone-runtime"
      style={{
        width,
        height,
        overflow: 'hidden',
        background: SCREEN_THEME_COLORS.night,
      }}
    >
      <div
        data-scene={screenRaw.name}
        data-scene-size={`${sceneWidth}x${sceneHeight}`}
        style={{
          width: sceneWidth,
          height: sceneHeight,
          position: 'relative',
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          padding: 32,
          gap: 14,
          color: palette.text,
          fontFamily: 'system-ui, sans-serif',
          overflowY: 'auto',
        }}
      >
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

        {screenRaw.name !== 'profiles' && error && <Banner text={error} tone="error" />}
        {screenRaw.name !== 'profiles' && notice && <Banner text={notice} tone="notice" />}

        <div style={{ flex: 1, minHeight: 0 }}>{body()}</div>
      </div>
    </div>
  );
};

export default InophoneRuntime;
export { SCENE_MIN_WIDTH, SCENE_MIN_HEIGHT };
