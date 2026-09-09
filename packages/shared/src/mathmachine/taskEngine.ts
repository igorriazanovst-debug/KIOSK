// Реестр параметризуемых типов заданий — ядро масштабируемости к Этапу 2
// (спека, разд. 4). Тип задания — это код (не данные): режим ответа +
// функция проверки. Задание-экземпляр — просто {id, typeId, params}.

import type { Task, TaskTypeId } from './model/schema';

export type AnswerMode = 'numeric' | 'choice';

export interface TaskTypeDefinition {
  id: TaskTypeId;
  answerMode: AnswerMode;
  checkAnswer: (task: Task, userAnswer: number | string) => boolean;
}

function numericCheck(task: Task, userAnswer: number | string): boolean {
  if (typeof task.correctAnswer !== 'number') return false;
  const given = typeof userAnswer === 'number' ? userAnswer : Number(userAnswer);
  return Number.isFinite(given) && given === task.correctAnswer;
}

function choiceCheck(task: Task, userAnswer: number | string): boolean {
  return String(userAnswer) === String(task.correctAnswer);
}

export const TASK_TYPE_REGISTRY: Record<TaskTypeId, TaskTypeDefinition> = {
  number_counting: { id: 'number_counting', answerMode: 'numeric', checkAnswer: numericCheck },
  number_sum_two: { id: 'number_sum_two', answerMode: 'numeric', checkAnswer: numericCheck },
  number_sum_three: { id: 'number_sum_three', answerMode: 'numeric', checkAnswer: numericCheck },
  number_missing: { id: 'number_missing', answerMode: 'numeric', checkAnswer: numericCheck },
  compare_length: { id: 'compare_length', answerMode: 'choice', checkAnswer: choiceCheck },
  number_subtract_two: { id: 'number_subtract_two', answerMode: 'numeric', checkAnswer: numericCheck },
  number_compare: { id: 'number_compare', answerMode: 'choice', checkAnswer: choiceCheck },
  digit_recognition: { id: 'digit_recognition', answerMode: 'choice', checkAnswer: choiceCheck },
  number_composition: { id: 'number_composition', answerMode: 'numeric', checkAnswer: numericCheck },
  number_ordering: { id: 'number_ordering', answerMode: 'choice', checkAnswer: choiceCheck },
  number_multiply_two: { id: 'number_multiply_two', answerMode: 'numeric', checkAnswer: numericCheck },
  number_divide_remainder: { id: 'number_divide_remainder', answerMode: 'choice', checkAnswer: choiceCheck },
  number_multiple_check: { id: 'number_multiple_check', answerMode: 'choice', checkAnswer: choiceCheck },
  round_to_ten: { id: 'round_to_ten', answerMode: 'numeric', checkAnswer: numericCheck },
  ordinal_position: { id: 'ordinal_position', answerMode: 'numeric', checkAnswer: numericCheck },
};

export function checkTaskAnswer(task: Task, userAnswer: number | string): boolean {
  const def = TASK_TYPE_REGISTRY[task.typeId];
  if (!def) throw new Error(`Unknown task type: ${task.typeId}`);
  return def.checkAnswer(task, userAnswer);
}

export function getAnswerMode(typeId: TaskTypeId): AnswerMode {
  const def = TASK_TYPE_REGISTRY[typeId];
  if (!def) throw new Error(`Unknown task type: ${typeId}`);
  return def.answerMode;
}
