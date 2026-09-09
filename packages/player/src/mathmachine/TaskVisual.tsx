import React from 'react';
import type { Task } from '@kiosk/shared';
import { COLOR, FONT } from './theme';
import { SHAPE_IDS, SOLID_IDS, POSITION_RELATION_IDS, DIRECTION_IDS } from './content/generatorShared.ts';

const TaskVisual: React.FC<{ task: Task }> = ({ task }) => {
  switch (task.typeId) {
    case 'number_counting': {
      const count = Number(task.params.count ?? 0);
      return (
        <div style={dotsRowStyle}>
          {Array.from({ length: count }).map((_, i) => (
            <span key={i} style={dotStyle} />
          ))}
        </div>
      );
    }
    case 'number_sum_two':
      return <div style={equationStyle}>{String(task.params.a)} + {String(task.params.b)} = ?</div>;
    case 'number_sum_three':
      return <div style={equationStyle}>{String(task.params.a)} + {String(task.params.b)} + {String(task.params.c)} = ?</div>;
    case 'number_missing': {
      const series = (task.params.series as unknown as number[]) ?? [];
      const missingIndex = Number(task.params.missingIndex ?? -1);
      return <div style={equationStyle}>{series.map((n, i) => (i === missingIndex ? '?' : n)).join('  ')}</div>;
    }
    case 'compare_length': {
      const left = Number(task.params.leftLength ?? 1);
      const right = Number(task.params.rightLength ?? 1);
      return (
        <div style={barsColumnStyle}>
          <div style={barRowStyle}>
            <span style={barLabelStyle}>Первый</span>
            <div style={{ ...barStyle, width: left * 20 }} />
          </div>
          <div style={barRowStyle}>
            <span style={barLabelStyle}>Второй</span>
            <div style={{ ...barStyle, width: right * 20, background: COLOR.amber }} />
          </div>
        </div>
      );
    }
    case 'number_subtract_two':
      return <div style={equationStyle}>{String(task.params.a)} - {String(task.params.b)} = ?</div>;
    case 'number_compare': {
      const a = String(task.params.a);
      const b = String(task.params.b);
      return <div style={equationStyle}>{a} &nbsp;&nbsp;&nbsp; {b}</div>;
    }
    case 'digit_recognition':
      return <div style={equationStyle}>{String(task.params.target)}</div>;
    case 'number_composition':
      return <div style={equationStyle}>{String(task.params.whole)} = {String(task.params.knownPart)} + ?</div>;
    case 'number_ordering': {
      const series = (task.params.series as unknown as number[]) ?? [];
      return <div style={equationStyle}>{series.join('   ')}</div>;
    }
    case 'number_multiply_two':
      return <div style={equationStyle}>{String(task.params.a)} × {String(task.params.b)} = ?</div>;
    case 'number_divide_remainder':
      return <div style={equationStyle}>{String(task.params.a)} : {String(task.params.b)} = ?</div>;
    case 'number_multiple_check':
      return <div style={equationStyle}>Делится на {String(task.params.n)}?</div>;
    case 'round_to_ten':
      return <div style={equationStyle}>{String(task.params.n)} ≈ ?</div>;
    case 'ordinal_position': {
      const series = (task.params.series as unknown as number[]) ?? [];
      return <div style={equationStyle}>{series.join('   ')}</div>;
    }
    case 'share_of_whole':
      return <div style={equationStyle}>{String(task.params.total)} : {String(task.params.parts)} = ?</div>;
    case 'compare_mass': {
      const left = Number(task.params.leftMass ?? 1);
      const right = Number(task.params.rightMass ?? 1);
      return (
        <div style={barsColumnStyle}>
          <div style={{ ...barStyle, width: Math.max(20, Math.log2(left + 1) * 30) }} />
          <div style={{ ...barStyle, width: Math.max(20, Math.log2(right + 1) * 30), background: COLOR.amber }} />
        </div>
      );
    }
    case 'compare_volume': {
      const left = Number(task.params.leftVolume ?? 1);
      const right = Number(task.params.rightVolume ?? 1);
      return (
        <div style={barsColumnStyle}>
          <div style={{ ...barStyle, width: Math.max(20, Math.log2(left + 1) * 30) }} />
          <div style={{ ...barStyle, width: Math.max(20, Math.log2(right + 1) * 30), background: COLOR.amber }} />
        </div>
      );
    }
    case 'weekday_order':
    case 'season_order':
    case 'event_order':
    case 'estimate_mass_volume':
    case 'estimate_fraction':
      // Верно-качественные типы (нет численного соотношения, которое имело
      // бы смысл рисовать графически) — сам вопрос уже полностью в
      // task.text, дополнительный визуал не нужен (та же логика, что и у
      // number_multiple_check).
      return null;
    case 'count_then_add':
    case 'count_then_subtract': {
      const groupA = Number(task.params.groupA ?? 0);
      const groupB = Number(task.params.groupB ?? 0);
      const opSymbol = task.typeId === 'count_then_add' ? '+' : '−';
      return (
        <div style={comboCountRowStyle}>
          <div style={dotsRowStyle}>
            {Array.from({ length: groupA }).map((_, i) => (
              <span key={i} style={dotStyle} />
            ))}
          </div>
          <span style={equationStyle}>{opSymbol}</span>
          <div style={dotsRowStyle}>
            {Array.from({ length: groupB }).map((_, i) => (
              <span key={i} style={{ ...dotStyle, background: COLOR.mint, border: `2px solid ${COLOR.mintDark}` }} />
            ))}
          </div>
        </div>
      );
    }
    case 'clock_reading': {
      const hours = Number(task.params.hours ?? 12) % 12;
      const minutes = Number(task.params.minutes ?? 0);
      return <ClockFace hourAngle={hours * 30 + minutes * 0.5} minuteAngle={minutes * 6} />;
    }
    case 'mass_measurement':
      return <ScaleGauge value={Number(task.params.value ?? 0)} max={10} />;
    case 'right_angle_recognition': {
      const angles = (task.params.angles as unknown as number[]) ?? [90, 90, 90];
      return (
        <div style={angleRowStyle}>
          {angles.map((deg, i) => (
            <AngleGlyph key={i} label={['А', 'Б', 'В'][i]} degrees={deg} />
          ))}
        </div>
      );
    }
    case 'shape_naming':
    case 'shape_properties':
      return <ShapeGlyph shape={SHAPE_IDS[Number(task.params.shape ?? 0)] ?? 'circle'} />;
    case 'solid_naming':
    case 'solid_properties':
      return <SolidGlyph solid={SOLID_IDS[Number(task.params.solid ?? 0)] ?? 'cube'} />;
    case 'spatial_position':
      return <PositionScene relation={POSITION_RELATION_IDS[Number(task.params.relation ?? 0)] ?? 'left'} />;
    case 'spatial_direction':
      return <ArrowGlyph direction={DIRECTION_IDS[Number(task.params.direction ?? 0)] ?? 'up'} />;
    case 'spatial_ordering': {
      const sizes = (task.params.sizes as unknown as number[]) ?? [30, 30, 30];
      return (
        <div style={orderingRowStyle}>
          {sizes.map((size, i) => (
            <div key={i} style={orderingItemStyle}>
              <div style={{ ...orderingShapeStyle, width: size, height: size }} />
              <span style={orderingLabelStyle}>{['Первая', 'Вторая', 'Третья'][i]}</span>
            </div>
          ))}
        </div>
      );
    }
    case 'grid_coordinates':
      return <CoordinateGrid col={Number(task.params.col ?? 0)} row={Number(task.params.row ?? 0)} />;
    default:
      return null;
  }
};

