// packages/player/src/words/screens/PlayersScreen.tsx
// Учётные записи игроков (ТЗ строка 47) и выбор состава партии.
//
// Имя вводится экранной клавиатурой: физической на доске и столе нет.
// Профили без паролей — это не учётные записи ОС, а способ персонифицировать
// статистику ребёнка (строка 52).

import React, { useState } from 'react';
import { BigButton, ErrorBanner, ScreenFrame, ScrollArea, palette, TOUCH_TARGET_PX } from '../ui';
import Keyboard from '../components/Keyboard';
import type { Profile } from '../types';
import { WORDS_MAX_PLAYERS } from '@kiosk/shared';

interface Props {
  profiles: Profile[];
  selectedProfileIds: string[];
  error: string | null;
  busy: boolean;
  onBack: () => void;
  onCreate: (name: string) => Promise<boolean>;
  onDelete: (id: string) => void;
  onToggleSelected: (id: string) => void;
  /** Перейти к выбору темы с отмеченным составом */
  onPlay: () => void;
}

const PlayersScreen: React.FC<Props> = ({
  profiles,
  selectedProfileIds,
  error,
  busy,
  onBack,
  onCreate,
  onDelete,
  onToggleSelected,
  onPlay,
}) => {
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);

  const submit = async () => {
    if (!draft.trim()) return;
    const ok = await onCreate(draft.trim());
    if (ok) {
      setDraft('');
      setAdding(false);
    }
  };

  return (
    <ScreenFrame title="Игроки" onBack={onBack}>
      <ErrorBanner text={error} />

      {!adding && (
        <>
          <div style={{ fontSize: 20, color: palette.textMuted }}>
            Отметьте, кто играет: до {WORDS_MAX_PLAYERS} человек за одним столом.
          </div>

          <ScrollArea style={{ flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {profiles.length === 0 && (
                <div style={{ fontSize: 22, color: palette.textMuted }}>Пока ни одного игрока</div>
              )}
              {profiles.map((profile) => {
                const selected = selectedProfileIds.includes(profile.id);
                const full = selectedProfileIds.length >= WORDS_MAX_PLAYERS && !selected;
                return (
                  <div
                    key={profile.id}
                    data-testid={`profile-${profile.name}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 16,
                      background: selected ? palette.accent : palette.panel,
                      borderRadius: 12,
                      padding: '12px 20px',
                      minHeight: TOUCH_TARGET_PX,
                    }}
                  >
                    <button
                      onClick={() => onToggleSelected(profile.id)}
                      disabled={full}
                      data-testid={`select-${profile.name}`}
                      style={{
                        flex: 1,
                        textAlign: 'left',
                        fontSize: 28,
                        background: 'transparent',
                        border: 'none',
                        color: palette.text,
                        cursor: full ? 'default' : 'pointer',
                        opacity: full ? 0.4 : 1,
                        fontFamily: 'inherit',
                        minHeight: TOUCH_TARGET_PX - 24,
                      }}
                    >
                      {selected ? '✓ ' : ''}
                      {profile.name}
                    </button>
                    <BigButton
                      onClick={() => onDelete(profile.id)}
                      tone="danger"
                      disabled={busy}
                      testId={`delete-${profile.name}`}
                    >
                      Удалить
                    </BigButton>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          <div style={{ display: 'flex', gap: 16 }}>
            <BigButton onClick={() => setAdding(true)} tone="secondary" testId="add-player">
              Добавить игрока
            </BigButton>
            {/* Без этой кнопки состав, отмеченный здесь, было некуда применить:
                возврат в меню и «Одиночная игра» обрезали его до одного игрока.
                Найдено живым прогоном — тесты этого не показывали. */}
            <BigButton
              onClick={onPlay}
              wide
              disabled={selectedProfileIds.length === 0}
              testId="players-play"
            >
              {selectedProfileIds.length > 1
                ? `Играть вместе (${selectedProfileIds.length})`
                : 'Играть'}
            </BigButton>
          </div>
        </>
      )}

      {adding && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
          <div
            data-testid="name-draft"
            style={{
              width: 620,
              minHeight: TOUCH_TARGET_PX,
              fontSize: 34,
              padding: '12px 20px',
              borderRadius: 12,
              border: `2px solid ${palette.accent}`,
              background: palette.bg,
              boxSizing: 'border-box',
            }}
          >
            {draft || <span style={{ color: palette.textMuted }}>Имя игрока</span>}
          </div>

          <Keyboard value={draft} onChange={setDraft} onSubmit={submit} />

          <div style={{ display: 'flex', gap: 16 }}>
            <BigButton onClick={() => { setAdding(false); setDraft(''); }} tone="secondary">
              Отмена
            </BigButton>
            <BigButton onClick={submit} disabled={busy || !draft.trim()} testId="save-player">
              Сохранить
            </BigButton>
          </div>
        </div>
      )}
    </ScreenFrame>
  );
};

export default PlayersScreen;
