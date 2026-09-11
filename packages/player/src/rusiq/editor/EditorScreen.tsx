// packages/player/src/rusiq/editor/EditorScreen.tsx
// Собирает воедино канвас точек, форму вопроса, undo/redo (переиспользует
// packages/player/src/chrono/history.ts напрямую - генерик, не привязан
// к конкретному типу), сохранение (с отложенной записью фонового
// изображения для только что созданных викторин) и пароль викторины.

import React, { useEffect, useState } from 'react';
import { initHistory, pushHistory, undo, redo, canUndo, canRedo, type History } from '../../chrono/history.ts';
import QuizCanvas, { type QuizCanvasAddMode } from './QuizCanvas.tsx';
import PointEditForm from './PointEditForm.tsx';
import { hashSecret } from './pinAuth.ts';
import { saveQuiz, saveQuizBackground } from './quizStore.ts';
import { RusiqQuizSchema, type RusiqPoint, type RusiqQuestion, type RusiqQuiz } from '../model/schema.ts';

interface Props {
  initialQuiz: RusiqQuiz;
  pendingBackground: { buffer: ArrayBuffer; mimeType: string } | null;
  onExit: (savedQuiz: RusiqQuiz | null) => void;
}

type Selection = { kind: 'question'; questionId: string } | { kind: 'decoy-of-question'; questionId: string; decoyIndex: number } | { kind: 'generic-decoy'; index: number } | null;

function makeBlankQuestion(point: RusiqPoint): RusiqQuestion {
  return {
    id: crypto.randomUUID(),
    text: '',
    answer: '',
    helpText: '',
    x: point.x,
    y: point.y,
    decoyPoints: [],
    price: 100,
    timeSeconds: 30,
    level: 1,
    theme: '',
  };
}

