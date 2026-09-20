// packages/player/src/physastroiq/editor/QuizCatalogScreen.tsx
// Прямая адаптация rusiq/editor/QuizCatalogScreen.tsx (Тип 7). Отличие:
// buildBlankQuiz создаёт викторину с картинкой ТОЛЬКО уровня 1 (levels
// 2/3 без images — добавляются в EditorScreen); экспорт/импорт (FR-013/
// FR-018 у rusiq) сюда пока не перенесены — отдельная Фаза 5 плана
// реализации Тип11_ФизАстроIQ.

import React, { useEffect, useState } from 'react';
import { listQuizzes, loadQuiz, saveQuiz, deleteQuiz, exportQuizFile, exportStandaloneQuiz, importQuizFile, type QuizListEntry, type StandaloneExportRequest } from './quizStore.ts';
import { verifySecret } from './pinAuth.ts';
import NewQuizModal, { type NewQuizResult } from './NewQuizModal.tsx';
import { PHYSASTROIQ_QUIZ_SCHEMA_VERSION, type PhysastroiqQuiz } from '../model/schema.ts';
import {
  buildExportPayload,
  serializeExportPayload,
  suggestExportFileName,
  fetchMediaAsBase64,
  parseAndPersistImportedQuiz,
  persistLevelImageViaIpc,
  persistItemImageViaIpc,
} from './quizExport.ts';

interface BuiltinEntry {
  id: string;
  title: string;
  questionCount: number;
}

interface Props {
  /**
   * Встроенные викторины — по одной на предмет (FR-004, строка 325).
   * Список, а не одно название: их две, и каждую можно назначить активной и
   * продублировать отдельно от другой.
   */
  builtinQuizzes: BuiltinEntry[];
  activeQuizId: string | null;
  onSetActiveQuiz: (quizId: string | null) => void;
  onEditQuiz: (quiz: PhysastroiqQuiz, pendingLevel1Image: { buffer: ArrayBuffer; mimeType: string } | null) => void;
  onDuplicateBuiltin: (quizId: string) => Promise<void>;
  onShowDailyStats: () => void;
  onExit: () => void;
}

const DEFAULT_LEVELS = [
  { id: 1 as const, label: 'Начинающий' },
  { id: 2 as const, label: 'Опытный' },
  { id: 3 as const, label: 'Профессионал' },
];

const EXT_BY_MIME: Record<string, string> = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp' };

async function buildBlankQuiz(result: NewQuizResult): Promise<{ quiz: PhysastroiqQuiz; pendingLevel1Image: { buffer: ArrayBuffer; mimeType: string } }> {
  const id = crypto.randomUUID();
  const fileName = `${id}-level1${EXT_BY_MIME[result.level1ImageMimeType] ?? '.png'}`;
  const quiz: PhysastroiqQuiz = {
    schemaVersion: PHYSASTROIQ_QUIZ_SCHEMA_VERSION,
    id,
    title: result.title,
    intro: '',
    themes: [],
    passwordHash: null,
    images: { '1': { fileName, width: result.level1ImageWidth, height: result.level1ImageHeight } },
    levels: DEFAULT_LEVELS,
    questions: [],
    genericDecoyPoints: [],
  };
  return { quiz, pendingLevel1Image: { buffer: result.level1ImageBuffer, mimeType: result.level1ImageMimeType } };
}

type PendingAction = 'edit' | 'delete' | 'duplicate' | 'export' | 'export-standalone';

