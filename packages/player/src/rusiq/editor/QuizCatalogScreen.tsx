// packages/player/src/rusiq/editor/QuizCatalogScreen.tsx
import React, { useEffect, useState } from 'react';
import { listQuizzes, loadQuiz, saveQuiz, deleteQuiz, saveQuizBackground, exportQuizFile, importQuizFile, type QuizListEntry } from './quizStore.ts';
import { verifySecret } from './pinAuth.ts';
import NewQuizModal, { type NewQuizResult } from './NewQuizModal.tsx';
import { RUSIQ_QUIZ_SCHEMA_VERSION, type RusiqQuiz } from '../model/schema.ts';
import {
  buildExportPayload,
  serializeExportPayload,
  suggestExportFileName,
  fetchMediaAsBase64,
  parseAndPersistImportedQuiz,
  persistBackgroundViaIpc,
  persistItemImageViaIpc,
} from './quizExport.ts';

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

type PendingAction = 'edit' | 'delete' | 'duplicate' | 'export';

const QuizCatalogScreen: React.FC<Props> = ({ builtinQuizTitle, activeQuizId, onSetActiveQuiz, onEditQuiz, onDuplicateBuiltin, onExit }) => {
  const [entries, setEntries] = useState<QuizListEntry[]>([]);
  const [showNewQuizModal, setShowNewQuizModal] = useState(false);
  const [passwordPromptFor, setPasswordPromptFor] = useState<{ id: string; passwordHash: string; action: PendingAction } | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  // FR-013/FR-018 (Фаза 2b) - обмен викторинами между проектами KIOSK.
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

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
    if (action === 'duplicate') {
      const quiz = await loadQuiz(quizId);
      if (!quiz) {
        await refresh();
        return;
      }
      const newId = crypto.randomUUID();
      const duplicated: RusiqQuiz = { ...quiz, id: newId, title: `${quiz.title} (копия)`, passwordHash: null };
      await saveQuiz(duplicated);
      await refresh();
      return;
    }
    // action === 'export'
    await exportQuizFlow(quizId);
  }

  // FR-013/FR-018 (Фаза 2b) - собрать самодостаточный файл (викторина +
  // base64 всех её картинок) и предложить пользователю сохранить его через
  // нативный диалог (main-процесс, см. electron/main.js 'rusiq:export-quiz').
  async function exportQuizFlow(quizId: string) {
    const quiz = await loadQuiz(quizId);
    if (!quiz) {
      alert('Не удалось открыть викторину — файл повреждён или удалён.');
      await refresh();
      return;
    }
    setExportingId(quizId);
    try {
      const payload = await buildExportPayload(quiz, fetchMediaAsBase64);
      const result = await exportQuizFile(serializeExportPayload(payload), suggestExportFileName(quiz));
      if (!result.ok && !('canceled' in result && result.canceled)) {
        alert('Не удалось сохранить файл экспорта.');
      }
    } finally {
      setExportingId(null);
    }
  }

  // FR-013/FR-018 (Фаза 2b) - обратная операция: пользователь выбирает файл
  // через нативный диалог, содержимое разбирается и картинки заново
  // сохраняются на диск ПОД СВЕЖИМ id викторины (parseAndPersistImportedQuiz)
  // - тот же принцип "не доверять чужим именам файлов", что уже применён к
  // авторитетному имени фона при обычном сохранении в EditorScreen.
  async function handleImport() {
    setImporting(true);
    try {
      const picked = await importQuizFile();
      if (!picked.ok || !picked.content) {
        if (!('canceled' in picked && picked.canceled)) alert('Не удалось прочитать выбранный файл.');
        return;
      }
      const imported = await parseAndPersistImportedQuiz(picked.content, persistBackgroundViaIpc, persistItemImageViaIpc);
      if (!imported.ok) {
        alert(imported.error);
        return;
      }
      const saved = await saveQuiz(imported.quiz);
      if (!saved) {
        alert('Не удалось сохранить импортированную викторину.');
        return;
      }
      await refresh();
    } finally {
      setImporting(false);
    }
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
            <button
              onClick={() => requirePasswordThen(entry, 'export')}
              disabled={exportingId === entry.id}
              className="riq-btn riq-btn-muted riq-btn-small"
            >
              {exportingId === entry.id ? 'Экспорт…' : 'Экспорт в файл'}
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
          <button onClick={handleImport} disabled={importing} className="riq-btn riq-btn-muted">
            {importing ? 'Импорт…' : 'Импортировать викторину'}
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
