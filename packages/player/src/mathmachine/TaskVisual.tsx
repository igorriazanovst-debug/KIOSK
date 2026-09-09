import React from 'react';
import type { Task } from '@kiosk/shared';

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
          <div style={{ ...barStyle, width: left * 20 }} />
          <div style={{ ...barStyle, width: right * 20, background: '#e67e22' }} />
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
    default:
      return null;
  }
};

const dotsRowStyle: React.CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap', maxWidth: 400, justifyContent: 'center' };
const dotStyle: React.CSSProperties = { width: 28, height: 28, borderRadius: '50%', background: '#3498db' };
const equationStyle: React.CSSProperties = { fontSize: 36, fontWeight: 700 };
const barsColumnStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' };
const barStyle: React.CSSProperties = { height: 24, background: '#9b59b6', borderRadius: 4 };

export default TaskVisual;
