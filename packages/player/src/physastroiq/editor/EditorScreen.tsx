// packages/player/src/physastroiq/editor/EditorScreen.tsx
// Собирает воедино канвас точек, форму вопроса, undo/redo, сохранение и
// пароль викторины. Прямая адаптация rusiq/editor/EditorScreen.tsx (Тип 7)
// с ОДНИМ содержательным архитектурным отличием: своя картинка на КАЖДЫЙ
// из 3 уровней сложности (план реализации Тип11_ФизАстроIQ §3), не одна общая —
// поэтому здесь есть вкладки уровня (currentEditLevel), канвас/точки/
// картинка показывают данные ТОЛЬКО текущего редактируемого уровня, а
// новые вопросы/decoy-точки автоматически получают level = текущая
// вкладка (не редактируемое поле формы — см. комментарий в
// PointEditForm.tsx, почему смена уровня вопроса отдельным полем опасна).

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { initHistory, pushHistory, undo, redo, canUndo, canRedo, type History } from '../../chrono/history.ts';
import QuizCanvas, { type QuizCanvasAddMode } from './QuizCanvas.tsx';
import PointEditForm from './PointEditForm.tsx';
import { hashSecret } from './pinAuth.ts';
import { saveQuiz, saveQuizLevelImage, saveQuizItemImage, deleteQuizItemImage, type PhysastroiqItemImageKind } from './quizStore.ts';
import { physastroiqLevelImageMediaUrl, physastroiqItemImageUrl } from '../physastroiqMediaUrl.ts';
import { PhysastroiqQuizSchema, PHYSASTROIQ_DEFAULT_POINT_SIZE, type PhysastroiqLevelId, type PhysastroiqPoint, type PhysastroiqQuestion, type PhysastroiqQuiz } from '../model/schema.ts';
import { checkPhysastroiqQuiz, PHYSASTROIQ_MIN_GENERIC_DECOYS_PER_LEVEL } from '../model/completeness.ts';
import '../physastroiqTheme.css';

const ITEM_IMAGE_FIELD_BY_KIND: Record<PhysastroiqItemImageKind, 'questionImage' | 'answerImage' | 'hintImage'> = {
  question: 'questionImage',
  answer: 'answerImage',
  hint: 'hintImage',
};

const LEVEL_TABS: { id: PhysastroiqLevelId; label: string }[] = [
  { id: 1, label: 'Начинающий' },
  { id: 2, label: 'Опытный' },
  { id: 3, label: 'Профессионал' },
];

const IMAGE_EXT_BY_MIME: Record<string, string> = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp' };

interface PendingItemImage {
  buffer: ArrayBuffer;
  mimeType: string;
  previewUrl: string;
}

interface PendingLevelImage {
  buffer: ArrayBuffer;
  mimeType: string;
  previewUrl: string;
}

function pendingImageKey(questionId: string, kind: PhysastroiqItemImageKind): string {
  return `${questionId}:${kind}`;
}

interface Props {
  initialQuiz: PhysastroiqQuiz;
  // Картинка уровня 1, застейджированная NewQuizModal при создании новой
  // викторины — то же самое, что pendingBackground у rusiq, просто уже
  // привязана к конкретному уровню (1), а не к единственному общему полю.
  pendingLevel1Image: { buffer: ArrayBuffer; mimeType: string } | null;
  onExit: (savedQuiz: PhysastroiqQuiz | null) => void;
}

type Selection = { kind: 'question'; questionId: string } | { kind: 'decoy-of-question'; questionId: string; decoyIndex: number } | { kind: 'generic-decoy'; index: number } | null;

function makeBlankQuestion(point: PhysastroiqPoint, level: PhysastroiqLevelId): PhysastroiqQuestion {
  return {
    id: crypto.randomUUID(),
    text: '',
    answer: '',
    helpText: '',
    x: point.x,
    y: point.y,
    width: PHYSASTROIQ_DEFAULT_POINT_SIZE,
    height: PHYSASTROIQ_DEFAULT_POINT_SIZE,
    decoyPoints: [],
    price: 100,
    timeSeconds: 30,
    level,
    theme: '',
    questionImage: null,
    answerImage: null,
    hintImage: null,
  };
}

