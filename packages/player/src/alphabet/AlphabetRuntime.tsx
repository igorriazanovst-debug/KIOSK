// packages/player/src/alphabet/AlphabetRuntime.tsx
// Рантайм виджета «АзбукоСлов» (Тип 3).
//
// ФАЗА 1 — ВЕРТИКАЛЬНЫЙ СРЕЗ: виджет → окно → диск. Игровых экранов здесь
// ещё нет, и это осознанно: сначала проверяется, что данные доходят до диска
// и переживают перезапуск, а уже потом на этот путь навешивается игра.
// Критерий выхода фазы — создать профиль, перезапустить приложение, увидеть
// профиль на месте.
//
// МАСШТАБИРОВАНИЕ СЦЕНЫ — тот же приём, что в Тип 2 и у эталона: интерфейс
// вёрстан в логических пикселях, а сцена целиком растягивается трансформом.
// Иначе пришлось бы пересчитывать каждый шрифт и отступ под размер окна, а
// диапазон тут от планшета до 4K-доски.
//
// Сцена ЗАПОЛНЯЕТ окно, а не сидит в коробке 1024×768 с полями: логический
// размер берётся из реального, делённого на масштаб, и потому не бывает
// меньше минимума. Это исправление из Тип 2 — там сцена сначала оставляла
// чёрные поля на широких экранах.

import React, { useEffect, useMemo, useState } from 'react';
import type { AlphabetWidgetProperties } from '@kiosk/shared';
import { ALPHABET_DEFAULT_PROPS, ALPHABET_STAGE_HINTS, ALPHABET_STAGE_TITLES, ALPHABET_STAGES } from '@kiosk/shared';
import { BigButton, Panel, ScrollArea, SCREEN_THEME_COLORS, palette } from './ui';
import { createElectronPlatform } from './platform/electronPlatform';
import { createWebPlatform } from './platform/webPlatform';
import { detectPlatformKind, setAlphabetPlatform } from './platform/AlphabetPlatform';
import type { AlphabetPlatform } from './platform/AlphabetPlatform';
import type { AlphabetContext, Profile } from './types';

const SCENE_MIN_WIDTH = 1024;
const SCENE_MIN_HEIGHT = 768;

interface Props {
  properties: Partial<AlphabetWidgetProperties>;
  width: number;
  height: number;
}

