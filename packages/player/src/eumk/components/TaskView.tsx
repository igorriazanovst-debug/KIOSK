// Один экран задания: показывает условие, принимает ответ, проверяет и
// объясняет. Общий для практических заданий и игровых раундов.
// Управление только нажатиями (без перетаскивания): надёжно на панелях.
import React, { useMemo, useState } from 'react';
import { seededRng, shuffled } from '../rng.ts';
import { checkTask, type TaskCheck } from '../tasks.ts';
import type { EumkTask } from '../model/schema.ts';
import type { SceneObject } from '../gameRounds.ts';
import SceneView from './SceneView.tsx';

interface Props {
  task: EumkTask;
  // Зерно перемешивания: у каждого прохождения свой порядок карточек.
  seed: string;
  hint?: string | null;
  scene?: SceneObject[] | null;
  nextLabel?: string;
  onNext: (check: TaskCheck) => void;
}

function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

interface EditorProps<T> {
  value: T;
  onChange: (value: T) => void;
  locked: boolean;
}

function ChoiceEditor({ options, value, onChange, locked, multiple, correct }: EditorProps<number[]> & { options: string[]; multiple: boolean; correct: number[] | null }) {
  const toggle = (index: number) => {
    if (locked) return;
    if (!multiple) return onChange([index]);
    onChange(value.includes(index) ? value.filter((i) => i !== index) : [...value, index]);
  };
  return (
    <div role={multiple ? 'group' : 'radiogroup'} aria-label="Варианты ответа">
      {options.map((option, index) => {
        const chosen = value.includes(index);
        const state = correct ? (correct.includes(index) ? 'right' : chosen ? 'wrong' : '') : chosen ? 'chosen' : '';
        return (
          <label key={index} className={`eumk-opt ${state}`}>
            <input type={multiple ? 'checkbox' : 'radio'} checked={chosen} disabled={locked} onChange={() => toggle(index)} />
            <span>{option}</span>
          </label>
        );
      })}
    </div>
  );
}

function OrderEditor({ items, value, onChange, locked }: EditorProps<number[]> & { items: string[] }) {
  const left = items.map((_, i) => i).filter((i) => !value.includes(i));
  return (
    <div>
      <p className="eumk-muted">Нажимай карточки по порядку. Нажми на выбранную, чтобы убрать её.</p>
      <div className="eumk-card" role="group" aria-label="Твой порядок" style={{ minHeight: 64 }}>
        {value.length === 0 ? <span className="eumk-muted">Пока пусто</span> : value.map((i, pos) => (
          <button key={i} type="button" className="eumk-chip chosen" disabled={locked} onClick={() => onChange(value.filter((v) => v !== i))} style={{ margin: 4 }}>
            {pos + 1}. {items[i]}
          </button>
        ))}
      </div>
      <div className="eumk-row">
        {left.map((i) => (
          <button key={i} type="button" className="eumk-chip" disabled={locked} onClick={() => onChange([...value, i])}>{items[i]}</button>
        ))}
      </div>
    </div>
  );
}

