// Главное меню комплекса.
import React from 'react';
import type { EumkContent } from '../model/schema.ts';

export type Section = 'theory' | 'test' | 'tasks' | 'games' | 'cases' | 'references' | 'results' | 'group';

// Минимальные линейные пиктограммы разделов (Feather-стиль, stroke=currentColor):
// ускоряют сканирование меню с расстояния панели — «найди нужный раздел за 3 секунды».
const iconProps = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const TILE_ICONS: Partial<Record<Section, React.ReactNode>> = {
  theory: (
    <svg viewBox="0 0 24 24" {...iconProps}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
  ),
  tasks: (
    <svg viewBox="0 0 24 24" {...iconProps}><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
  ),
  games: (
    <svg viewBox="0 0 24 24" {...iconProps}><rect x="3" y="3" width="18" height="18" rx="3.5" /><circle cx="8.3" cy="8.3" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="15.7" cy="15.7" r="1.4" fill="currentColor" stroke="none" /></svg>
  ),
  cases: (
    <svg viewBox="0 0 24 24" {...iconProps}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
  ),
  test: (
    <svg viewBox="0 0 24 24" {...iconProps}><rect x="4" y="4" width="16" height="18" rx="2" /><path d="M9 2h6v3H9z" /><path d="m8.5 13.5 2 2 4.5-5" /></svg>
  ),
  references: (
    <svg viewBox="0 0 24 24" {...iconProps}><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" /></svg>
  ),
  results: (
    <svg viewBox="0 0 24 24" {...iconProps}><path d="M5 20v-6" /><path d="M12 20V8" /><path d="M19 20V11" /><path d="M3 20h18" /></svg>
  ),
  group: (
    <svg viewBox="0 0 24 24" {...iconProps}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" /><path d="M17.5 13.6a6.5 6.5 0 0 1 4 6.4" /></svg>
  ),
};

export function plural(n: number, one: string, few: string, many: string): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

interface Props {
  content: EumkContent;
  onOpen: (section: Section) => void;
  isTeacher: boolean;
  tasksDone: number;
}

export default function HomeScreen({ content, onOpen, tasksDone, isTeacher }: Props) {
  const sectionCount = content.theory.reduce((n, b) => n + b.sections.length, 0);
  const tiles: { id: Section; title: string; text: string; show: boolean }[] = [
    { id: 'theory', title: 'Теория', text: `${content.theory.length} ${plural(content.theory.length, 'блок', 'блока', 'блоков')}, ${sectionCount} ${plural(sectionCount, 'раздел', 'раздела', 'разделов')}`, show: true },
    { id: 'tasks', title: 'Практические задания', text: `${content.tasks.length} ${plural(content.tasks.length, 'задание', 'задания', 'заданий')} · решено верно: ${tasksDone} из ${content.tasks.length}`, show: content.tasks.length > 0 },
    { id: 'games', title: 'Игры', text: `${content.games.length} ${plural(content.games.length, 'интерактивная игра', 'интерактивные игры', 'интерактивных игр')}`, show: content.games.length > 0 },
    { id: 'cases', title: 'Кейсы', text: `${content.cases.length} ${plural(content.cases.length, 'профессиональная ситуация', 'профессиональные ситуации', 'профессиональных ситуаций')}`, show: content.cases.length > 0 },
    { id: 'test', title: 'Итоговый тест', text: `${content.test.questionCount} вопросов из банка в ${content.bank.length}; каждый раз новый набор`, show: true },
    { id: 'references', title: 'Справочные материалы', text: 'Нормативные документы, литература, термины и сокращения', show: true },
    { id: 'results', title: 'Мои результаты', text: 'История прохождения итогового теста', show: true },
    { id: 'group', title: 'Результаты группы', text: 'Все обучающиеся: итоги, экспорт и печать', show: isTeacher },
  ];
  return (
    <div>
      <h2>{content.title}</h2>
      <div className="eumk-tiles">
        {tiles.filter((t) => t.show).map((t) => (
          <button key={t.id} type="button" className="eumk-tile" onClick={() => onOpen(t.id)}>
            {TILE_ICONS[t.id] && <span className="eumk-tile-icon" aria-hidden="true">{TILE_ICONS[t.id]}</span>}
            <b>{t.title}</b>
            <span>{t.text}</span>
            {t.id === 'tasks' && content.tasks.length > 0 && (
              <span
                className="eumk-progress"
                role="progressbar"
                aria-label="Прогресс заданий"
                aria-valuenow={tasksDone}
                aria-valuemin={0}
                aria-valuemax={content.tasks.length}
                style={{ marginTop: 8, marginBottom: 2 }}
              >
                <span style={{ width: `${Math.min(100, Math.round((tasksDone / content.tasks.length) * 100))}%` }} />
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
