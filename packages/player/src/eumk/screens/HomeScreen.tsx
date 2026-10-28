// Главное меню комплекса.
import React from 'react';
import type { EumkContent } from '../model/schema.ts';

export type Section = 'theory' | 'test' | 'tasks' | 'games' | 'cases' | 'references' | 'results';

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
  tasksDone: number;
}

export default function HomeScreen({ content, onOpen, tasksDone }: Props) {
  const sectionCount = content.theory.reduce((n, b) => n + b.sections.length, 0);
  const tiles: { id: Section; title: string; text: string; show: boolean }[] = [
    { id: 'theory', title: 'Теория', text: `${content.theory.length} ${plural(content.theory.length, 'блок', 'блока', 'блоков')}, ${sectionCount} ${plural(sectionCount, 'раздел', 'раздела', 'разделов')}`, show: true },
    { id: 'tasks', title: 'Практические задания', text: `${content.tasks.length} ${plural(content.tasks.length, 'задание', 'задания', 'заданий')}, выполнено верно: ${tasksDone}`, show: content.tasks.length > 0 },
    { id: 'games', title: 'Игры', text: `${content.games.length} ${plural(content.games.length, 'интерактивная игра', 'интерактивные игры', 'интерактивных игр')}`, show: content.games.length > 0 },
    { id: 'cases', title: 'Кейсы', text: `${content.cases.length} ${plural(content.cases.length, 'профессиональная ситуация', 'профессиональные ситуации', 'профессиональных ситуаций')}`, show: content.cases.length > 0 },
    { id: 'test', title: 'Итоговый тест', text: `${content.test.questionCount} вопросов из банка в ${content.bank.length}; каждый раз новый набор`, show: true },
    { id: 'references', title: 'Справочные материалы', text: 'Нормативные документы, литература, термины и сокращения', show: true },
    { id: 'results', title: 'Мои результаты', text: 'История прохождения итогового теста', show: true },
  ];
  return (
    <div>
      <h2>{content.title}</h2>
      <div className="eumk-tiles">
        {tiles.filter((t) => t.show).map((t) => (
          <button key={t.id} type="button" className="eumk-tile" onClick={() => onOpen(t.id)}>
            <b>{t.title}</b>
            <span>{t.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