// ─── Этап 4 — визуалы Класса А (SVG-примитивы, без внешних ассетов) ──────

const ClockFace: React.FC<{ hourAngle: number; minuteAngle: number }> = ({ hourAngle, minuteAngle }) => (
  <svg width={160} height={160} viewBox="0 0 160 160">
    <circle cx={80} cy={80} r={72} fill={COLOR.surface} stroke={COLOR.indigo} strokeWidth={4} />
    {Array.from({ length: 12 }).map((_, i) => {
      const a = (i * 30 * Math.PI) / 180;
      const x1 = 80 + Math.sin(a) * 62;
      const y1 = 80 - Math.cos(a) * 62;
      const x2 = 80 + Math.sin(a) * 70;
      const y2 = 80 - Math.cos(a) * 70;
      return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={COLOR.textMuted} strokeWidth={2} />;
    })}
    <line x1={80} y1={80} x2={80 + Math.sin((hourAngle * Math.PI) / 180) * 38} y2={80 - Math.cos((hourAngle * Math.PI) / 180) * 38} stroke={COLOR.indigoDark} strokeWidth={6} strokeLinecap="round" />
    <line x1={80} y1={80} x2={80 + Math.sin((minuteAngle * Math.PI) / 180) * 56} y2={80 - Math.cos((minuteAngle * Math.PI) / 180) * 56} stroke={COLOR.amberDark} strokeWidth={4} strokeLinecap="round" />
    <circle cx={80} cy={80} r={5} fill={COLOR.indigoDark} />
  </svg>
);

