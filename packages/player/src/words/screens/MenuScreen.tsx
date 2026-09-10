// packages/player/src/words/screens/MenuScreen.tsx
// Главное меню. Состав пунктов — как у эталона: одиночная игра,
// многопользовательская игра, игроки, настройки.
//
// РАЗДЕЛЫ ПЕДАГОГА ЗА УДЕРЖАНИЕМ. «Мои слова» и «Настройки» меняют материалы
// занятия и параметры приложения, и по ТЗ (раздел 3) ребёнок не должен
// попадать туда случайно. Пароля нет намеренно — профили детей не учётные
// записи, — поэтому рубеж другой: удержать кнопку две секунды и подтвердить.
// Случайный шлепок ладонью по столу этого не проходит, а педагог у доски не
// тратит время на ввод.

import React, { useState } from 'react';
import { BigButton, ErrorBanner, palette } from '../ui';
import Character from '../components/Character';
import HoldButton from '../components/HoldButton';
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

  /** Какой раздел педагога ждёт подтверждения после удержания */
  const [gate, setGate] = useState<null | 'myWords' | 'settings'>(null);

  const gateText =
    gate === 'myWords'
      ? 'Это раздел педагога: здесь меняют слова и комплекты. Дети могут случайно удалить материалы. Продолжить?'
      : 'Это раздел педагога: здесь меняют настройки занятия. Продолжить?';

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
      {gate && (
        <div
          data-testid="teacher-gate"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            padding: 36,
          }}
        >
          <div
            style={{
              background: palette.panel,
              borderRadius: 16,
              padding: 32,
              maxWidth: 680,
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
          >
            <span style={{ fontSize: 26 }}>{gateText}</span>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <BigButton onClick={() => setGate(null)} tone="secondary" testId="teacher-gate-no">
                Отмена
              </BigButton>
              <BigButton
                onClick={() => {
                  const target = gate;
                  setGate(null);
                  if (target === 'myWords') onMyWords();
                  else onSettings();
                }}
                testId="teacher-gate-yes"
              >
                Да, я педагог
              </BigButton>
            </div>
          </div>
        </div>
      )}

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

          <HoldButton
            onHoldComplete={() => setGate('myWords')}
            wide
            hint="раздел педагога — удерживайте 2 секунды"
            testId="menu-my-words"
          >
            🔒 Мои слова
          </HoldButton>

          <HoldButton
            onHoldComplete={() => setGate('settings')}
            wide
            hint="раздел педагога — удерживайте 2 секунды"
            testId="menu-settings"
          >
            🔒 Настройки
          </HoldButton>

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
