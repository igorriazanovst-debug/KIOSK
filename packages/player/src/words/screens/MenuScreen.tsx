// packages/player/src/words/screens/MenuScreen.tsx
// Главное меню. Состав пунктов — как у эталона: одиночная игра,
// многопользовательская игра, игроки, настройки.
//
// РАЗДЕЛЫ ПЕДАГОГА ЗА ПАРОЛЕМ (ТЗ раздел 3). «Мои слова» и «Настройки»
// меняют материалы занятия и параметры приложения.
//
// Прежний рубеж — удержать кнопку две секунды и подтвердить — заменён на
// пароль по решению пользователя от 13.09.2026. Удержание защищало только от
// СЛУЧАЙНОГО попадания и не мешало ребёнку, который подсмотрел, как это
// делает педагог. Пароль закрывает оба случая, поэтому держать два рубежа
// подряд значило бы просто мешать взрослому.

import React from 'react';
import { BigButton, ErrorBanner, palette } from '../ui';
import OwlHelper from '../components/OwlHelper';

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
        position: 'relative',
      }}
    >
      <h1 style={{ margin: 0, fontSize: 52 }}>{title}</h1>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 40 }}>
        <OwlHelper
          mood="idle"
          size={170}
          hint={
            enoughForMulti
              ? 'Привет! Выбери, кто играет, и нажми «Играть вместе». Или начни одиночную игру.'
              : 'Привет! Нажми «Одиночная игра», чтобы начать. А чтобы играть вдвоём, сначала добавь игроков.'
          }
          bubbleSide="right"
          testId="owl-menu"
        />

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
            🔒 Мои слова
          </BigButton>

          <BigButton onClick={onSettings} wide tone="secondary" testId="menu-settings">
            🔒 Настройки
          </BigButton>

          <div data-testid="chosen-players" style={{ fontSize: 20, color: palette.textMuted }}>
            {chosen.length > 0
              ? `Играют: ${chosen.map((p) => p.name).join(', ')}`
              : 'Игрок не выбран — партия пойдёт как гостевая'}
          </div>
        </div>

      </div>
    </div>
  );
};

export default MenuScreen;
