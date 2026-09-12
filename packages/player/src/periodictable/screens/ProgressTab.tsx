// packages/player/src/periodictable/screens/ProgressTab.tsx
import React from 'react';
import type { PeriodicElement } from '../model/schema.ts';
import { computeAchievements } from '../explorationAchievements.ts';

interface Props {
  elements: PeriodicElement[];
  explored: Set<number>;
}

const ProgressTab: React.FC<Props> = ({ elements, explored }) => {
  const total = elements.length;
  const exploredCount = elements.filter((el) => explored.has(el.atomicNumber)).length;
  const percent = total > 0 ? Math.round((exploredCount / total) * 100) : 0;
  const achievements = computeAchievements(elements, explored);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <span style={{ fontWeight: 'bold', fontSize: 15, color: '#0d47a1' }}>Изучено элементов</span>
          <span style={{ fontSize: 14, color: '#607d8b' }}>
            {exploredCount} из {total}
          </span>
        </div>
        <div style={{ height: 14, borderRadius: 7, background: '#eceff1', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${percent}%`,
              background: 'linear-gradient(to right, #42a5f5, #66bb6a)',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      <div style={{ fontWeight: 'bold', fontSize: 14, color: '#37474f', marginBottom: 8 }}>Значки</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {achievements.map((a) => (
          <div
            key={a.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 10px',
              background: a.completed ? '#e8f5e9' : '#fafafa',
              border: a.completed ? '1px solid #81c784' : '1px solid #eceff1',
              borderRadius: 8,
            }}
          >
            <span style={{ fontSize: 18 }}>{a.completed ? '🏆' : '⚪'}</span>
            <span style={{ flex: 1, color: a.completed ? '#2e7d32' : '#37474f', fontWeight: a.completed ? 'bold' : 'normal' }}>{a.label}</span>
            <span style={{ fontSize: 13, color: '#78909c' }}>
              {a.exploredCount}/{a.total}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProgressTab;