const ScaleGauge: React.FC<{ value: number; max: number }> = ({ value, max }) => {
  const trackWidth = 280;
  const pointerX = (value / max) * trackWidth;
  return (
    <svg width={trackWidth + 20} height={70} viewBox={`0 0 ${trackWidth + 20} 70`}>
      <rect x={10} y={30} width={trackWidth} height={10} rx={5} fill={COLOR.mintLight} stroke={COLOR.mintDark} strokeWidth={2} />
      {Array.from({ length: max + 1 }).map((_, i) => (
        <line key={i} x1={10 + (i / max) * trackWidth} y1={44} x2={10 + (i / max) * trackWidth} y2={54} stroke={COLOR.textMuted} strokeWidth={2} />
      ))}
      <polygon points={`${10 + pointerX - 8},20 ${10 + pointerX + 8},20 ${10 + pointerX},34`} fill={COLOR.amberDark} />
    </svg>
  );
};

const AngleGlyph: React.FC<{ label: string; degrees: number }> = ({ label, degrees }) => {
  const rad = (degrees * Math.PI) / 180;
  const armLength = 60;
  return (
    <div style={angleGlyphColumnStyle}>
      <svg width={90} height={90} viewBox="0 0 90 90">
        <line x1={15} y1={75} x2={15 + armLength} y2={75} stroke={COLOR.indigoDark} strokeWidth={4} strokeLinecap="round" />
        <line x1={15} y1={75} x2={15 + Math.cos(rad) * armLength} y2={75 - Math.sin(rad) * armLength} stroke={COLOR.amberDark} strokeWidth={4} strokeLinecap="round" />
      </svg>
      <span style={glyphLabelStyle}>{label}</span>
    </div>
  );
};

const SHAPE_RENDER: Record<string, (key: string) => React.ReactElement> = {
  circle: () => <circle cx={50} cy={50} r={42} />,
  square: () => <rect x={12} y={12} width={76} height={76} />,
  triangle: () => <polygon points="50,10 90,88 10,88" />,
  rectangle: () => <rect x={6} y={24} width={88} height={52} />,
  pentagon: () => <polygon points="50,8 92,40 76,90 24,90 8,40" />,
  hexagon: () => <polygon points="27,8 73,8 96,50 73,92 27,92 4,50" />,
};

const ShapeGlyph: React.FC<{ shape: string }> = ({ shape }) => {
  const render = SHAPE_RENDER[shape] ?? SHAPE_RENDER.circle;
  return (
    <svg width={100} height={100} viewBox="0 0 100 100" fill={COLOR.mint} stroke={COLOR.mintDark} strokeWidth={3}>
      {render(shape)}
    </svg>
  );
};

const SOLID_RENDER: Record<string, () => React.ReactElement> = {
  cube: () => (
    <g stroke={COLOR.mintDark} strokeWidth={2.5} strokeLinejoin="round">
      <polygon points="18,24 18,68 50,88 50,42" fill={COLOR.mintDark} />
      <polygon points="50,42 50,88 82,68 82,24" fill={COLOR.mint} />
      <polygon points="18,24 50,42 82,24 50,8" fill={COLOR.mintLight} />
    </g>
  ),
  sphere: () => (
    <g>
      <circle cx={50} cy={50} r={42} fill={COLOR.mint} stroke={COLOR.mintDark} strokeWidth={2.5} />
      <ellipse cx={38} cy={36} rx={16} ry={10} fill={COLOR.mintLight} opacity={0.7} />
    </g>
  ),
  cone: () => (
    <g fill={COLOR.mint} stroke={COLOR.mintDark} strokeWidth={2.5}>
      <ellipse cx={50} cy={80} rx={36} ry={10} fill={COLOR.mintDark} />
      <polygon points="50,10 86,80 14,80" />
    </g>
  ),
  cylinder: () => (
    <g fill={COLOR.mint} stroke={COLOR.mintDark} strokeWidth={2.5}>
      <rect x={16} y={26} width={68} height={48} />
      <ellipse cx={50} cy={74} rx={34} ry={10} fill={COLOR.mintDark} />
      <ellipse cx={50} cy={26} rx={34} ry={10} fill={COLOR.mintLight} />
    </g>
  ),
  pyramid: () => (
    <g fill={COLOR.mint} stroke={COLOR.mintDark} strokeWidth={2.5}>
      <polygon points="16,78 84,78 68,62 32,62" fill={COLOR.mintDark} />
      <polygon points="50,10 84,78 16,78" />
    </g>
  ),
};

const SolidGlyph: React.FC<{ solid: string }> = ({ solid }) => {
  const render = SOLID_RENDER[solid] ?? SOLID_RENDER.cube;
  return (
    <svg width={100} height={100} viewBox="0 0 100 100">
      {render()}
    </svg>
  );
};