type Screen = 'profiles' | 'menu';

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
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>('profiles');
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const title = properties.title || 'АзбукоСлов';

  const reloadProfiles = React.useCallback(async () => {
    const result = await platform.listProfiles();
    if (result.ok) {
      setProfiles(result.data ?? []);
      setError(null);
    } else {
      // Повреждённый файл профилей — это ОШИБКА, а не «список пуст»:
      // молча обнулившийся список выглядит как потеря работы детей
      setError(result.error ?? 'Не удалось прочитать список игроков');
    }
  }, [platform]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ctx = await platform.getContext();
      if (!cancelled && ctx.ok) setContext(ctx.data ?? null);
      await reloadProfiles();
    })();
    return () => {
      cancelled = true;
    };
  }, [platform, reloadProfiles]);

  const scale = Math.min(width / SCENE_MIN_WIDTH, height / SCENE_MIN_HEIGHT);
  const sceneWidth = Math.max(SCENE_MIN_WIDTH, Math.round(width / scale));
  const sceneHeight = Math.max(SCENE_MIN_HEIGHT, Math.round(height / scale));

  const handleCreate = async () => {
    const result = await platform.createProfile(newName);
    if (!result.ok) {
      setError(result.error ?? 'Не удалось добавить игрока');
      return;
    }
    setNewName('');
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

  const selected = profiles.find((p) => p.id === selectedId) ?? null;
  const background = SCREEN_THEME_COLORS.sky;

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
        data-scene={screen}
        data-scene-size={`${sceneWidth}x${sceneHeight}`}
        style={{
          width: sceneWidth,
          height: sceneHeight,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          padding: 36,
          gap: 20,
          color: palette.text,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <header style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
          <h1 data-testid="alphabet-title" style={{ margin: 0, fontSize: 44 }}>
            {title}
          </h1>
          {selected && (
            <span data-testid="alphabet-current-player" style={{ fontSize: 24, color: palette.textDim }}>
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
              padding: '12px 20px',
              fontSize: 20,
            }}
          >
            {error}
          </div>
        )}

        {screen === 'profiles' && (
          <Panel testId="alphabet-profiles">
            <h2 style={{ margin: 0, fontSize: 28 }}>Кто занимается?</h2>

            <ScrollArea testId="alphabet-profile-list">
              {profiles.length === 0 && (
                <p style={{ fontSize: 20, color: palette.textDim, margin: 0 }}>
                  Пока никого нет. Добавьте первого игрока.
                </p>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {profiles.map((profile) => (
                  <div
                    key={profile.id}
                    data-testid={`alphabet-profile-${profile.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      background:
                        profile.id === selectedId ? palette.accent : 'rgba(255,255,255,0.12)',
                      color: profile.id === selectedId ? palette.textDark : palette.text,
                      borderRadius: 14,
                      padding: '10px 14px',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(profile.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'inherit',
                        fontSize: 22,
                        cursor: 'pointer',
                      }}
                    >
                      {profile.name}
                    </button>
                    <button
                      type="button"
                      aria-label={`Удалить ${profile.name}`}
                      data-testid={`alphabet-profile-delete-${profile.id}`}
                      onClick={() => handleDelete(profile.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'inherit',
                        fontSize: 20,
                        cursor: 'pointer',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <input
                data-testid="alphabet-new-profile-name"
                value={newName}
                placeholder="Имя игрока"
                onChange={(e) => setNewName(e.target.value)}
                style={{
                  flex: 1,
                  fontSize: 22,
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: 'none',
                }}
              />
              <BigButton onClick={handleCreate} testId="alphabet-add-profile">
                Добавить
              </BigButton>
            </div>

            <BigButton
              onClick={() => setScreen('menu')}
              wide
              disabled={!selected}
              testId="alphabet-to-menu"
            >
              {selected ? `Начать: ${selected.name}` : 'Выберите игрока'}
            </BigButton>
          </Panel>
        )}

        {screen === 'menu' && (
          <Panel testId="alphabet-menu">
            <h2 style={{ margin: 0, fontSize: 28 }}>Выберите этап</h2>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {ALPHABET_STAGES.map((stage) => (
                <div
                  key={stage}
                  data-testid={`alphabet-stage-${stage}`}
                  style={{
                    background: 'rgba(255,255,255,0.12)',
                    borderRadius: 16,
                    padding: 20,
                    minWidth: 220,
                  }}
                >
                  <div style={{ fontSize: 40, fontWeight: 800, color: palette.accent }}>
                    {ALPHABET_STAGE_HINTS[stage]}
                  </div>
                  <div style={{ fontSize: 22 }}>{ALPHABET_STAGE_TITLES[stage]}</div>
                </div>
              ))}
            </div>

            {/* Пока этапы не построены, честно говорим об этом вместо
                неработающих кнопок: недоступная кнопка без объяснения на
                занятии хуже отсутствующей */}
            <p data-testid="alphabet-stub-note" style={{ fontSize: 20, color: palette.textDim }}>
              Игровые экраны появятся на следующем этапе разработки.
            </p>

            <BigButton onClick={() => setScreen('profiles')} tone="secondary" testId="alphabet-back">
              ← К игрокам
            </BigButton>
          </Panel>
        )}

        <footer style={{ fontSize: 16, color: palette.textDim }}>
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
        </footer>
      </div>
    </div>
  );
};

export default AlphabetRuntime;
export { SCENE_MIN_WIDTH, SCENE_MIN_HEIGHT, ALPHABET_DEFAULT_PROPS };
