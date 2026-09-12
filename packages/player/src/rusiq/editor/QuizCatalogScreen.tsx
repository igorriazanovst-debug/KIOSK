// packages/player/src/rusiq/editor/QuizCatalogScreen.tsx
import React, { useEffect, useState } from 'react';
import { listQuizzes, loadQuiz, saveQuiz, deleteQuiz, saveQuizBackground, type QuizListEntry } from './quizStore.ts';
import { verifySecret } from './pinAuth.ts';
import NewQuizModal, { type NewQuizResult } from './NewQuizModal.tsx';
import { RUSIQ_QUIZ_SCHEMA_VERSION, type RusiqQuiz } from '../model/schema.ts';

interface Props {
  builtinQuizTitle: string;
  activeQuizId: string | null;
  onSetActiveQuiz: (quizId: string | null) => void;
  onEditQuiz: (quiz: RusiqQuiz, pendingBackground: { buffer: ArrayBuffer; mimeType: string } | null) => void;
  onDuplicateBuiltin: () => Promise<void>;
  onExit: () => void;
}

const DEFAULT_LEVELS = [
  { id: 1 as const, label: 'Начинающий' },
  { id: 2 as const, label: 'Опытный' },
  { id: 3 as const, label: 'Профессионал' },
];

async function buildBlankQuiz(result: NewQuizResult): Promise<{ quiz: RusiqQuiz; pendingBackground: { buffer: ArrayBuffer; mimeType: string } } > {
  const extByMime: Record<string, string> = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp' };
  const id = crypto.randomUUID();
  const fileName = `${id}-background${extByMime[result.imageMimeType] ?? '.png'}`;
  const quiz: RusiqQuiz = {
    schemaVersion: RUSIQ_QUIZ_SCHEMA_VERSION,
    id,
    title: result.title,
    intro: '',
    themes: [],
    passwordHash: null,
    image: { fileName, width: result.imageWidth, height: result.imageHeight },
    levels: DEFAULT_LEVELS,
    questions: [],
    genericDecoyPoints: [],
  };
  return { quiz, pendingBackground: { buffer: result.imageBuffer, mimeType: result.imageMimeType } };
}

type PendingAction = 'edit' | 'delete' | 'duplicate';

