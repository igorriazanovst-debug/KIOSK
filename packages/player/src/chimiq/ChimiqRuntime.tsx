// packages/player/src/chimiq/ChimiqRuntime.tsx
//
// Фаза 1 (вертикальный срез, план реализации Тип9_ХимIQ §5): доказать, что
// регистрация виджета во всех 4 точках работает и standalone-окно
// открывается — ЕЩЁ БЕЗ содержательной игровой логики. Экраны (интро,
// настройка, игровое поле, результаты, редактор) — Фазы 3-4, приходят
// следующими коммитами по образцу rusiq/RusiqRuntime.tsx.
import React from 'react';

interface Props {
  properties: { title?: string };
}

export default function ChimiqRuntime({ properties }: Props) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 16,
        background: '#0f2540',
        color: '#ffffff',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ margin: 0, fontSize: 48 }}>{properties.title || 'ХимIQ'}</h1>
      <p style={{ margin: 0, opacity: 0.7 }}>Виджет в разработке (Фаза 1)</p>
    </div>
  );
}
