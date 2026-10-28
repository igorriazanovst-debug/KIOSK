// Итоговый тест: случайная сборка из банка при каждом входе, отчёт с
// баллами, оценкой и временем прохождения.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { buildTest, formatDuration, scoreTest, type TestReport } from '../testEngine.ts';
import { runtimeRng } from '../rng.ts';
import { newResultId } from '../userData.ts';
import type { EumkContent, TestResult } from '../model/schema.ts';

interface Props {
  content: EumkContent;
  accountId: string;
  previousSignatures: string[];
  onFinish: (result: TestResult) => void;
  onExit: () => void;
}

export function ReportView({ report, blockTitles }: { report: TestReport; blockTitles: Record<string, string> }) {
  const mistakes = report.items.filter((i) => !i.isCorrect);
  return (
    <div>
      <div className="eumk-card">
        <div className="eumk-row" style={{ gap: 32 }}>
          <div><div className="eumk-muted">Отметка</div><div className="eumk-big" aria-label={`Отметка ${report.grade}`}>{report.grade}</div></div>
          <div><div className="eumk-muted">Баллы</div><div className="eumk-big">{report.correct} из {report.total}</div></div>
          <div><div className="eumk-muted">Время</div><div className="eumk-big" style={{ fontSize: 36 }}>{formatDuration(report.durationSeconds)}</div></div>
          <div><div className="eumk-muted">Верных ответов</div><div className="eumk-big" style={{ fontSize: 36 }}>{Math.round(report.share * 100)}%</div></div>
        </div>
      </div>
      <h3>По блокам теории</h3>
      <table className="eumk-table">
        <thead><tr><th>Блок</th><th>Верно</th></tr></thead>
        <tbody>{report.byBlock.map((b) => <tr key={b.block}><td>{blockTitles[b.block] ?? b.block}</td><td>{b.correct} из {b.total}</td></tr>)}</tbody>
      </table>
      {mistakes.length > 0 && <h3>Разбор ошибок</h3>}
      {mistakes.map((m) => (
        <div key={m.id} className="eumk-card">
          <b>{m.question}</b>
          <p>Ваш ответ: {m.chosenPosition === null ? <i>нет ответа</i> : m.options[m.chosenPosition]}</p>
          <p className="eumk-note good">Верно: {m.options[m.correctPosition]}</p>
          {m.explanation && <p className="eumk-muted">{m.explanation}</p>}
        </div>
      ))}
    </div>
  );
}

export default function TestScreen({ content, accountId, previousSignatures, onFinish, onExit }: Props) {
  // Набор вопросов собирается один раз при входе на экран.
  const test = useMemo(
    () => buildTest({ bank: content.bank, count: content.test.questionCount, rng: runtimeRng(), previousSignatures }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const startedAt = useRef(Date.now());
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [report, setReport] = useState<TestReport | null>(null);
  const [now, setNow] = useState(Date.now());
  const saved = useRef(false);

  const blockTitles = useMemo(() => Object.fromEntries(content.theory.map((b) => [b.id, b.title])), [content]);
  const limit = content.test.timeLimitSeconds;
  const elapsed = Math.max(0, Math.floor((now - startedAt.current) / 1000));

  const finish = (): void => {
    if (saved.current) return;
    saved.current = true;
    const seconds = Math.max(0, Math.floor((Date.now() - startedAt.current) / 1000));
    const result = scoreTest(test, answers, content.test.gradeScale, seconds);
    setReport(result);
    const ts = Date.now();
    onFinish({
      id: newResultId(ts), accountId, finishedAt: ts, durationSeconds: result.durationSeconds, correct: result.correct, total: result.total,
      grade: result.grade, signature: test.signature, questionIds: test.questions.map((q) => q.id),
    });
  };

  useEffect(() => {
    if (!started || report) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [started, report]);

  useEffect(() => {
    if (started && !report && limit !== null && elapsed >= limit) finish();
  });

  if (report) {
    return (
      <div className="eumk-narrow">
        <h2>Результат итогового теста</h2>
        <ReportView report={report} blockTitles={blockTitles} />
        <div className="eumk-row"><button type="button" className="eumk-btn primary" onClick={onExit}>В меню</button></div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="eumk-narrow">
        <h2>Итоговый тест</h2>
        <div className="eumk-card">
          <p>В тесте {test.questions.length} вопросов. Они выбираются случайно из банка в {content.bank.length} вопросов, поэтому при каждом входе набор новый.</p>
          <p>В конце вы получите баллы, отметку и время прохождения. Время идёт с нажатия «Начать».</p>
          {test.isRepeat && <div className="eumk-note info">Все возможные наборы уже были, поэтому один из прежних может повториться.</div>}
          <div className="eumk-row">
            <button type="button" className="eumk-btn primary" onClick={() => { startedAt.current = Date.now(); setNow(Date.now()); setStarted(true); }}>Начать</button>
            <button type="button" className="eumk-btn" onClick={onExit}>В меню</button>
          </div>
        </div>
      </div>
    );
  }

  const q = test.questions[index];
  const answered = Object.keys(answers).length;
  return (
    <div className="eumk-narrow">
      <div className="eumk-row">
        <span>Вопрос {index + 1} из {test.questions.length}</span>
        <span className="eumk-grow" />
        <span aria-live="off">Время: {formatDuration(elapsed)}{limit !== null ? ` из ${formatDuration(limit)}` : ''}</span>
      </div>
      <div className="eumk-progress" aria-hidden="true"><div style={{ width: `${(answered / test.questions.length) * 100}%` }} /></div>
      <div className="eumk-card">
        <h3 style={{ marginTop: 0 }}>{q.question}</h3>
        <div role="radiogroup" aria-label="Варианты ответа">
          {q.options.map((option, position) => (
            <label key={position} className={`eumk-opt${answers[q.id] === position ? ' chosen' : ''}`}>
              <input type="radio" name={q.id} checked={answers[q.id] === position} onChange={() => setAnswers({ ...answers, [q.id]: position })} />
              <span>{option}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="eumk-row">
        <button type="button" className="eumk-btn" disabled={index === 0} onClick={() => setIndex(index - 1)}>← Назад</button>
        {index < test.questions.length - 1
          ? <button type="button" className="eumk-btn primary" onClick={() => setIndex(index + 1)}>Дальше →</button>
          : <button type="button" className="eumk-btn primary" onClick={finish}>Завершить тест</button>}
        <span className="eumk-grow" />
        <span className="eumk-muted">Отвечено: {answered} из {test.questions.length}</span>
      </div>
      {answered < test.questions.length && index === test.questions.length - 1 && (
        <p className="eumk-note info">Есть вопросы без ответа: они будут засчитаны как неверные.</p>
      )}
    </div>
  );
}