const EditorScreen: React.FC<Props> = ({ initialQuiz, pendingLevel1Image, onExit }) => {
  const [history, setHistory] = useState<History<PhysastroiqQuiz>>(() => initHistory(initialQuiz));
  const [lastSavedQuiz, setLastSavedQuiz] = useState<PhysastroiqQuiz | null>(pendingLevel1Image ? null : initialQuiz);
  const [pendingLevelImages, setPendingLevelImages] = useState<Partial<Record<PhysastroiqLevelId, PendingLevelImage>>>(
    pendingLevel1Image
      ? { 1: { ...pendingLevel1Image, previewUrl: URL.createObjectURL(new Blob([pendingLevel1Image.buffer], { type: pendingLevel1Image.mimeType })) } }
      : {},
  );
  const [currentEditLevel, setCurrentEditLevel] = useState<PhysastroiqLevelId>(1);
  const [selection, setSelection] = useState<Selection>(null);
  const [addMode, setAddMode] = useState<QuizCanvasAddMode>('none');
  const [passwordDraft, setPasswordDraft] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingItemImages, setPendingItemImages] = useState<Record<string, PendingItemImage>>({});

  useEffect(() => {
    return () => {
      Object.values(pendingItemImages).forEach((p) => URL.revokeObjectURL(p.previewUrl));
      Object.values(pendingLevelImages).forEach((p) => p && URL.revokeObjectURL(p.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Найденный баг (2026-09-15): QuizCanvas масштабировал Konva Stage ТОЛЬКО
  // от ширины (900px) — для высокого изображения-карты (наш уровень 1,
  // 1520×1440) канвас получался выше окна плеера (~852px против ~779px),
  // и нижняя часть с точками физически не помещалась, без скролла. Меряем
  // реальную доступную высоту (а не гадаем константу в px — та же
  // дисциплина, что уже стоила бага один раз) и передаём в QuizCanvas,
  // чтобы он выбрал масштаб по МЕНЬШЕЙ из границ ширина/высота.
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null);
  const [canvasMaxHeight, setCanvasMaxHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    function measure() {
      const el = canvasWrapperRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const available = window.innerHeight - top - 16;
      setCanvasMaxHeight(available > 0 ? available : undefined);
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [currentEditLevel]);

  const quiz = history.present;
  const hasUnsavedChanges = lastSavedQuiz === null || JSON.stringify(lastSavedQuiz) !== JSON.stringify(quiz);

  function update(next: PhysastroiqQuiz) {
    setHistory((h) => pushHistory(h, next));
  }

  // Данные, отфильтрованные по ТЕКУЩЕЙ редактируемой вкладке уровня — канвас
  // никогда не видит вопросы/точки других уровней разом.
  const levelQuestions = quiz.questions.filter((q) => q.level === currentEditLevel);
  const levelGenericDecoys = quiz.genericDecoyPoints.filter((p) => p.level === currentEditLevel);
  const levelImageMeta = quiz.images[String(currentEditLevel)];
  const levelPendingImage = pendingLevelImages[currentEditLevel];
  const levelImageUrl = levelPendingImage ? levelPendingImage.previewUrl : levelImageMeta ? physastroiqLevelImageMediaUrl(levelImageMeta.fileName) : null;

  function handleAddQuestionPoint(point: PhysastroiqPoint) {
    const question = makeBlankQuestion(point, currentEditLevel);
    update({ ...quiz, questions: [...quiz.questions, question] });
    setSelection({ kind: 'question', questionId: question.id });
    setAddMode('none');
  }

  function handleAddDecoyToSelected(point: PhysastroiqPoint) {
    if (selection?.kind !== 'question') return;
    update({
      ...quiz,
      questions: quiz.questions.map((q) => (q.id === selection.questionId ? { ...q, decoyPoints: [...q.decoyPoints, point] } : q)),
    });
  }

  function handleAddGenericDecoy(point: PhysastroiqPoint) {
    update({ ...quiz, genericDecoyPoints: [...quiz.genericDecoyPoints, { ...point, level: currentEditLevel }] });
  }

  function handleMoveQuestionPoint(id: string, point: { x: number; y: number }) {
    update({ ...quiz, questions: quiz.questions.map((q) => (q.id === id ? { ...q, x: point.x, y: point.y } : q)) });
  }

  function handleMoveDecoyOfQuestion(questionId: string, decoyIndex: number, point: PhysastroiqPoint) {
    update({
      ...quiz,
      questions: quiz.questions.map((q) =>
        q.id === questionId ? { ...q, decoyPoints: q.decoyPoints.map((d, i) => (i === decoyIndex ? point : d)) } : q,
      ),
    });
  }

  function handleMoveGenericDecoy(index: number, point: PhysastroiqPoint) {
    const target = levelGenericDecoys[index];
    update({
      ...quiz,
      genericDecoyPoints: quiz.genericDecoyPoints.map((d) => (d === target ? { ...point, level: currentEditLevel } : d)),
    });
  }

  function handleQuestionChange(updated: PhysastroiqQuestion) {
    update({ ...quiz, questions: quiz.questions.map((q) => (q.id === updated.id ? updated : q)) });
  }

  async function handleSelectItemImage(questionId: string, kind: PhysastroiqItemImageKind, file: File) {
    const buffer = await file.arrayBuffer();
    const previewUrl = URL.createObjectURL(file);
    const key = pendingImageKey(questionId, kind);
    setPendingItemImages((prev) => {
      const old = prev[key];
      if (old) URL.revokeObjectURL(old.previewUrl);
      return { ...prev, [key]: { buffer, mimeType: file.type, previewUrl } };
    });
  }

  async function handleRemoveItemImage(questionId: string, kind: PhysastroiqItemImageKind) {
    const key = pendingImageKey(questionId, kind);
    if (pendingItemImages[key]) {
      URL.revokeObjectURL(pendingItemImages[key].previewUrl);
      setPendingItemImages((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }
    const field = ITEM_IMAGE_FIELD_BY_KIND[kind];
    const question = quiz.questions.find((q) => q.id === questionId);
    const fileName = question?.[field] ?? null;
    if (fileName) {
      deleteQuizItemImage(fileName);
    }
    handleQuestionChange({ ...(question as PhysastroiqQuestion), [field]: null });
  }

  function getItemImagePreviewUrl(question: PhysastroiqQuestion, kind: PhysastroiqItemImageKind): string | null {
    const pending = pendingItemImages[pendingImageKey(question.id, kind)];
    if (pending) return pending.previewUrl;
    const fileName = question[ITEM_IMAGE_FIELD_BY_KIND[kind]];
    return fileName ? physastroiqItemImageUrl(fileName) : null;
  }

  // Выбор/замена изображения-карты ТЕКУЩЕГО редактируемого уровня. Реальные
  // width/height измеряются из самого файла (та же дисциплина, что в
  // NewQuizModal) — предсказанное имя файла (по таблице MIME->расширение)
  // сразу кладётся в quiz.images[level], чтобы канвас/схема видели валидные
  // данные ДО фактической записи на диск; авторитетное имя придёт из ответа
  // IPC при Save (тот же принцип, что уже применён к фону у rusiq).
  async function handleSelectLevelImage(level: PhysastroiqLevelId, file: File) {
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    const dims = await new Promise<{ width: number; height: number } | null>((resolve) => {
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = objectUrl;
    });
    if (!dims) {
      URL.revokeObjectURL(objectUrl);
      setSaveError('Не удалось прочитать изображение');
      return;
    }
    const buffer = await file.arrayBuffer();
    const predictedFileName = `${quiz.id}-level${level}${IMAGE_EXT_BY_MIME[file.type] ?? '.png'}`;
    setPendingLevelImages((prev) => {
      const old = prev[level];
      if (old) URL.revokeObjectURL(old.previewUrl);
      return { ...prev, [level]: { buffer, mimeType: file.type, previewUrl: objectUrl } };
    });
    update({ ...quiz, images: { ...quiz.images, [String(level)]: { fileName: predictedFileName, width: dims.width, height: dims.height } } });
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
    const target = levelGenericDecoys[index];
    update({ ...quiz, genericDecoyPoints: quiz.genericDecoyPoints.filter((d) => d !== target) });
    setSelection(null);
  }

  function handleResizeQuestionPoint(id: string, size: { width: number; height: number }) {
    update({ ...quiz, questions: quiz.questions.map((q) => (q.id === id ? { ...q, ...size } : q)) });
  }

  function handleResizeDecoyOfQuestion(questionId: string, decoyIndex: number, size: { width: number; height: number }) {
    update({
      ...quiz,
      questions: quiz.questions.map((q) =>
        q.id === questionId ? { ...q, decoyPoints: q.decoyPoints.map((d, i) => (i === decoyIndex ? { ...d, ...size } : d)) } : q,
      ),
    });
  }

  function handleResizeGenericDecoy(index: number, size: { width: number; height: number }) {
    const target = levelGenericDecoys[index];
    update({ ...quiz, genericDecoyPoints: quiz.genericDecoyPoints.map((d) => (d === target ? { ...d, ...size } : d)) });
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
    if (quiz.questions.length === 0) {
      setSaveError('Добавьте хотя бы один вопрос перед сохранением');
      return;
    }
    const missingLevels = LEVEL_TABS.filter((lvl) => !quiz.images[String(lvl.id)]).map((lvl) => lvl.label);
    if (missingLevels.length > 0) {
      setSaveError(`Добавьте изображение-карту для уровня: ${missingLevels.join(', ')}`);
      return;
    }
    const parsed = PhysastroiqQuizSchema.safeParse(quiz);
    if (!parsed.success) {
      setSaveError(
        'Заполните текст, ответ и тему для всех вопросов, укажите положительные вес и время, и убедитесь, что все точки находятся внутри своего изображения',
      );
      return;
    }
    setSaving(true);
    setSaveError(null);
    let quizToSave = quiz;

    const pendingLevelKeys = Object.keys(pendingLevelImages) as unknown as PhysastroiqLevelId[];
    if (pendingLevelKeys.length > 0) {
      const patchedImages = { ...quizToSave.images };
      for (const levelKey of pendingLevelKeys) {
        const pending = pendingLevelImages[levelKey];
        if (!pending) continue;
        const result = await saveQuizLevelImage(quizToSave.id, Number(levelKey), pending.buffer, pending.mimeType);
        if (!result.ok || !result.fileName) {
          setSaveError(`Не удалось сохранить изображение уровня ${levelKey}`);
          setSaving(false);
          return;
        }
        const existing = patchedImages[String(levelKey)];
        patchedImages[String(levelKey)] = { fileName: result.fileName, width: existing?.width ?? 0, height: existing?.height ?? 0 };
      }
      quizToSave = { ...quizToSave, images: patchedImages };
      setHistory((h) => ({ ...h, present: quizToSave }));
    }

    const pendingItemKeys = Object.keys(pendingItemImages);
    if (pendingItemKeys.length > 0) {
      const patchedQuestions = new Map(quizToSave.questions.map((q) => [q.id, q]));
      for (const key of pendingItemKeys) {
        const [questionId, kind] = key.split(':') as [string, PhysastroiqItemImageKind];
        const pending = pendingItemImages[key];
        const result = await saveQuizItemImage(quizToSave.id, questionId, kind, pending.buffer, pending.mimeType);
        if (!result.ok || !result.fileName) {
          setSaveError('Не удалось сохранить одну из картинок вопроса — попробуйте ещё раз');
          setSaving(false);
          return;
        }
        const existing = patchedQuestions.get(questionId);
        if (existing) patchedQuestions.set(questionId, { ...existing, [ITEM_IMAGE_FIELD_BY_KIND[kind]]: result.fileName });
      }
      quizToSave = { ...quizToSave, questions: Array.from(patchedQuestions.values()) };
      setHistory((h) => ({ ...h, present: quizToSave }));
    }

    const ok = await saveQuiz(quizToSave);
    setSaving(false);
    if (!ok) {
      setSaveError('Не удалось сохранить викторину — попробуйте ещё раз');
      return;
    }
    if (pendingLevelKeys.length > 0) {
      Object.values(pendingLevelImages).forEach((p) => p && URL.revokeObjectURL(p.previewUrl));
      setPendingLevelImages({});
    }
    if (pendingItemKeys.length > 0) {
      Object.values(pendingItemImages).forEach((p) => URL.revokeObjectURL(p.previewUrl));
      setPendingItemImages({});
    }
    setLastSavedQuiz(quizToSave);
  }

  function handleExit() {
    if (hasUnsavedChanges && !confirm('Выйти без сохранения?')) return;
    onExit(lastSavedQuiz);
  }

  const selectedQuestion = selection?.kind === 'question' ? quiz.questions.find((q) => q.id === selection.questionId) ?? null : null;
  const selectedDecoyOfQuestion =
    selection?.kind === 'decoy-of-question' ? quiz.questions.find((q) => q.id === selection.questionId)?.decoyPoints[selection.decoyIndex] ?? null : null;
  const selectedGenericDecoyLevelIndex = selection?.kind === 'generic-decoy' ? selection.index : null;
  const selectedGenericDecoy = selectedGenericDecoyLevelIndex !== null ? levelGenericDecoys[selectedGenericDecoyLevelIndex] ?? null : null;
  const existingThemes = Array.from(new Set(quiz.questions.map((q) => q.theme).filter((t) => t.length > 0)));

  function addModeButtonClass(mode: QuizCanvasAddMode) {
    return `ciq-btn ciq-btn-small ${addMode === mode ? '' : 'ciq-btn-muted'}`;
  }

  function handleLevelTabChange(level: PhysastroiqLevelId) {
    setCurrentEditLevel(level);
    setSelection(null);
    setAddMode('none');
  }

  // Пересчёт только при смене викторины: на уровне с шестью десятками
  // вопросов проверка перебирает пары областей, а перерисовок у редактора
  // много (каждый символ в поле вопроса).
  const completeness = useMemo(() => checkPhysastroiqQuiz(quiz), [quiz]);

  return (
    <div className="ciq-page" style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      <div>
        <h2 className="ciq-heading ciq-heading-section" style={{ marginBottom: 16 }}>
          Редактор викторины
        </h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {LEVEL_TABS.map((lvl) => (
            <button
              key={lvl.id}
              onClick={() => handleLevelTabChange(lvl.id)}
              className={`ciq-btn ciq-btn-small ${currentEditLevel === lvl.id ? '' : 'ciq-btn-muted'}`}
            >
              {lvl.label} {quiz.images[String(lvl.id)] ? '' : '(нет карты)'}
            </button>
          ))}
        </div>
        {!levelImageUrl ? (
          <div className="ciq-card" style={{ maxWidth: 480 }}>
            <p style={{ margin: '0 0 10px' }}>
              Для уровня «{LEVEL_TABS.find((l) => l.id === currentEditLevel)?.label}» ещё нет изображения-карты.
            </p>
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleSelectLevelImage(currentEditLevel, f);
                e.target.value = '';
              }}
              className="ciq-input"
              style={{ padding: '8px 6px' }}
            />
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={() => setAddMode(addMode === 'question' ? 'none' : 'question')} className={addModeButtonClass('question')}>
                Добавить вопрос
              </button>
              <button
                onClick={() => setAddMode(addMode === 'decoy-of-selected' ? 'none' : 'decoy-of-selected')}
                disabled={selection?.kind !== 'question'}
                className={addModeButtonClass('decoy-of-selected')}
              >
                Добавить ложную точку к вопросу
              </button>
              <button onClick={() => setAddMode(addMode === 'generic-decoy' ? 'none' : 'generic-decoy')} className={addModeButtonClass('generic-decoy')}>
                Добавить общую ложную точку
              </button>
              <label style={{ fontSize: 12, color: 'var(--ciq-text-muted)', cursor: 'pointer' }}>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleSelectLevelImage(currentEditLevel, f);
                    e.target.value = '';
                  }}
                />
                Заменить карту уровня
              </label>
            </div>
            {/* Число берётся из константы, а не пишется в тексте. Раньше здесь
                стояла десятка строкой, и она разошлась бы с проверкой при
                первой же правке границы. Слово тоже изменено: у ТЗ 11
                (FR-013, строка 334) это «не менее 10» — требование, а не
                рекомендация, и на приёмке его проверяют пересчётом. */}
            <p style={{ fontSize: 13, color: 'var(--ciq-text-muted)' }}>
              Общих ложных точек на этом уровне: {levelGenericDecoys.length} из требуемых по ТЗ{' '}
              {PHYSASTROIQ_MIN_GENERIC_DECOYS_PER_LEVEL}
            </p>
            <div ref={canvasWrapperRef} style={{ borderRadius: 10, overflow: 'hidden', border: '2px solid var(--ciq-border)', display: 'inline-block' }}>
              <QuizCanvas
                imageUrl={levelImageUrl}
                imageWidth={levelImageMeta?.width ?? 1}
                imageHeight={levelImageMeta?.height ?? 1}
                maxHeightPx={canvasMaxHeight}
                questions={levelQuestions}
                genericDecoyPoints={levelGenericDecoys}
                selectedQuestionId={selection?.kind === 'question' ? selection.questionId : null}
                selection={selection}
                addMode={addMode}
                onSelectQuestion={(id) => setSelection(id ? { kind: 'question', questionId: id } : null)}
                onAddQuestionPoint={handleAddQuestionPoint}
                onAddDecoyToSelected={handleAddDecoyToSelected}
                onAddGenericDecoy={handleAddGenericDecoy}
                onMoveQuestionPoint={handleMoveQuestionPoint}
                onMoveDecoyOfQuestion={handleMoveDecoyOfQuestion}
                onMoveGenericDecoy={handleMoveGenericDecoy}
                onResizeQuestionPoint={handleResizeQuestionPoint}
                onResizeDecoyOfQuestion={handleResizeDecoyOfQuestion}
                onResizeGenericDecoy={handleResizeGenericDecoy}
                onSelectDecoyOfQuestion={(questionId, decoyIndex) => setSelection({ kind: 'decoy-of-question', questionId, decoyIndex })}
                onSelectGenericDecoy={(index) => setSelection({ kind: 'generic-decoy', index })}
              />
            </div>
          </>
        )}
        <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
          <button onClick={() => setHistory(undo)} disabled={!canUndo(history)} className="ciq-btn ciq-btn-muted ciq-btn-small">
            Отменить
          </button>
          <button onClick={() => setHistory(redo)} disabled={!canRedo(history)} className="ciq-btn ciq-btn-muted ciq-btn-small">
            Повторить
          </button>
        </div>
      </div>
      {/* Тот же класс находки, что у rusiq (приёмка Фазы 2b, 2026-09-13):
          панель справа растёт без ограничения - внешний `.player-canvas`
          жёстко ограничен высотой окна с overflow: hidden. Заложено сразу,
          не постфактум. */}
      <div style={{ width: 340, maxHeight: 'calc(100vh - 80px)', overflowY: 'auto', paddingRight: 8 }}>
        <label className="ciq-field">
          Название викторины
          <input value={quiz.title} onChange={(e) => update({ ...quiz, title: e.target.value })} className="ciq-input" />
        </label>
        {selectedQuestion && (
          <PointEditForm
            question={selectedQuestion}
            existingThemes={existingThemes}
            onChange={handleQuestionChange}
            onDelete={handleDeleteSelectedQuestion}
            onClose={() => setSelection(null)}
            getImagePreviewUrl={(kind) => getItemImagePreviewUrl(selectedQuestion, kind)}
            onSelectImage={(kind, file) => handleSelectItemImage(selectedQuestion.id, kind, file)}
            onRemoveImage={(kind) => handleRemoveItemImage(selectedQuestion.id, kind)}
          />
        )}
        {selection?.kind === 'decoy-of-question' && selectedDecoyOfQuestion && (
          <div className="ciq-card" style={{ marginTop: 16 }}>
            <p style={{ margin: '0 0 10px' }}>Ложная точка вопроса</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <label className="ciq-field" style={{ flex: 1 }}>
                Ширина области
                <input
                  type="number"
                  min={1}
                  value={selectedDecoyOfQuestion.width}
                  onChange={(e) =>
                    handleResizeDecoyOfQuestion(selection.questionId, selection.decoyIndex, {
                      width: Math.max(1, Number(e.target.value)),
                      height: selectedDecoyOfQuestion.height,
                    })
                  }
                  className="ciq-input"
                />
              </label>
              <label className="ciq-field" style={{ flex: 1 }}>
                Высота области
                <input
                  type="number"
                  min={1}
                  value={selectedDecoyOfQuestion.height}
                  onChange={(e) =>
                    handleResizeDecoyOfQuestion(selection.questionId, selection.decoyIndex, {
                      width: selectedDecoyOfQuestion.width,
                      height: Math.max(1, Number(e.target.value)),
                    })
                  }
                  className="ciq-input"
                />
              </label>
            </div>
            <button onClick={() => handleDeleteDecoyOfQuestion(selection.questionId, selection.decoyIndex)} className="ciq-btn ciq-btn-danger ciq-btn-small">
              Удалить эту точку
            </button>
          </div>
        )}
        {selection?.kind === 'generic-decoy' && selectedGenericDecoy && selectedGenericDecoyLevelIndex !== null && (
          <div className="ciq-card" style={{ marginTop: 16 }}>
            <p style={{ margin: '0 0 10px' }}>Общая ложная точка</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <label className="ciq-field" style={{ flex: 1 }}>
                Ширина области
                <input
                  type="number"
                  min={1}
                  value={selectedGenericDecoy.width}
                  onChange={(e) => handleResizeGenericDecoy(selectedGenericDecoyLevelIndex, { width: Math.max(1, Number(e.target.value)), height: selectedGenericDecoy.height })}
                  className="ciq-input"
                />
              </label>
              <label className="ciq-field" style={{ flex: 1 }}>
                Высота области
                <input
                  type="number"
                  min={1}
                  value={selectedGenericDecoy.height}
                  onChange={(e) => handleResizeGenericDecoy(selectedGenericDecoyLevelIndex, { width: selectedGenericDecoy.width, height: Math.max(1, Number(e.target.value)) })}
                  className="ciq-input"
                />
              </label>
            </div>
            <button onClick={() => handleDeleteGenericDecoy(selectedGenericDecoyLevelIndex)} className="ciq-btn ciq-btn-danger ciq-btn-small">
              Удалить эту точку
            </button>
          </div>
        )}
        <div className="ciq-card" style={{ marginTop: 16 }}>
          <p style={{ margin: '0 0 10px', color: 'var(--ciq-text-muted)' }}>
            Пароль викторины: <strong style={{ color: 'var(--ciq-text)' }}>{quiz.passwordHash ? 'установлен' : 'не установлен'}</strong>
          </p>
          <input
            type="password"
            placeholder="Новый пароль"
            value={passwordDraft}
            onChange={(e) => setPasswordDraft(e.target.value)}
            className="ciq-input"
          />
          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            <button onClick={handleSetPassword} disabled={passwordDraft.trim().length === 0} className="ciq-btn ciq-btn-small">
              Задать пароль
            </button>
            {quiz.passwordHash && (
              <button onClick={handleClearPassword} className="ciq-btn ciq-btn-muted ciq-btn-small">
                Снять пароль
              </button>
            )}
          </div>
        </div>
        {/* Готовность викторины — СПИСОК, А НЕ ЗАПРЕТ. Требования ТЗ (десять
            точек без привязки на уровень, уникальные наборы уровней) описывают
            готовую викторину, а не каждое промежуточное состояние работы.
            Педагог, собирающий викторину с нуля (FR-018), первые полчаса
            неизбежно ей не соответствует; запрет сохранения означал бы «не
            сохраняйся, пока не закончишь», то есть потерю работы. Поэтому —
            перечислить поимённо и не мешать. */}
        <div className="ciq-card" style={{ marginTop: 16 }}>
          <p style={{ margin: '0 0 8px', color: 'var(--ciq-text-muted)' }}>Готовность викторины</p>
          {completeness.length === 0 ? (
            <p style={{ margin: 0 }}>Требования к готовой викторине выполнены.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {completeness.map((p, i) => (
                <li key={i} style={{ marginBottom: 4 }}>
                  <span style={{ color: 'var(--ciq-text-muted)' }}>{p.requirement}:</span> {p.message}
                </li>
              ))}
            </ul>
          )}
        </div>
        {saveError && <p className="ciq-error">{saveError}</p>}
        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <button onClick={handleSave} disabled={saving} className="ciq-btn">
            Сохранить
          </button>
          <button onClick={handleExit} className="ciq-btn ciq-btn-muted">
            Назад к каталогу
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditorScreen;