const EditorScreen: React.FC<Props> = ({ initialQuiz, pendingBackground, onExit }) => {
  const [history, setHistory] = useState<History<RusiqQuiz>>(() => initHistory(initialQuiz));
  const [lastSavedQuiz, setLastSavedQuiz] = useState<RusiqQuiz | null>(pendingBackground ? null : initialQuiz);
  const [pendingBg, setPendingBg] = useState(pendingBackground);
  const [selection, setSelection] = useState<Selection>(null);
  const [addMode, setAddMode] = useState<QuizCanvasAddMode>('none');
  const [passwordDraft, setPasswordDraft] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const quiz = history.present;
  const hasUnsavedChanges = lastSavedQuiz === null || JSON.stringify(lastSavedQuiz) !== JSON.stringify(quiz);
  const [backgroundUrl, setBackgroundUrl] = useState('');

  // Не создавать blob URL прямо в теле рендера: без этого каждый ре-рендер
  // (любое движение точки, любая правка формы вопроса) заново копировал бы
  // pendingBg.buffer в новый Blob и плодил бы объектные URL, ни один из
  // которых никогда не освобождался - утечка памяти на всё время сессии
  // редактирования новой викторины (найдено ревью Задачи 11, Important).
  useEffect(() => {
    if (pendingBg) {
      const url = URL.createObjectURL(new Blob([pendingBg.buffer], { type: pendingBg.mimeType }));
      setBackgroundUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setBackgroundUrl(`rusiqmedia:///${quiz.image.fileName}`);
    return undefined;
  }, [pendingBg, quiz.image.fileName]);

  function update(next: RusiqQuiz) {
    setHistory((h) => pushHistory(h, next));
  }

  function handleAddQuestionPoint(point: RusiqPoint) {
    const question = makeBlankQuestion(point);
    update({ ...quiz, questions: [...quiz.questions, question] });
    setSelection({ kind: 'question', questionId: question.id });
    setAddMode('none');
  }

  function handleAddDecoyToSelected(point: RusiqPoint) {
    if (selection?.kind !== 'question') return;
    update({
      ...quiz,
      questions: quiz.questions.map((q) => (q.id === selection.questionId ? { ...q, decoyPoints: [...q.decoyPoints, point] } : q)),
    });
  }

  function handleAddGenericDecoy(point: RusiqPoint) {
    update({ ...quiz, genericDecoyPoints: [...quiz.genericDecoyPoints, point] });
  }

  function handleMoveQuestionPoint(id: string, point: RusiqPoint) {
    update({ ...quiz, questions: quiz.questions.map((q) => (q.id === id ? { ...q, x: point.x, y: point.y } : q)) });
  }

  function handleMoveDecoyOfQuestion(questionId: string, decoyIndex: number, point: RusiqPoint) {
    update({
      ...quiz,
      questions: quiz.questions.map((q) =>
        q.id === questionId ? { ...q, decoyPoints: q.decoyPoints.map((d, i) => (i === decoyIndex ? point : d)) } : q,
      ),
    });
  }

  function handleMoveGenericDecoy(index: number, point: RusiqPoint) {
    update({ ...quiz, genericDecoyPoints: quiz.genericDecoyPoints.map((d, i) => (i === index ? point : d)) });
  }

  function handleQuestionChange(updated: RusiqQuestion) {
    update({ ...quiz, questions: quiz.questions.map((q) => (q.id === updated.id ? updated : q)) });
  }

  function handleDeleteSelectedQuestion() {
    if (selection?.kind !== 'question') return;
    update({ ...quiz, questions: quiz.questions.filter((q) => q.id !== selection.questionId) });
    setSelection(null);
  }

  function handleDeleteDecoyOfQuestion(questionId: string, decoyIndex: number) {
    update({
      ...quiz,
      questions: quiz.questions.map((q) => (q.id === questionId ? { ...q, decoyPoints: q.decoyPoints.filter((_, i) => i !== decoyIndex) } : q)),
    });
    setSelection(null);
  }

  function handleDeleteGenericDecoy(index: number) {
    update({ ...quiz, genericDecoyPoints: quiz.genericDecoyPoints.filter((_, i) => i !== index) });
    setSelection(null);
  }

  async function handleSetPassword() {
    if (passwordDraft.trim().length === 0) return;
    const hash = await hashSecret(passwordDraft.trim());
    update({ ...quiz, passwordHash: hash });
    setPasswordDraft('');
  }

  function handleClearPassword() {
    update({ ...quiz, passwordHash: null });
  }

  async function handleSave() {
    // RusiqQuizSchema.questions требует .min(1) (packages/player/src/rusiq/
    // model/schema.ts) - без этой проверки только что созданная викторина
    // (0 вопросов) успешно пишется на диск (главный процесс не валидирует
    // схемой), но становится НЕОТКРЫВАЕМОЙ насовсем: quizStore.loadQuiz()
    // проверяет RusiqQuizSchema.safeParse и вернёт null, каталог покажет
    // «файл повреждён» для викторины, которая на самом деле просто пуста.
    // Найдено ревью Задачи 8 (Important). Оставлено как отдельная быстрая
    // проверка (самый частый случай) ПЕРЕД полной проверкой схемой ниже.
    if (quiz.questions.length === 0) {
      setSaveError('Добавьте хотя бы один вопрос перед сохранением');
      return;
    }
    // Полная валидация СХЕМОЙ, а не вручную выбранным подмножеством полей:
    // RusiqQuestionSchema дополнительно требует непустые text/answer/theme и
    // положительные price/timeSeconds, а RusiqQuizSchema.superRefine отвергает
    // точки за пределами [0,width]x[0,height] изображения. makeBlankQuestion
    // создаёт вопрос именно с пустыми text/answer/theme - обычный сценарий
    // "добавили несколько точек, заполнили не все, сохранили" писал на диск
    // файл, который затем НАВСЕГДА не открывался (loadQuiz -> safeParse ->
    // null -> "файл повреждён"). Проверка вручную дублировала бы схему и
    // неизбежно разошлась бы с ней со временем - используем саму схему
    // (найдено ревью Задачи 11, Critical).
    const parsed = RusiqQuizSchema.safeParse(quiz);
    if (!parsed.success) {
      setSaveError(
        'Заполните текст, ответ и тему для всех вопросов, укажите положительные вес и время, и убедитесь, что все точки находятся внутри изображения',
      );
      return;
    }
    setSaving(true);
    setSaveError(null);
    if (pendingBg) {
      const bgResult = await saveQuizBackground(quiz.id, pendingBg.buffer, pendingBg.mimeType);
      if (!bgResult.ok) {
        setSaveError('Не удалось сохранить фоновое изображение');
        setSaving(false);
        return;
      }
      setPendingBg(null);
    }
    const ok = await saveQuiz(quiz);
    setSaving(false);
    if (!ok) {
      setSaveError('Не удалось сохранить викторину — попробуйте ещё раз');
      return;
    }
    setLastSavedQuiz(quiz);
  }

  function handleExit() {
    if (hasUnsavedChanges && !confirm('Выйти без сохранения?')) return;
    onExit(lastSavedQuiz);
  }

  const selectedQuestion = selection?.kind === 'question' ? quiz.questions.find((q) => q.id === selection.questionId) ?? null : null;
  const existingThemes = Array.from(new Set(quiz.questions.map((q) => q.theme).filter((t) => t.length > 0)));

  return (
    <div style={{ display: 'flex', gap: 16, padding: 16, fontFamily: 'sans-serif' }}>
      <div>
        <div style={{ marginBottom: 8, display: 'flex', gap: 8 }}>
          <button onClick={() => setAddMode(addMode === 'question' ? 'none' : 'question')} style={{ fontWeight: addMode === 'question' ? 'bold' : 'normal' }}>
            Добавить вопрос
          </button>
          <button
            onClick={() => setAddMode(addMode === 'decoy-of-selected' ? 'none' : 'decoy-of-selected')}
            disabled={selection?.kind !== 'question'}
            style={{ fontWeight: addMode === 'decoy-of-selected' ? 'bold' : 'normal' }}
          >
            Добавить ложную точку к вопросу
          </button>
          <button onClick={() => setAddMode(addMode === 'generic-decoy' ? 'none' : 'generic-decoy')} style={{ fontWeight: addMode === 'generic-decoy' ? 'bold' : 'normal' }}>
            Добавить общую ложную точку
          </button>
        </div>
        <p style={{ fontSize: 12, opacity: 0.7 }}>Общих ложных точек: {quiz.genericDecoyPoints.length} из рекомендуемых 10</p>
        <QuizCanvas
          imageUrl={backgroundUrl}
          imageWidth={quiz.image.width}
          imageHeight={quiz.image.height}
          questions={quiz.questions}
          genericDecoyPoints={quiz.genericDecoyPoints}
          selectedQuestionId={selection?.kind === 'question' ? selection.questionId : null}
          addMode={addMode}
          onSelectQuestion={(id) => setSelection(id ? { kind: 'question', questionId: id } : null)}
          onAddQuestionPoint={handleAddQuestionPoint}
          onAddDecoyToSelected={handleAddDecoyToSelected}
          onAddGenericDecoy={handleAddGenericDecoy}
          onMoveQuestionPoint={handleMoveQuestionPoint}
          onMoveDecoyOfQuestion={handleMoveDecoyOfQuestion}
          onMoveGenericDecoy={handleMoveGenericDecoy}
          onSelectDecoyOfQuestion={(questionId, decoyIndex) => setSelection({ kind: 'decoy-of-question', questionId, decoyIndex })}
          onSelectGenericDecoy={(index) => setSelection({ kind: 'generic-decoy', index })}
        />
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <button onClick={() => setHistory(undo)} disabled={!canUndo(history)}>
            Отменить
          </button>
          <button onClick={() => setHistory(redo)} disabled={!canRedo(history)}>
            Повторить
          </button>
        </div>
      </div>
      <div style={{ width: 320 }}>
        <label style={{ display: 'block', marginBottom: 8 }}>
          Название викторины
          <input value={quiz.title} onChange={(e) => update({ ...quiz, title: e.target.value })} style={{ display: 'block', width: '100%', padding: 6 }} />
        </label>
        {selectedQuestion && (
          <PointEditForm
            question={selectedQuestion}
            existingThemes={existingThemes}
            onChange={handleQuestionChange}
            onDelete={handleDeleteSelectedQuestion}
            onClose={() => setSelection(null)}
          />
        )}
        {selection?.kind === 'decoy-of-question' && (
          <div style={{ border: '1px solid #ccc', padding: 16, borderRadius: 8 }}>
            <p>Ложная точка вопроса</p>
            <button onClick={() => handleDeleteDecoyOfQuestion(selection.questionId, selection.decoyIndex)}>Удалить эту точку</button>
          </div>
        )}
        {selection?.kind === 'generic-decoy' && (
          <div style={{ border: '1px solid #ccc', padding: 16, borderRadius: 8 }}>
            <p>Общая ложная точка</p>
            <button onClick={() => handleDeleteGenericDecoy(selection.index)}>Удалить эту точку</button>
          </div>
        )}
        <div style={{ marginTop: 16, border: '1px solid #ccc', padding: 16, borderRadius: 8 }}>
          <p style={{ margin: 0 }}>Пароль викторины: {quiz.passwordHash ? 'установлен' : 'не установлен'}</p>
          <input
            type="password"
            placeholder="Новый пароль"
            value={passwordDraft}
            onChange={(e) => setPasswordDraft(e.target.value)}
            style={{ display: 'block', width: '100%', padding: 6, marginTop: 8 }}
          />
          <div style={{ marginTop: 8 }}>
            <button onClick={handleSetPassword} disabled={passwordDraft.trim().length === 0}>
              Задать пароль
            </button>
            {quiz.passwordHash && (
              <button onClick={handleClearPassword} style={{ marginLeft: 8 }}>
                Снять пароль
              </button>
            )}
          </div>
        </div>
        {saveError && <p style={{ color: '#c0392b' }}>{saveError}</p>}
        <div style={{ marginTop: 16 }}>
          <button onClick={handleSave} disabled={saving}>
            Сохранить
          </button>
          <button onClick={handleExit} style={{ marginLeft: 8 }}>
            Назад к каталогу
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditorScreen;
