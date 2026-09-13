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
  selectedId: string | null;
  newName: string;
  onNewName: (name: string) => void;
  onSelect: (profileId: string) => void;
  onCreate: () => void;
  onDelete: (profileId: string) => void;
  onStart: () => void;
}

const ProfilesScreen: React.FC<Props> = ({
  profiles,
  selectedId,
  newName,
  onNewName,
  onSelect,
  onCreate,
  onDelete,
  onStart,
}) => {
  const selected = profiles.find((p) => p.id === selectedId) ?? null;

  return (
    <Panel testId="alphabet-profiles">
      <h2 style={{ margin: 0, fontSize: 30 }}>Кто занимается?</h2>

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
                background: profile.id === selectedId ? palette.accent : 'rgba(255,255,255,0.12)',
                color: profile.id === selectedId ? palette.textDark : palette.text,
                borderRadius: 14,
                padding: '10px 14px',
              }}
            >
              <button
                type="button"
                onClick={() => onSelect(profile.id)}
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

      <BigButton onClick={onStart} wide disabled={!selected} testId="alphabet-to-menu">
        {selected ? `Начать: ${selected.name}` : 'Выберите игрока'}
      </BigButton>
    </Panel>
  );
};

export default ProfilesScreen;
