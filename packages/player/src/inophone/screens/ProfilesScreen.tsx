// packages/player/src/inophone/screens/ProfilesScreen.tsx
// Выбор ученика (ТЗ строка 91). Первый экран приложения.
//
// ИМЯ ВВОДИТСЯ ЗДЕСЬ ЖЕ, а не в отдельном окне создания: профилей у пособия
// единицы, и переход на отдельный экран ради одного поля — лишний шаг на
// занятии, где всё происходит у доски стоя.

import React from 'react';
import { Banner, BigButton, Panel, ScreenHeader, palette } from '../ui';
import type { Profile } from '../types';

interface Props {
  profiles: Profile[];
  newName: string;
  onNewNameChange: (value: string) => void;
  onCreate: () => void;
  onDelete: (profileId: string) => void;
  onChoose: (profileId: string) => void;
  error: string | null;
  notice: string | null;
  busy: boolean;
}

const ProfilesScreen: React.FC<Props> = ({
  profiles,
  newName,
  onNewNameChange,
  onCreate,
  onDelete,
  onChoose,
  error,
  notice,
  busy,
}) => (
  <div>
    <ScreenHeader title="Кто занимается" />
    {error && <Banner text={error} tone="error" />}
    {notice && <Banner text={notice} tone="notice" />}

    <Panel style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', gap: 16 }}>
        <input
          data-testid="inophone-new-profile"
          value={newName}
          placeholder="Имя ученика"
          onChange={(e) => onNewNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCreate();
          }}
          style={{
            flex: 1,
            fontSize: 22,
            padding: '12px 16px',
            borderRadius: 12,
            border: `2px solid ${palette.panelEdge}`,
            background: palette.card,
            color: palette.textDark,
          }}
        />
        <BigButton onClick={onCreate} disabled={busy} testId="inophone-create-profile">
          Добавить
        </BigButton>
      </div>
    </Panel>

    {profiles.length === 0 ? (
      <div style={{ color: palette.textDim, fontSize: 20 }}>
        Пока никого нет. Добавьте ученика, чтобы приложение запоминало его результаты.
      </div>
    ) : (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {profiles.map((p) => (
          <Panel key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              data-testid={`inophone-profile-${p.id}`}
              onClick={() => onChoose(p.id)}
              style={{
                flex: 1,
                textAlign: 'left',
                background: 'transparent',
                border: 'none',
                color: palette.text,
                fontSize: 24,
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {p.name}
            </button>
            <BigButton onClick={() => onDelete(p.id)} tone="danger" disabled={busy}>
              ✕
            </BigButton>
          </Panel>
        ))}
      </div>
    )}
  </div>
);

export default ProfilesScreen;
