// packages/player/src/words/screens/MenuScreen.tsx
// Главное меню. Состав пунктов — как у эталона: одиночная игра,
// многопользовательская игра, игроки, настройки.

import React from 'react';
import { BigButton, ErrorBanner, palette } from '../ui';
import Character from '../components/Character';
import type { Profile } from '../types';

interface Props {
  title: string;
  profiles: Profile[];
  selectedProfileIds: string[];
  error: string | null;
  onSingle: () => void;
  onMulti: () => void;
  onPlayers: () => void;
  onSettings: () => void;
  onMyWords: () => void;
}

const MenuScreen: React.FC<Props> = ({
  title,
  profiles,
  selectedProfileIds,
  error,
  onSingle,
  onMulti,
  onPlayers,
  onSettings,
  onMyWords,
}) => {
  const enoughForMulti = profiles.length >= 2;
  const chosen = profiles.filter((p) => selectedProfileIds.includes(p.id));

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        color: palette.text,
        padding: 36,
        boxSizing: 'border-box',
      }}
    >
      <h1 style={{ margin: 0, fontSize: 52 }}>{title}</h1>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 40 }}>
        <Character kind="girl" mood="idle" size={150} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 420 }}>
          <ErrorBanner text={error} />

          <BigButton onClick={onSingle} wide testId="menu-single">
            Одиночная игра
          </BigButton>

          <BigButton onClick={onMulti} wide disabled={!enoughForMulti} testId="menu-multi">
            Играть вместе
          </BigButton>
          {!enoughForMulti && (
            <div style={{ fontSize: 18, color: palette.textMuted }}>
              Чтобы играть вместе, добавьте хотя бы двух игроков
            </div>
          )}

          <BigButton onClick={onPlayers} wide tone="secondary" testId="menu-players">
            Игроки ({profiles.length})
          </BigButton>

          <BigButton onClick={onMyWords} wide tone="secondary" testId="menu-my-words">
            Мои слова
          </BigButton>

          <BigButton onClick={onSettings} wide tone="secondary" testId="menu-settings">
            Настройки
          </BigButton>

          <div data-testid="chosen-players" style={{ fontSize: 20, color: palette.textMuted }}>
            {chosen.length > 0
              ? `Играют: ${chosen.map((p) => p.name).join(', ')}`
              : 'Игрок не выбран — партия пойдёт как гостевая'}
          </div>
        </div>

        <Character kind="boy" mood="idle" size={150} />
      </div>
    </div>
  );
};

export default MenuScreen;
