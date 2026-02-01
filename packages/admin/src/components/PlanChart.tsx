import React from 'react';
import './PlanChart.css';

const DEFAULT_COLORS: Record<string, string> = {
  BASIC: '#3b82f6',
  PRO: '#8b5cf6',
  MAX: '#f59e0b',
  ACTIVE: '#22c55e',
  SUSPENDED: '#f59e0b',
  EXPIRED: '#ef4444',
  CANCELLED: '#6b7280',
};

interface PlanChartProps {
  distribution: Record<string, number>;
  colorMap?: Record<string, string>;
}

export function PlanChart({ distribution, colorMap }: PlanChartProps) {
  const colors = colorMap || DEFAULT_COLORS;
  const entries = Object.entries(distribution);
  const maxVal = Math.max(...entries.map(([, v]) => v), 1);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);

  if (entries.length === 0) {
    return <div className="plan-chart plan-chart--empty"><span>No data</span></div>;
  }

  return (
    <div className="plan-chart">
      {entries.map(([key, value]) => {
        const pct = (value / maxVal) * 100;
        const share = total > 0 ? ((value / total) * 100).toFixed(0) : '0';
        const color = colors[key] || '#94a3b8';

        return (
          <div className="plan-chart__row" key={key}>
            <span className="plan-chart__label" style={{ color }}>{key}</span>
            <div className="plan-chart__bar-track">
              <div
                className="plan-chart__bar"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
            <span className="plan-chart__value">{value} <span className="plan-chart__share">({share}%)</span></span>
          </div>
        );
      })}
    </div>
  );
}
