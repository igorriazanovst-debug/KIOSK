// packages/player/src/periodictable/screens/QuizTab.tsx
import React, { useState } from 'react';
import type { PeriodicElement } from '../model/schema.ts';
import { generateQuestion, checkAnswer, QUIZ_FIELD_LABEL_RU, type QuizQuestion } from '../quizEngine.ts';

interface Props {
  elements: PeriodicElement[];
}

// Счёт живёт только на время сессии виджета (не в localStorage) — это
// быстрая игровая разминка для музейного посетителя, не отслеживаемый
// прогресс ученика (тот уже есть отдельно — вкладка «Прогресс»).
const QuizTab: React.FC<Props> = ({ elements }) => {
  const [question, setQuestion] = useState<QuizQuestion | null>(() => (elements.length >= 4 ? generateQuestion(elements) : null));
  const [chosen, setChosen] = useState<string | number | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  if (!question) {
    return <div style={{ padding: 20, textAlign: 'center', color: '#90a4ae' }}>Викторина недоступна — не удалось загрузить справочник.</div>;
  }

  function handleChoose(option: string | number) {
    if (chosen !== null) return; // уже ответили на этот вопрос
    setChosen(option);
    const isCorrect = checkAnswer(question!, option);
    setScore((s) => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }));
  }

  function nextQuestion() {
    setQuestion(generateQuestion(elements));
    setChosen(null);
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 'bold', fontSize: 15, color: '#0d47a1' }}>Мини-викторина</div>
        <div style={{ fontSize: 13, color: '#607d8b' }}>
          Счёт: {score.correct} / {score.total}
        </div>
      </div>

      <div style={{ padding: '14px 16px', background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: '#0d47a1', marginBottom: 4 }}>
          У какого элемента {QUIZ_FIELD_LABEL_RU[question.answerField]}, если {QUIZ_FIELD_LABEL_RU[question.promptField]} — «{question.promptValue}»?
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
        {question.options.map((option) => {
          const isCorrectOption = option === question.correctAnswer;
          const isChosenOption = option === chosen;
          let background = '#fafafa';
          let border = '1px solid #eceff1';
          if (chosen !== null && isCorrectOption) {
            background = '#e8f5e9';
            border = '2px solid #66bb6a';
          } else if (chosen !== null && isChosenOption && !isCorrectOption) {
            background = '#ffebee';
            border = '2px solid #ef5350';
          }
          return (
            <button
              key={String(option)}
              onClick={() => handleChoose(option)}
              disabled={chosen !== null}
              style={{
                padding: '12px 10px',
                background,
                border,
                borderRadius: 8,
                fontSize: 15,
                cursor: chosen === null ? 'pointer' : 'default',
              }}
            >
              {option}
            </button>
          );
        })}
      </div>

      {chosen !== null && (
        <button
          onClick={nextQuestion}
          style={{ marginTop: 16, padding: '10px 18px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}
        >
          Следующий вопрос
        </button>
      )}
    </div>
  );
};

export default QuizTab;
