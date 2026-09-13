// packages/player/src/alphabet/screens/ProfilesScreen.tsx
// Выбор игрока — ТЗ строка 69 («несколько учётных записей»).
//
// Учётная запись здесь — не запись ОС и пароля не имеет: это имя, под которым
// копится статистика по буквам. Разграничение «педагог/ученик» появится
// отдельно, вместе с разделом педагога (Фаза 5), и защищать оно будет
// редактор контента, а не список детей.

import React from 'react';
import { BigButton, Panel, ScrollArea, palette } from '../ui';
import type { Profile } from '../types';

interface Props {
  profiles: Profile[];
  /** Выбранные игроки в порядке хода; 1 — одиночная игра, до 4 — за столом */
  selectedIds: string[];
  maxPlayers: number;
  newName: string;
  onNewName: (name: string) => void;
  onToggle: (profileId: string) => void;
  onCreate: () => void;
  onDelete: (profileId: string) => void;
  onStart: () => void;
}

const ProfilesScreen: React.FC<Props> = ({
  profiles,
  selectedIds,
  maxPlayers,
  newName,
  onNewName,
  onToggle,
  onCreate,
  onDelete,
  onStart,
}) => {
  const chosen = selectedIds
    .map((id) => profiles.find((p) => p.id === id))
    .filter(Boolean) as Profile[];

  return (
    <Panel testId="alphabet-profiles">
      <h2 style={{ margin: 0, fontSize: 30 }}>Кто занимается?</h2>
      {/* Порядок хода — это порядок выбора, и он показан номером на карточке:
          за столом важно знать, кто за кем, а не только кто играет */}
      <span data-testid="alphabet-players-hint" style={{ fontSize: 19, color: palette.textDim }}>
        {chosen.length <= 1
          ? `Выберите игрока. Можно выбрать до ${maxPlayers} — тогда играют по очереди, каждый со своей стороны стола.`
          : `Игроков: ${chosen.length}. Ходят по очереди в порядке выбора.`}
      </span>

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
                background: selectedIds.includes(profile.id)
                  ? palette.accent
                  : 'rgba(255,255,255,0.12)',
                color: selectedIds.includes(profile.id) ? palette.textDark : palette.text,
                borderRadius: 14,
                padding: '10px 14px',
              }}
            >
              <button
                type="button"
                onClick={() => onToggle(profile.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  fontSize: 22,
                  cursor: 'pointer',
                }}
              >
                {selectedIds.indexOf(profile.id) >= 0 && (
                  <span style={{ fontWeight: 800 }}>{selectedIds.indexOf(profile.id) + 1}. </span>
                )}
                {profile.name}
              </button>
              <button
                type="button"
                aria-label={`Удалить ${profile.name}`}
                data-testid={`alphabet-profile-delete-${profile.id}`}
                onClick={() => onDelete(profile.id)}
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
          onChange={(e) => onNewName(e.target.value)}
          style={{ flex: 1, fontSize: 22, padding: '12px 16px', borderRadius: 12, border: 'none' }}
        />
        <BigButton onClick={onCreate} testId="alphabet-add-profile">
          Добавить
        </BigButton>
      </div>

      <BigButton onClick={onStart} wide disabled={chosen.length === 0} testId="alphabet-to-menu">
        {chosen.length === 0
          ? 'Выберите игрока'
          : chosen.length === 1
            ? `Начать: ${chosen[0].name}`
            : `Начать: ${chosen.length} игрока`}
      </BigButton>
    </Panel>
  );
};

export default ProfilesScreen;
