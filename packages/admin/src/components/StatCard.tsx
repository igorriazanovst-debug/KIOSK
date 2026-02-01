import React from 'react';
import './StatCard.css';

interface StatCardProps {
  title: string;
  value: number | string;
  sub?: string;
  icon: string;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
}

export function StatCard({ title, value, sub, icon, color = 'blue' }: StatCardProps) {
  return (
    <div className={`stat-card stat-card--${color}`}>
      <div className="stat-card__header">
        <span className="stat-card__icon">{icon}</span>
        <span className="stat-card__title">{title}</span>
      </div>
      <div className="stat-card__value">{value}</div>
      {sub && <div className="stat-card__sub">{sub}</div>}
    </div>
  );
}