function SortEditor({ task, value, onChange, locked }: EditorProps<Record<string, string>> & { task: Extract<EumkTask, { type: 'sort' }> }) {
  return (
    <div>
      {task.data.items.map((item) => (
        <div key={item.text} className="eumk-card" style={{ padding: '10px 16px' }}>
          <div>{item.text}</div>
          <div className="eumk-row" style={{ marginTop: 6 }}>
            {task.data.categories.map((cat) => {
              const chosen = value[item.text] === cat;
              const verdict = locked ? (item.category === cat ? ' right' : chosen ? ' wrong' : '') : '';
              return (
                <button key={cat} type="button" className={`eumk-chip${chosen ? ' chosen' : ''}`} aria-pressed={chosen} disabled={locked}
                  style={verdict ? { borderColor: verdict.includes('right') ? 'var(--eumk-good)' : 'var(--eumk-bad)' } : undefined}
                  onClick={() => onChange({ ...value, [item.text]: cat })}>{cat}</button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function MatchEditor({ task, rights, value, onChange, locked }: EditorProps<Record<string, string>> & { task: Extract<EumkTask, { type: 'match' }>; rights: string[] }) {
  return (
    <div>
      {task.data.pairs.map(([left, right]) => {
        const chosen = value[left] ?? '';
        const state = locked ? (chosen === right ? 'right' : 'wrong') : '';
        return (
          <div key={left} className={`eumk-opt ${state}`} style={{ cursor: 'default', alignItems: 'center' }}>
            <span className="eumk-grow">{left}</span>
            <select className="eumk-select" aria-label={left} value={chosen} disabled={locked} onChange={(e) => onChange({ ...value, [left]: e.target.value })}>
              <option value="">выбери…</option>
              {rights.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        );
      })}
    </div>
  );
}

function GapsEditor({ task, value, onChange, locked }: EditorProps<string[]> & { task: Extract<EumkTask, { type: 'gaps' }> }) {
  const parts = task.data.text.split('___');
  return (
    <p style={{ lineHeight: 2.4 }}>
      {parts.map((part, index) => (
        <React.Fragment key={index}>
          {part}
          {index < parts.length - 1 && (
            <select className="eumk-select" aria-label={`Пропуск ${index + 1}`} value={value[index] ?? ''} disabled={locked}
              onChange={(e) => { const next = [...value]; next[index] = e.target.value; onChange(next); }}
              style={locked ? { borderColor: value[index] === task.data.answers[index] ? 'var(--eumk-good)' : 'var(--eumk-bad)' } : undefined}>
              <option value="">…</option>
              {task.data.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          )}
        </React.Fragment>
      ))}
    </p>
  );
}

function initialAnswer(task: EumkTask): unknown {
  switch (task.type) {
    case 'choice': case 'multi': case 'order': return [];
    case 'sort': case 'match': return {};
    case 'gaps': return task.data.answers.map(() => '');
    case 'input': return '';
  }
}

function isAnswered(task: EumkTask, answer: unknown): boolean {
  switch (task.type) {
    case 'choice': case 'multi': return (answer as number[]).length > 0;
    case 'order': return (answer as number[]).length === task.data.items.length;
    case 'sort': return Object.keys(answer as object).length === task.data.items.length;
    case 'match': return Object.keys(answer as object).length === task.data.pairs.length;
    case 'gaps': return (answer as string[]).every((a) => a !== '');
    case 'input': return (answer as string).trim() !== '';
  }
}

export default function TaskView({ task, seed, hint, scene, nextLabel = 'Дальше', onNext }: Props) {
  const rng = useMemo(() => seededRng(hashSeed(`${task.id}|${seed}`)), [task.id, seed]);
  const shownOrder = useMemo(() => {
    if (task.type === 'order') return shuffled(task.data.items.map((_, i) => i), rng).map((i) => task.data.items[i]);
    return [] as string[];
  }, [task, rng]);
  const rights = useMemo(() => (task.type === 'match' ? shuffled(task.data.pairs.map((p) => p[1]), rng) : []), [task, rng]);

  const [answer, setAnswer] = useState<unknown>(() => initialAnswer(task));
  const [check, setCheck] = useState<TaskCheck | null>(null);
  const [showHint, setShowHint] = useState(false);
  const locked = check !== null;

  // Ответ для проверки: у «order» индексы переводятся в тексты карточек.
  const submit = () => {
    const finalAnswer = task.type === 'order' ? (answer as number[]).map((i) => shownOrder[i]) : answer;
    setCheck(checkTask(task, finalAnswer));
  };

  let editor: React.ReactNode = null;
  switch (task.type) {
    case 'choice':
    case 'multi':
      editor = <ChoiceEditor options={task.data.options} multiple={task.type === 'multi'} value={answer as number[]} onChange={setAnswer} locked={locked} correct={locked ? task.data.correct : null} />;
      break;
    case 'order':
      editor = <OrderEditor items={shownOrder} value={answer as number[]} onChange={setAnswer} locked={locked} />;
      break;
    case 'sort':
      editor = <SortEditor task={task} value={answer as Record<string, string>} onChange={setAnswer} locked={locked} />;
      break;
    case 'match':
      editor = <MatchEditor task={task} rights={rights} value={answer as Record<string, string>} onChange={setAnswer} locked={locked} />;
      break;
    case 'gaps':
      editor = <GapsEditor task={task} value={answer as string[]} onChange={setAnswer} locked={locked} />;
      break;
    case 'input':
      editor = (
        <input className="eumk-input" aria-label="Твой ответ" value={answer as string} disabled={locked} onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && isAnswered(task, answer) && !locked) submit(); }} />
      );
      break;
  }

  return (
    <div className="eumk-card">
      <h3 style={{ marginTop: 0 }}>{task.title}</h3>
      {task.instruction && task.type !== 'gaps' && <p>{task.instruction}</p>}
      {task.type === 'gaps' && task.instruction && <p>{task.instruction}</p>}
      {scene && <SceneView objects={scene} />}
      {editor}
      {hint && !locked && (
        <p>{showHint ? <span className="eumk-muted">Подсказка: {hint}</span> : <button type="button" className="eumk-btn" onClick={() => setShowHint(true)}>Подсказка</button>}</p>
      )}
      {locked && check && (
        <div className={`eumk-note ${check.isCorrect ? 'good' : 'bad'}`} role="status">
          <b>{check.isCorrect ? 'Верно!' : check.share > 0 ? `Частично верно: ${Math.round(check.share * 100)}%` : 'Не совсем так.'}</b>
          {task.explanation && <div>{task.explanation}</div>}
        </div>
      )}
      <div className="eumk-row" style={{ marginTop: 12 }}>
        {!locked ? (
          <button type="button" className="eumk-btn primary" disabled={!isAnswered(task, answer)} onClick={submit}>Проверить</button>
        ) : (
          <button type="button" className="eumk-btn primary" onClick={() => onNext(check!)}>{nextLabel}</button>
        )}
      </div>
    </div>
  );
}