const POSITION_OFFSETS: Record<string, { x: number; y: number }> = {
  left: { x: -55, y: 0 },
  right: { x: 55, y: 0 },
  above: { x: 0, y: -45 },
  below: { x: 0, y: 45 },
};

const PositionScene: React.FC<{ relation: string }> = ({ relation }) => {
  const offset = POSITION_OFFSETS[relation] ?? POSITION_OFFSETS.left;
  return (
    <svg width={200} height={150} viewBox="0 0 200 150">
      <rect x={80} y={55} width={40} height={40} fill={COLOR.mint} stroke={COLOR.mintDark} strokeWidth={2.5} />
      <circle cx={100 + offset.x} cy={75 + offset.y} r={16} fill={COLOR.amber} stroke={COLOR.amberDark} strokeWidth={2.5} />
    </svg>
  );
};

const DIRECTION_ROTATION: Record<string, number> = { up: 0, right: 90, down: 180, left: 270 };

const ArrowGlyph: React.FC<{ direction: string }> = ({ direction }) => (
  <svg width={100} height={100} viewBox="0 0 100 100">
    <g transform={`rotate(${DIRECTION_ROTATION[direction] ?? 0} 50 50)`} fill={COLOR.indigo} stroke={COLOR.indigoDark} strokeWidth={2}>
      <line x1={50} y1={80} x2={50} y2={30} strokeWidth={8} strokeLinecap="round" />
      <polygon points="50,12 68,42 32,42" />
    </g>
  </svg>
);

const CoordinateGrid: React.FC<{ col: number; row: number }> = ({ col, row }) => {
  const cell = 32;
  const cols = 5;
  const rows = 5;
  const gridSize = cell * 5;
  const cx = col * cell + cell / 2;
  const cy = (rows - 1 - row) * cell + cell / 2;
  return (
    <svg width={gridSize + 30} height={gridSize + 30} viewBox={`0 0 ${gridSize + 30} ${gridSize + 30}`}>
      <g transform="translate(25,0)">
        {Array.from({ length: cols + 1 }).map((_, i) => (
          <line key={`v${i}`} x1={i * cell} y1={0} x2={i * cell} y2={gridSize} stroke={COLOR.border} strokeWidth={2} />
        ))}
        {Array.from({ length: rows + 1 }).map((_, i) => (
          <line key={`h${i}`} x1={0} y1={i * cell} x2={gridSize} y2={i * cell} stroke={COLOR.border} strokeWidth={2} />
        ))}
        {['А', 'Б', 'В', 'Г', 'Д'].map((label, i) => (
          <text key={label} x={i * cell + cell / 2} y={gridSize + 18} textAnchor="middle" fontSize={16} fill={COLOR.textMuted}>{label}</text>
        ))}
        {[5, 4, 3, 2, 1].map((label, i) => (
          <text key={label} x={-14} y={i * cell + cell / 2 + 5} textAnchor="middle" fontSize={16} fill={COLOR.textMuted}>{label}</text>
        ))}
        <circle cx={cx} cy={cy} r={9} fill={COLOR.amberDark} />
      </g>
    </svg>
  );
};

const dotsRowStyle: React.CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap', maxWidth: 400, justifyContent: 'center' };
const dotStyle: React.CSSProperties = { width: 28, height: 28, borderRadius: '50%', background: COLOR.amber, border: `2px solid ${COLOR.amberDark}` };
const equationStyle: React.CSSProperties = { fontFamily: FONT.ui, fontSize: 36, fontWeight: 800, color: COLOR.indigoDark };
const barsColumnStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' };
const barRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12 };
const barLabelStyle: React.CSSProperties = { fontFamily: FONT.ui, fontSize: 16, fontWeight: 700, color: COLOR.text, width: 68, flexShrink: 0 };
const barStyle: React.CSSProperties = { height: 24, background: COLOR.mint, borderRadius: 4 };
const comboCountRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 16 };
const angleRowStyle: React.CSSProperties = { display: 'flex', gap: 24 };
const angleGlyphColumnStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 };
const glyphLabelStyle: React.CSSProperties = { fontFamily: FONT.ui, fontSize: 18, fontWeight: 800, color: COLOR.indigoDark };
const orderingRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'flex-end', gap: 28 };
const orderingItemStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 };
const orderingShapeStyle: React.CSSProperties = { background: COLOR.mint, border: `2px solid ${COLOR.mintDark}`, borderRadius: '50%' };
const orderingLabelStyle: React.CSSProperties = { fontFamily: FONT.ui, fontSize: 14, fontWeight: 700, color: COLOR.textMuted };

export default TaskVisual;
