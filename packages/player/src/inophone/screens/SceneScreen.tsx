// packages/player/src/inophone/screens/SceneScreen.tsx
// Экран сцены — то, ради чего написано всё остальное (ТЗ строки 86, 89, 94).
//
// ТРИ РЕЖИМА ЖИВУТ НА ОДНОМ ЭКРАНЕ, а не на трёх похожих. Отличий между ними
// ровно три: подсвечены ли объекты, есть ли загаданное слово и считается ли
// счёт. Три копии экрана разъехались бы по вёрстке при первой же правке, и
// педагог получил бы три слегка разных сцены вместо одной.
//
// ВЕРХНЯЯ ПОЛОСА ВНУТРИ ПОЛЯ, а не поверх него. Решение перенесено из Типа 2,
// где пользователь потребовал этого прямо: при повороте стола к очередному
// игроку «Ходит: X», счёт и «Выйти» обязаны поворачиваться вместе с полем —
// иначе сидящий слева читает своё имя вверх ногами.

import React from 'react';
import { inophone } from '@kiosk/shared';
import type { LanguageCode, InophoneLibrary } from '../types';
import { BigButton, Panel, palette } from '../ui';
import SceneStage from '../components/SceneStage';
import WordCard from '../components/WordCard';

type Scene = inophone.Scene;

export interface SceneScreenProps {
  scene: Scene;
  library: InophoneLibrary;
  mode: 'learning' | inophone.InophoneMode;
  interfaceLanguage: LanguageCode;
  studyLanguages: readonly LanguageCode[];

  /** Кто ходит — имя, а не идентификатор: его читает человек */
  currentPlayerName: string | null;
  /** «вопрос 3 из 10» */
  progress: { done: number; total: number } | null;
  score: { success: number; fail: number } | null;

  /** Загаданное понятие и язык задания; null в обучении */
  task: { conceptId: string; language: LanguageCode } | null;
  presentation: inophone.Presentation;
  verdict: { conceptId: string; correct: boolean } | null;

  /** Открытая карточка объекта — только в обучении */
  openedConceptId: string | null;

  onPick: (conceptId: string) => void;
  onCloseCard: () => void;
  onSpeak: (conceptId: string, code: LanguageCode) => void;
  onRepeatTask: () => void;
  onExit: () => void;
}

const SceneScreen: React.FC<SceneScreenProps> = ({
  scene,
  library,
  mode,
  interfaceLanguage,
  studyLanguages,
  currentPlayerName,
  progress,
  score,
  task,
  presentation,
  verdict,
  openedConceptId,
  onPick,
  onCloseCard,
  onSpeak,
  onRepeatTask,
  onExit,
}) => {
  const learning = mode === 'learning';

  const conceptById = React.useMemo(
    () => new Map(library.concepts.map((c) => [c.id, c])),
    [library]
  );

  // В обучении объекты подписаны на языке интерфейса: ученик видит сцену и
  // сразу читает знакомое слово — это и есть «все объекты подсвечены»
  const labels = React.useMemo(() => {
    if (!learning) return undefined;
    const out: Record<string, string> = {};
    for (const h of scene.hotspots) {
      const t = conceptById.get(h.conceptId)?.translations[interfaceLanguage];
      if (t) out[h.conceptId] = t.text;
    }
    return out;
  }, [learning, scene, conceptById, interfaceLanguage]);

  const taskText = task ? conceptById.get(task.conceptId)?.translations[task.language] : undefined;
  const opened = openedConceptId ? conceptById.get(openedConceptId) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
      <div
        data-testid="inophone-strip"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          background: palette.panel,
          border: `2px solid ${palette.panelEdge}`,
          borderRadius: 16,
          padding: '12px 18px',
        }}
      >
        <div style={{ fontSize: 24, fontWeight: 700 }}>
          {inophone.localTitle(scene.titles, interfaceLanguage)}
        </div>
        {currentPlayerName && (
          <div data-testid="inophone-turn" style={{ fontSize: 22, color: palette.accent }}>
            Ходит: {currentPlayerName}
          </div>
        )}
        {progress && (
          <div style={{ fontSize: 20, color: palette.textDim }}>
            вопрос {progress.done + 1} из {progress.total}
          </div>
        )}
        {score && (
          <div data-testid="inophone-score" style={{ fontSize: 20 }}>
            <span style={{ color: palette.good }}>✔ {score.success}</span>{' '}
            <span style={{ color: palette.danger }}>✘ {score.fail}</span>
          </div>
        )}
        <div style={{ flex: 1 }} />
        <BigButton onClick={onExit} tone="secondary" testId="inophone-exit">
          Выйти
        </BigButton>
      </div>

      {task && (
        <Panel style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '14px 18px' }}>
          <span style={{ fontSize: 20, color: palette.textDim }}>Найдите:</span>
          {presentation.text && taskText ? (
            <span data-testid="inophone-task-text" style={{ fontSize: 34, fontWeight: 700, color: palette.accent }}>
              {taskText.text}
            </span>
          ) : (
            // Написание выключено — слово ищут на слух, и место под него
            // остаётся занятым, чтобы полоса не прыгала между ходами
            <span style={{ fontSize: 30, color: palette.textDim }}>слово названо вслух</span>
          )}
          <span style={{ fontSize: 18, color: palette.textDim }}>
            {task ? inophone.languageInfo(task.language).nativeName : ''}
          </span>
          <div style={{ flex: 1 }} />
          <BigButton onClick={onRepeatTask} tone="secondary" testId="inophone-repeat">
            Повторить
          </BigButton>
        </Panel>
      )}

      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <SceneStage
          scene={scene}
          highlightAll={learning}
          verdict={verdict}
          disabled={!!verdict || !!openedConceptId}
          onPick={onPick}
          labels={labels}
        />

        {opened && (
          <WordCard
            conceptId={opened.id}
            hasPicture={opened.hasPicture}
            translations={opened.translations}
            interfaceLanguage={interfaceLanguage}
            studyLanguages={studyLanguages}
            onSpeak={(code) => onSpeak(opened.id, code)}
            onClose={onCloseCard}
          />
        )}
      </div>
    </div>
  );
};

export default SceneScreen;
