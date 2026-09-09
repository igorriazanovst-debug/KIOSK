import React, { useEffect, useState } from 'react';
import type { Task } from '@kiosk/shared';
import { checkTaskAnswer, getAnswerMode } from '@kiosk/shared';
import AnswerInput from './AnswerInput';
import TaskVisual from './TaskVisual';

interface Props {
  task: Task;
  soundOn: boolean;
  onCorrect: () => void;
  onClose: () => void;
}

type Phase = 'answering' | 'hint' | 'revealed' | 'success';

const HINTS: Record<Task['typeId'], string> = {
  number_counting: 'Посчитай предметы по одному, указывая на каждый пальцем.',
  number_sum_two: 'Сложи первое число со вторым — можно посчитать на пальцах.',
  number_sum_three: 'Складывай числа по порядку, слева направо.',
  number_missing: 'Посмотри, на сколько увеличивается каждое следующее число в ряду.',
  compare_length: 'Сравни отрезки — посмотри, какой из них длиннее визуально.',
  number_subtract_two: 'Убери из первого числа второе — можно посчитать на пальцах.',
  number_compare: 'Посмотри на оба числа и найди нужное — большее или меньшее.',
  digit_recognition: 'Вспомни, как выглядит эта цифра, и найди такую же среди вариантов.',
  number_composition: 'Подумай, сколько нужно прибавить к известной части, чтобы получить целое число.',
  number_ordering: 'Сравни все числа между собой, чтобы найти нужное.',
  number_multiply_two: 'Сложи первое число само с собой столько раз, сколько указывает второе.',
  number_divide_remainder: 'Подумай, сколько раз второе число помещается в первом, и что останется.',
  number_multiple_check: 'Проверь каждое число по очереди — делится ли оно без остатка.',
  round_to_ten: 'Посмотри на цифру единиц: если она 5 или больше — округляй вверх, иначе вниз.',
  ordinal_position: 'Посчитай числа по порядку слева направо, пока не дойдёшь до нужного места.',
};

function playNarration(task: Task) {
  if (!task.audioTaskTextId) return;
  const audio = new Audio(`./media/${task.audioTaskTextId}.mp3`);
  audio.play().catch(() => {});
}

const TaskRunner: React.FC<Props> = ({ task, soundOn, onCorrect, onClose }) => {
  const [answer, setAnswer] = useState<number | string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [phase, setPhase] = useState<Phase>('answering');

  useEffect(() => {
    if (soundOn) playNarration(task);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit() {
    if (answer == null || phase !== 'answering') return;
    if (checkTaskAnswer(task, answer)) {
      setPhase('success');
      setTimeout(onCorrect, 1200);
      return;
    }
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    setPhase(nextAttempts >= 2 ? 'revealed' : 'hint');
  }

  function handleRestart() {
    setAnswer(null);
    setAttempts(0);
    setPhase('answering');
    if (soundOn) playNarration(task);
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span>{task.text}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => soundOn && playNarration(task)} title="Повторить озвучку">🔊</button>
          <button onClick={handleRestart} title="Начать сначала">↺</button>
          <button onClick={onClose} title="Закрыть">✕</button>
        </div>
      </div>

      <TaskVisual task={task} />

      <AnswerInput
        mode={getAnswerMode(task.typeId)}
        choices={task.choices}
        value={answer}
        onChange={setAnswer}
        disabled={phase !== 'answering'}
      />

      {phase === 'hint' && <div style={hintStyle}>Попробуй ещё раз. Подсказка: {HINTS[task.typeId]}</div>}
      {phase === 'revealed' && <div style={revealStyle}>Правильный ответ: {String(task.correctAnswer)}</div>}
      {phase === 'success' && <div style={successStyle}>🎉 Верно!</div>}

      <button
        onClick={phase === 'revealed' ? onCorrect : handleSubmit}
        disabled={phase === 'success' || (answer == null && phase !== 'revealed')}
        style={submitButtonStyle}
      >
        {phase === 'revealed' ? 'Дальше' : 'Ответить'}
      </button>
    </div>
  );
};

const containerStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 16, padding: 24, alignItems: 'center', background: '#fdf6e3', minHeight: '100%', boxSizing: 'border-box' };
const headerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: 640, fontSize: 20, fontWeight: 700 };
const hintStyle: React.CSSProperties = { background: '#fff3cd', padding: 12, borderRadius: 8, maxWidth: 500, textAlign: 'center' };
const revealStyle: React.CSSProperties = { background: '#f8d7da', padding: 12, borderRadius: 8 };
const successStyle: React.CSSProperties = { fontSize: 24 };
const submitButtonStyle: React.CSSProperties = { padding: '12px 32px', fontSize: 18, fontWeight: 700, borderRadius: 10, background: '#e67e22', color: '#fff', border: 'none', cursor: 'pointer' };

export default TaskRunner;