const QuizCatalogScreen: React.FC<Props> = ({ builtinQuizTitle, activeQuizId, onSetActiveQuiz, onEditQuiz, onDuplicateBuiltin, onExit }) => {
  const [entries, setEntries] = useState<QuizListEntry[]>([]);
  const [showNewQuizModal, setShowNewQuizModal] = useState(false);
  const [passwordPromptFor, setPasswordPromptFor] = useState<{ id: string; passwordHash: string; action: PendingAction } | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function refresh() {
    setEntries(await listQuizzes());
  }

  useEffect(() => {
    refresh();
  }, []);

  // Требует пароль конкретной викторины (если он задан) перед выполнением
  // ЛЮБОГО из трёх изменяющих/раскрывающих содержимое действий -
  // редактировать/удалить/дублировать. До финального ревью пароль
  // защищал только "Редактировать": второй педагог на одном киоске, уже
  // прошедший PIN устройства, мог безвозвратно удалить чужую защищённую
  // викторину или получить её полностью редактируемую копию простым
  // "Дублировать" (found by final whole-branch review, Important).
  async function requirePasswordThen(entry: QuizListEntry, action: PendingAction) {
    if (!entry.hasPassword) {
      await performAction(entry.id, action, entry.title);
      return;
    }
    const quiz = await loadQuiz(entry.id);
    if (!quiz) {
      alert('Не удалось открыть викторину — файл повреждён или удалён.');
      await refresh();
      return;
    }
    if (!quiz.passwordHash) {
      await performAction(entry.id, action, entry.title);
      return;
    }
    setPasswordPromptFor({ id: entry.id, passwordHash: quiz.passwordHash, action });
    setPasswordInput('');
    setPasswordError(null);
  }

  async function performAction(quizId: string, action: PendingAction, titleForConfirm?: string) {
    if (action === 'edit') {
      const quiz = await loadQuiz(quizId);
      if (quiz) onEditQuiz(quiz, null);
      return;
    }
    if (action === 'delete') {
      if (!confirm(`Удалить викторину «${titleForConfirm ?? quizId}»? Это необратимо.`)) return;
      await deleteQuiz(quizId);
      if (activeQuizId === quizId) onSetActiveQuiz(null);
      await refresh();
      return;
    }
    // action === 'duplicate'
    const quiz = await loadQuiz(quizId);
    if (!quiz) {
      await refresh();
      return;
    }
    const newId = crypto.randomUUID();
    const duplicated: RusiqQuiz = { ...quiz, id: newId, title: `${quiz.title} (копия)`, passwordHash: null };
    await saveQuiz(duplicated);
    await refresh();
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordPromptFor) return;
    const ok = await verifySecret(passwordInput, passwordPromptFor.passwordHash);
    if (!ok) {
      setPasswordError('Неверный пароль');
      return;
    }
    const { id, action } = passwordPromptFor;
    const entry = entries.find((e2) => e2.id === id);
    setPasswordPromptFor(null);
    await performAction(id, action, entry?.title);
  }

  async function handleCreate(result: NewQuizResult) {
    setShowNewQuizModal(false);
    const { quiz, pendingBackground } = await buildBlankQuiz(result);
    onEditQuiz(quiz, pendingBackground);
  }

  return (
    <div className="riq-page">
      <div className="riq-page-medium">
        <h2 className="riq-heading riq-heading-section" style={{ textAlign: 'center' }}>
          Каталог викторин
        </h2>
        <div className="riq-divider" />
        <div className={`riq-row ${activeQuizId === null ? 'riq-row-active' : ''}`}>
          <span className="riq-row-title">
            {activeQuizId === null ? '★ ' : ''}
            {builtinQuizTitle}
            <span className="riq-row-title-badge">(встроенная)</span>
          </span>
          <button onClick={() => onSetActiveQuiz(null)} className="riq-btn riq-btn-small">
            Играть эту
          </button>
          <button onClick={() => onDuplicateBuiltin().then(refresh)} className="riq-btn riq-btn-muted riq-btn-small">
            Дублировать
          </button>
        </div>
        {entries.map((entry) => (
          <div key={entry.id} className={`riq-row ${activeQuizId === entry.id ? 'riq-row-active' : ''}`}>
            <span className="riq-row-title">
              {activeQuizId === entry.id ? '★ ' : ''}
              {entry.title} {entry.hasPassword ? '🔒' : ''}
            </span>
            <button onClick={() => onSetActiveQuiz(entry.id)} className="riq-btn riq-btn-small">
              Играть эту
            </button>
            <button onClick={() => requirePasswordThen(entry, 'edit')} className="riq-btn riq-btn-muted riq-btn-small">
              Редактировать
            </button>
            <button onClick={() => requirePasswordThen(entry, 'duplicate')} className="riq-btn riq-btn-muted riq-btn-small">
              Дублировать
            </button>
            <button onClick={() => requirePasswordThen(entry, 'delete')} className="riq-btn riq-btn-danger riq-btn-small">
              Удалить
            </button>
          </div>
        ))}
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center', gap: 10 }}>
          <button onClick={() => setShowNewQuizModal(true)} className="riq-btn">
            Создать новую
          </button>
          <button onClick={onExit} className="riq-btn riq-btn-muted">
            Выйти
          </button>
        </div>
      </div>
      {showNewQuizModal && <NewQuizModal onCreate={handleCreate} onCancel={() => setShowNewQuizModal(false)} />}
      {passwordPromptFor && (
        <div className="riq-modal-backdrop" onClick={() => setPasswordPromptFor(null)}>
          <form className="riq-modal" onClick={(e) => e.stopPropagation()} onSubmit={handlePasswordSubmit}>
            <h3>Пароль викторины</h3>
            <input
              autoFocus
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="riq-input"
            />
            {passwordError && <p className="riq-error">{passwordError}</p>}
            <div className="riq-modal-actions">
              <button type="button" onClick={() => setPasswordPromptFor(null)} className="riq-btn riq-btn-ghost">
                Отмена
              </button>
              <button type="submit" className="riq-btn">
                Открыть
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default QuizCatalogScreen;
