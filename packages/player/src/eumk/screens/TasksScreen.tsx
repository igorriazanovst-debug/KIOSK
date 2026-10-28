// Интерактивные практические задания: список по блокам, прохождение по одному.
import React, { useMemo, useState } from 'react';
import TaskView from '../components/TaskView.tsx';
import type { EumkContent } from '../model/schema.ts';
import type { TaskCheck } from '../tasks.ts';

interface Props {
  content: EumkContent;
  progress: Record<string, boolean>;
  onDone: (taskId: string, correct: boolean) => void;
}

const TYPE_NAMES: Record<string, string> = {
  choice: 'выбор ответа', multi: 'несколько ответов', order: 'порядок', sort: 'распределение', match: 'соответствие', gaps: 'пропуски', input: 'ввод ответа',
};

export default function TasksScreen({ content, progress, onDone }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const blockTitles = useMemo(() => Object.fromEntries(content.theory.map((b) => [b.id, b.title])), [content]);
  const open = content.tasks.find((t) => t.id === openId) ?? null;

  if (open) {
    const index = content.tasks.indexOf(open);
    const next = content.tasks[index + 1];
    return (
      <div className="eumk-narrow">
        <button type="button" className="eumk-btn" onClick={() => setOpenId(null)}>← Все задания</button>
        <p className="eumk-muted" style={{ marginTop: 12 }}>Задание {index + 1} из {content.tasks.length} · {TYPE_NAMES[open.type]}</p>
        <TaskView key={`${open.id}-${attempt}`} task={open} seed={String(attempt)} nextLabel={next ? 'Следующее задание' : 'К списку'}
          onNext={(check: TaskCheck) => {
            onDone(open.id, check.isCorrect);
            setAttempt(attempt + 1);
            setOpenId(next ? next.id : null);
          }} />
      </div>
    );
  }

  const groups = content.theory.map((b) => ({ block: b, tasks: content.tasks.filter((t) => t.block === b.id) })).filter((g) => g.tasks.length > 0);
  const loose = content.tasks.filter((t) => !content.theory.some((b) => b.id === t.block));
  return (
    <div className="eumk-narrow">
      <h2>Практические задания</h2>
      <p className="eumk-muted">Выполнено верно: {content.tasks.filter((t) => progress[t.id]).length} из {content.tasks.length}</p>
      {[...groups.map((g) => ({ key: g.block.id, title: blockTitles[g.block.id], tasks: g.tasks })), ...(loose.length ? [{ key: 'other', title: 'Другое', tasks: loose }] : [])].map((g) => (
        <div key={g.key}>
          <h3>{g.title}</h3>
          {g.tasks.map((t) => (
            <button key={t.id} type="button" className="eumk-tile" style={{ marginBottom: 10, minHeight: 0, flexDirection: 'row', alignItems: 'center', width: '100%' }} onClick={() => { setAttempt(attempt + 1); setOpenId(t.id); }}>
              <span style={{ fontSize: 22 }} role="img" aria-label={progress[t.id] ? 'выполнено' : 'не выполнено'}>{progress[t.id] ? '✔' : '○'}</span>
              <span className="eumk-grow" style={{ color: 'var(--eumk-ink)', fontSize: 18 }}>{t.title}</span>
              <span>{TYPE_NAMES[t.type]}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