const QuizCatalogScreen: React.FC<Props> = ({ builtinQuizzes, activeQuizId, onSetActiveQuiz, onEditQuiz, onDuplicateBuiltin, onShowDailyStats, onExit }) => {
  const [entries, setEntries] = useState<QuizListEntry[]>([]);
  const [showNewQuizModal, setShowNewQuizModal] = useState(false);
  const [passwordPromptFor, setPasswordPromptFor] = useState<{ id: string; passwordHash: string; action: PendingAction } | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  // FR-013 ТЗ (строка 252, Фаза 5) - обмен викторинами между проектами KIOSK.
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  async function refresh() {
    setEntries(await listQuizzes());
  }

  useEffect(() => {
    refresh();
  }, []);

  // Требует пароль конкретной викторины (если он задан) перед выполнением
  // ЛЮБОГО из изменяющих/раскрывающих действий — тот же принцип, что у
  // rusiq (найдено там финальным ревью: пароль защищал только
  // «Редактировать», второй педагог мог удалить/дублировать чужую
  // защищённую викторину без пароля).
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
      const duplicated: PhysastroiqQuiz = { ...quiz, id: newId, title: `${quiz.title} (копия)`, passwordHash: null };
      await saveQuiz(duplicated);
      await refresh();
      return;
    }
    if (action === 'export-standalone') {
      const quiz = await loadQuiz(quizId);
      if (!quiz) {
        alert('Не удалось открыть викторину — файл повреждён или удалён.');
        await refresh();
        return;
      }
      await exportStandaloneFlow(quizId, { quizJson: JSON.stringify(quiz), suggestedFileName: quiz.title });
      return;
    }
    // action === 'export'
    await exportQuizFlow(quizId);
  }

  // FR-019 — викторина «для запуска без установки»: таблица Excel с текстом
  // вопросов и рядом player.html. Карты и картинки не выгружаются: проигрыватель
  // текстовый, ответ в нём — выбор из четырёх вариантов.
  async function exportStandaloneFlow(rowId: string, request: StandaloneExportRequest) {
    setExportingId(rowId);
    try {
      const result = await exportStandaloneQuiz(request);
      if (result.ok) {
        alert(`Готово. В папке два файла:

• ${result.quizFile}
• ${result.playerFile}

Откройте player.html в любом браузере и выберите файл викторины. Установка и интернет не нужны.`);
      } else if (!result.canceled) {
        alert(`Не удалось сохранить файлы.${result.error ? ' ' + result.error : ''}`);
      }
    } finally {
      setExportingId(null);
    }
  }

  // FR-013 (Фаза 5) - собрать самодостаточный файл (викторина + base64 всех
  // её картинок: 3 карты уровней + per-вопросные) и предложить пользователю
  // сохранить его через нативный диалог.
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

  // FR-013 (Фаза 5) - обратная операция: пользователь выбирает файл через
  // нативный диалог, содержимое разбирается и картинки заново сохраняются
  // на диск ПОД СВЕЖИМ id викторины.
  async function handleImport() {
    setImporting(true);
    try {
      const picked = await importQuizFile();
      if (!picked.ok || !picked.content) {
        if (!('canceled' in picked && picked.canceled)) alert('Не удалось прочитать выбранный файл.');
        return;
      }
      const imported = await parseAndPersistImportedQuiz(picked.content, persistLevelImageViaIpc, persistItemImageViaIpc);
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
    const { quiz, pendingLevel1Image } = await buildBlankQuiz(result);
    onEditQuiz(quiz, pendingLevel1Image);
  }

  return (
    <div className="ciq-page">
      <div className="ciq-page-medium">
        <h2 className="ciq-heading ciq-heading-section" style={{ textAlign: 'center' }}>
          Каталог викторин
        </h2>
        <div className="ciq-divider" />
        {builtinQuizzes.map((builtin, i) => {
          // Первая встроенная викторина активна и тогда, когда ничего не
          // выбрано: activeQuizId === null означает «предмет по умолчанию».
          const isActive = activeQuizId === builtin.id || (activeQuizId === null && i === 0);
          return (
            <div key={builtin.id} className={`ciq-row ${isActive ? 'ciq-row-active' : ''}`} data-testid={`physastroiq-builtin-${builtin.id}`}>
              <span className="ciq-row-title">
                {isActive ? '★ ' : ''}
                {builtin.title}
                <span className="ciq-row-title-badge">(встроенная, {builtin.questionCount} вопр.)</span>
              </span>
              <button onClick={() => onSetActiveQuiz(builtin.id)} className="ciq-btn ciq-btn-small">
                Играть эту
              </button>
              <button onClick={() => onDuplicateBuiltin(builtin.id).then(refresh)} className="ciq-btn ciq-btn-muted ciq-btn-small">
                Дублировать
              </button>
              <button
                onClick={() => exportStandaloneFlow(builtin.id, { builtinId: builtin.id, suggestedFileName: `ФизАстроIQ — ${builtin.title}` })}
                disabled={exportingId === builtin.id}
                className="ciq-btn ciq-btn-muted ciq-btn-small"
                data-testid={`physastroiq-standalone-${builtin.id}`}
              >
                {exportingId === builtin.id ? 'Экспорт…' : 'Без установки'}
              </button>
            </div>
          );
        })}
        {entries.map((entry) => (
          <div key={entry.id} className={`ciq-row ${activeQuizId === entry.id ? 'ciq-row-active' : ''}`}>
            <span className="ciq-row-title">
              {activeQuizId === entry.id ? '★ ' : ''}
              {entry.title} {entry.hasPassword ? '🔒' : ''}
            </span>
            <button onClick={() => onSetActiveQuiz(entry.id)} className="ciq-btn ciq-btn-small">
              Играть эту
            </button>
            <button onClick={() => requirePasswordThen(entry, 'edit')} className="ciq-btn ciq-btn-muted ciq-btn-small">
              Редактировать
            </button>
            <button onClick={() => requirePasswordThen(entry, 'duplicate')} className="ciq-btn ciq-btn-muted ciq-btn-small">
              Дублировать
            </button>
            <button
              onClick={() => requirePasswordThen(entry, 'export')}
              disabled={exportingId === entry.id}
              className="ciq-btn ciq-btn-muted ciq-btn-small"
            >
              {exportingId === entry.id ? 'Экспорт…' : 'Экспорт в файл'}
            </button>
            <button
              onClick={() => requirePasswordThen(entry, 'export-standalone')}
              disabled={exportingId === entry.id}
              className="ciq-btn ciq-btn-muted ciq-btn-small"
            >
              Без установки
            </button>
            <button onClick={() => requirePasswordThen(entry, 'delete')} className="ciq-btn ciq-btn-danger ciq-btn-small">
              Удалить
            </button>
          </div>
        ))}
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => setShowNewQuizModal(true)} className="ciq-btn">
            Создать новую
          </button>
          <button onClick={handleImport} disabled={importing} className="ciq-btn ciq-btn-muted">
            {importing ? 'Импорт…' : 'Импортировать викторину'}
          </button>
          <button onClick={onShowDailyStats} className="ciq-btn ciq-btn-muted">
            Статистика по дням
          </button>
          <button onClick={onExit} className="ciq-btn ciq-btn-muted">
            Выйти
          </button>
        </div>
      </div>
      {showNewQuizModal && <NewQuizModal onCreate={handleCreate} onCancel={() => setShowNewQuizModal(false)} />}
      {passwordPromptFor && (
        <div className="ciq-modal-backdrop" onClick={() => setPasswordPromptFor(null)}>
          <form className="ciq-modal" onClick={(e) => e.stopPropagation()} onSubmit={handlePasswordSubmit}>
            <h3>Пароль викторины</h3>
            <input
              autoFocus
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="ciq-input"
            />
            {passwordError && <p className="ciq-error">{passwordError}</p>}
            <div className="ciq-modal-actions">
              <button type="button" onClick={() => setPasswordPromptFor(null)} className="ciq-btn ciq-btn-ghost">
                Отмена
              </button>
              <button type="submit" className="ciq-btn">
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
