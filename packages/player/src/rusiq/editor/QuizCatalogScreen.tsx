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

const QuizCatalogScreen: React.FC<Props> = ({ builtinQuizTitle, activeQuizId, onSetActiveQuiz, onEditQuiz, onDuplicateBuiltin, onExit }) => {
  const [entries, setEntries] = useState<QuizListEntry[]>([]);
  const [showNewQuizModal, setShowNewQuizModal] = useState(false);
  const [passwordPromptFor, setPasswordPromptFor] = useState<{ id: string; passwordHash: string } | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function refresh() {
    setEntries(await listQuizzes());
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleEdit(entry: QuizListEntry) {
    const quiz = await loadQuiz(entry.id);
    if (!quiz) {
      alert('Не удалось открыть викторину — файл повреждён или удалён.');
      await refresh();
      return;
    }
    if (quiz.passwordHash) {
      setPasswordPromptFor({ id: entry.id, passwordHash: quiz.passwordHash });
      setPasswordInput('');
      setPasswordError(null);
      return;
    }
    onEditQuiz(quiz, null);
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordPromptFor) return;
    const ok = await verifySecret(passwordInput, passwordPromptFor.passwordHash);
    if (!ok) {
      setPasswordError('Неверный пароль');
      return;
    }
    const quiz = await loadQuiz(passwordPromptFor.id);
    setPasswordPromptFor(null);
    if (quiz) onEditQuiz(quiz, null);
  }

  async function handleDuplicate(entry: QuizListEntry) {
    const quiz = await loadQuiz(entry.id);
    if (!quiz) {
      await refresh();
      return;
    }
    const newId = crypto.randomUUID();
    const duplicated: RusiqQuiz = { ...quiz, id: newId, title: `${quiz.title} (копия)`, passwordHash: null };
    await saveQuiz(duplicated);
    await refresh();
  }

  async function handleDelete(entry: QuizListEntry) {
    if (!confirm(`Удалить викторину «${entry.title}»? Это необратимо.`)) return;
    await deleteQuiz(entry.id);
    if (activeQuizId === entry.id) onSetActiveQuiz(null);
    await refresh();
  }

  async function handleCreate(result: NewQuizResult) {
    setShowNewQuizModal(false);
    const { quiz, pendingBackground } = await buildBlankQuiz(result);
    onEditQuiz(quiz, pendingBackground);
  }

  return (
    <div style={{ maxWidth: 640, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h2>Каталог викторин</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        <li style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #ddd' }}>
          <span style={{ flex: 1 }}>
            {activeQuizId === null ? '✓ ' : ''}
            {builtinQuizTitle} <em style={{ opacity: 0.6 }}>(встроенная)</em>
          </span>
          <button onClick={() => onSetActiveQuiz(null)}>Играть эту</button>
          <button onClick={() => onDuplicateBuiltin().then(refresh)}>Дублировать</button>
        </li>
        {entries.map((entry) => (
          <li key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #ddd' }}>
            <span style={{ flex: 1 }}>
              {activeQuizId === entry.id ? '✓ ' : ''}
              {entry.title} {entry.hasPassword ? '🔒' : ''}
            </span>
            <button onClick={() => onSetActiveQuiz(entry.id)}>Играть эту</button>
            <button onClick={() => handleEdit(entry)}>Редактировать</button>
            <button onClick={() => handleDuplicate(entry)}>Дублировать</button>
            <button onClick={() => handleDelete(entry)}>Удалить</button>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 16 }}>
        <button onClick={() => setShowNewQuizModal(true)}>Создать новую</button>
        <button onClick={onExit} style={{ marginLeft: 8 }}>
          Выйти
        </button>
      </div>
      {showNewQuizModal && <NewQuizModal onCreate={handleCreate} onCancel={() => setShowNewQuizModal(false)} />}
      {passwordPromptFor && (
        <div
          onClick={() => setPasswordPromptFor(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handlePasswordSubmit}
            style={{ background: '#fff', padding: 24, borderRadius: 8, fontFamily: 'sans-serif' }}
          >
            <h3>Пароль викторины</h3>
            <input
              autoFocus
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              style={{ display: 'block', width: '100%', padding: 8 }}
            />
            {passwordError && <p style={{ color: '#c0392b' }}>{passwordError}</p>}
            <div style={{ textAlign: 'right', marginTop: 12 }}>
              <button type="button" onClick={() => setPasswordPromptFor(null)} style={{ marginRight: 8 }}>
                Отмена
              </button>
              <button type="submit">Открыть</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default QuizCatalogScreen;
