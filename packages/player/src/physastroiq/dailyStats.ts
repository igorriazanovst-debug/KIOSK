// packages/player/src/physastroiq/dailyStats.ts
//
// FR-010 ТЗ (строка 249): «Отображение сводной статистики по всем
// участникам, прошедшим викторины, в том числе и сводную статистику за
// один день по всем участникам». До этого модуля userData.sessions
// только копился при завершении игры (PhysastroiqRuntime.handleGameFinished)
// и нигде не читался обратно — сводного отображения не было вообще
// (найдено сверкой с ТЗ 2026-09-15, не было учтено в исходном плане
// реализации).

import type { PhysastroiqSession } from './model/schema.ts';

export interface PhysastroiqDailyPlayerStat {
  name: string;
  gamesPlayed: number;
  totalScore: number;
  totalCorrect: number;
  totalQuestions: number;
}

export interface PhysastroiqDailySummary {
  dateKey: string; // YYYY-MM-DD, локальная дата
  players: PhysastroiqDailyPlayerStat[];
}

// Локальная (не UTC) календарная дата сессии — чтобы «сегодня» совпадало
// с тем, что видит педагог на экране, а не съезжало на соседний день
// из-за часового пояса.
function dateKeyOf(playedAtIso: string): string {
  const d = new Date(playedAtIso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Группирует сессии по календарному дню и суммирует показатели каждого
// игрока (по имени — тот же принцип идентификации участника, что и в
// рамках одной игры, отдельного профиля пользователя в ФизАстроIQ нет).
// Игрок, менявший имя между партиями, будет учтён как разные участники —
// то же ограничение, что и у остальных типов KIOSK без явных профилей.
export function aggregateSessionsByDay(sessions: PhysastroiqSession[]): PhysastroiqDailySummary[] {
  const byDate = new Map<string, Map<string, PhysastroiqDailyPlayerStat>>();

  for (const session of sessions) {
    const dateKey = dateKeyOf(session.playedAtIso);
    if (!byDate.has(dateKey)) byDate.set(dateKey, new Map());
    const players = byDate.get(dateKey) as Map<string, PhysastroiqDailyPlayerStat>;

    for (const p of session.players) {
      const existing = players.get(p.name);
      if (existing) {
        existing.gamesPlayed += 1;
        existing.totalScore += p.score;
        existing.totalCorrect += p.correctCount;
        existing.totalQuestions += p.totalCount;
      } else {
        players.set(p.name, {
          name: p.name,
          gamesPlayed: 1,
          totalScore: p.score,
          totalCorrect: p.correctCount,
          totalQuestions: p.totalCount,
        });
      }
    }
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0)) // новые дни первыми
    .map(([dateKey, players]) => ({
      dateKey,
      players: Array.from(players.values()).sort((a, b) => b.totalScore - a.totalScore),
    }));
}

export function todayDateKey(): string {
  return dateKeyOf(new Date().toISOString());
}
