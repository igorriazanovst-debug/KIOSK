import React, { useEffect, useState } from 'react';
import type { Task } from '@kiosk/shared';
import { checkTaskAnswer, getAnswerMode } from '@kiosk/shared';
import AnswerInput from './AnswerInput';
import TaskVisual from './TaskVisual';
import Mascot from './Mascot';
import { COLOR, FONT, RADIUS, SHADOW } from './theme';

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
  share_of_whole: 'Раздели общее количество предметов поровну между всеми частями — можно раздавать по одному, пока не закончатся.',
  compare_mass: 'Подумай, какой из двух предметов тяжелее в жизни — представь, что держишь их в руках.',
  compare_volume: 'Подумай, что вместило бы больше воды, если бы ты наливал её из крана.',
  weekday_order: 'Вспомни порядок дней недели по порядку: понедельник, вторник, среда...',
  season_order: 'Вспомни порядок времён года по кругу: зима, весна, лето, осень — и снова зима.',
  event_order: 'Подумай, что из двух событий обычно случается раньше.',
  estimate_mass_volume: 'Сравни предмет с чем-то знакомым похожего размера.',
  estimate_fraction: 'Сравни числители — у дробей с одинаковым знаменателем больше та, у которой числитель больше.',
  count_then_add: 'Сначала посчитай кружки в каждой группе по отдельности, потом сложи два числа.',
  count_then_subtract: 'Сначала посчитай кружки в каждой группе по отдельности, потом вычти меньшее число из большего.',
  clock_reading: 'Короткая стрелка показывает час, длинная — минуты. Посмотри, на какую цифру указывает короткая стрелка.',
  mass_measurement: 'Посмотри, на какое деление шкалы указывает стрелка весов.',
  right_angle_recognition: 'Прямой угол выглядит как уголок листа бумаги или буквы «Г» — не острый и не широкий.',
  shape_naming: 'Посчитай стороны и углы фигуры — это поможет вспомнить её название.',
  shape_properties: 'Обведи пальцем контур фигуры и посчитай, сколько раз ты повернул в углу.',
  solid_naming: 'Подумай, на какой знакомый предмет похоже это тело — мяч, коробка, шляпа фокусника?',
  solid_properties: 'Посчитай, сколько у тела плоских (не круглых) сторон-граней.',
  spatial_position: 'Посмотри, где находится мяч — выше, ниже, левее или правее коробки.',
  spatial_direction: 'Посмотри, в какую сторону смотрит остриё стрелки.',
  spatial_ordering: 'Сравни фигуры по размеру одну за другой, начиная с самой маленькой или самой большой.',
  grid_coordinates: 'Сначала найди букву столбца сверху, потом число строки слева — координата состоит из буквы и числа.',
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
    if (answer == null || phase === 'success' || phase === 'revealed') return;
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
          {task.audioTaskTextId && (
            <button onClick={() => soundOn && playNarration(task)} title="Повторить озвучку" style={iconButtonStyle}>🔊</button>
          )}
          <button onClick={handleRestart} title="Начать сначала" style={iconButtonStyle}>↺</button>
          <button onClick={onClose} title="Закрыть" style={iconButtonStyle}>✕</button>
        </div>
      </div>

      <TaskVisual task={task} />

      <AnswerInput
        mode={getAnswerMode(task.typeId)}
        choices={task.choices}
        value={answer}
        onChange={setAnswer}
        disabled={phase === 'success' || phase === 'revealed'}
      />

      {phase === 'hint' && (
        <div style={hintStyle}>
          <Mascot pose="thinking" size={56} />
          <span>Попробуй ещё раз. Подсказка: {HINTS[task.typeId]}</span>
        </div>
      )}
      {phase === 'revealed' && <div style={revealStyle}>Правильный ответ: {String(task.correctAnswer)}</div>}
      {phase === 'success' && (
        <div style={successStyle}>
          <Mascot pose="celebrating" size={72} />
          <span>Верно!</span>
        </div>
      )}

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

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
  padding: 28,
  alignItems: 'center',
  background: COLOR.cream,
  minHeight: '100%',
  boxSizing: 'border-box',
  fontFamily: FONT.ui,
  color: COLOR.text,
};
const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  width: '100%',
  maxWidth: 640,
  fontSize: 20,
  fontWeight: 700,
  color: COLOR.indigoDark,
};
const iconButtonStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: RADIUS.sm,
  border: `2px solid ${COLOR.border}`,
  background: COLOR.surface,
  cursor: 'pointer',
  fontSize: 16,
};
const hintStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  background: COLOR.amberLight,
  border: `2px solid ${COLOR.amber}`,
  padding: '12px 20px',
  borderRadius: RADIUS.md,
  maxWidth: 560,
  textAlign: 'left',
};
const revealStyle: React.CSSProperties = {
  background: COLOR.indigoLight,
  color: COLOR.indigoDark,
  padding: '12px 20px',
  borderRadius: RADIUS.md,
  fontWeight: 700,
};
const successStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  fontSize: 26,
  fontWeight: 700,
  color: COLOR.mintDark,
};
const submitButtonStyle: React.CSSProperties = {
  padding: '13px 36px',
  fontFamily: FONT.ui,
  fontSize: 18,
  fontWeight: 700,
  borderRadius: RADIUS.md,
  background: COLOR.amber,
  color: COLOR.text,
  border: 'none',
  cursor: 'pointer',
  boxShadow: SHADOW.card,
};

export default TaskRunner;
