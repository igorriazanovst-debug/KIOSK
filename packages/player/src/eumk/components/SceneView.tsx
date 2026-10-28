// Рисует набор простых фигур (математика, дошкольное образование):
// фигуры - SVG, поэтому лицензий на изображения нет.
import React from 'react';
import type { SceneObject } from '../gameRounds.ts';

const COLORS: Record<string, string> = {
  red: '#d64545', blue: '#3a6fd8', green: '#3aa05a', yellow: '#e8b923', orange: '#ec8a2c',
  purple: '#8e4fc4', pink: '#e56fa8', brown: '#8a5a38',
};
export const COLOR_NAMES: Record<string, string> = {
  red: 'красный', blue: 'синий', green: 'зелёный', yellow: 'жёлтый', orange: 'оранжевый', purple: 'фиолетовый', pink: 'розовый', brown: 'коричневый',
};

export function colorOf(name: string): string {
  return COLORS[name] ?? '#777777';
}

// Единый набор геометрии: используется и в картинках отличий.
export function ShapeGlyph({ shape, color, size }: { shape: string; color: string; size: number }) {
  const fill = colorOf(color);
  const half = size / 2;
  switch (shape) {
    case 'square': return <rect x={-half} y={-half} width={size} height={size} fill={fill} />;
    case 'rectangle': return <rect x={-half * 1.4} y={-half * 0.7} width={size * 1.4} height={size * 0.7} fill={fill} />;
    case 'triangle': return <polygon points={`0,${-half} ${half},${half} ${-half},${half}`} fill={fill} />;
    case 'diamond': return <polygon points={`0,${-half} ${half},0 0,${half} ${-half},0`} fill={fill} />;
    case 'oval': return <ellipse cx={0} cy={0} rx={half * 1.3} ry={half * 0.8} fill={fill} />;
    case 'star': {
      const pts = Array.from({ length: 10 }, (_, i) => {
        const r = i % 2 === 0 ? half : half * 0.45;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        return `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`;
      }).join(' ');
      return <polygon points={pts} fill={fill} />;
    }
    default: return <circle cx={0} cy={0} r={half} fill={fill} />;
  }
}

function Icon({ object, index }: { object: SceneObject; index: number }) {
  const bar = object.size ? 14 + object.size * 12 : 34;
  const stick = object.size !== undefined && object.shape === 'rectangle';
  return (
    <svg key={index} width={stick ? 34 : 48} height={stick ? bar + 10 : 48} viewBox={stick ? `-17 ${-(bar + 10) / 2} 34 ${bar + 10}` : '-24 -24 48 48'} aria-hidden="true">
      {stick ? <rect x={-9} y={-bar / 2} width={18} height={bar} fill={colorOf(object.color)} rx={3} /> : <ShapeGlyph shape={object.shape} color={object.color} size={34} />}
    </svg>
  );
}

export default function SceneView({ objects }: { objects: SceneObject[] }) {
  if (objects.length === 0) return null;
  const groups = new Map<string, SceneObject[]>();
  for (const o of objects) groups.set(o.group ?? '', [...(groups.get(o.group ?? '') ?? []), o]);
  return (
    <div className="eumk-row" style={{ gap: 28, margin: '8px 0 16px', alignItems: 'flex-end' }} role="img" aria-label="Картинка к заданию">
      {[...groups.entries()].map(([name, list]) => (
        <div key={name} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'flex-end', padding: name ? 10 : 0, border: name ? '2px dashed var(--eumk-line)' : 'none', borderRadius: 12 }}>
          {list.flatMap((o, oi) => Array.from({ length: o.count }, (_, i) => <Icon key={`${oi}-${i}`} object={o} index={i} />))}
        </div>
      ))}
    </div>
  );
}
