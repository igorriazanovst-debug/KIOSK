// packages/player/src/alphabet/screens/MyContentScreen.tsx
// Свои слова и комплекты — ТЗ строки 77 и 78.
//
// ДВЕ ВКЛАДКИ НА ОДНОМ ЭКРАНЕ, а не два пункта меню: слова и комплекты
// редактируют вместе — собрал слово, положил в комплект, — и разводить их по
// разным разделам значило бы гонять педагога туда-сюда.
//
// В КОМПЛЕКТ КЛАДУТСЯ И ПОСТАВОЧНЫЕ СЛОВА, И СВОИ. ТЗ строка 77 требует этого
// буквально («как из существующих слов, так и из слов, добавленных
// самостоятельно»), и у эталона это две панели: слева библиотека, справа
// собираемый комплект. Повторяем.

import React, { useMemo, useState } from 'react';
import { BigButton, Panel, ScrollArea, palette } from '../ui';
import type { Word, WordReadiness, WordSet } from '../types';

interface Props {
  /** Все слова: поставочные и свои */
  allWords: Word[];
  userWords: Word[];
  sets: WordSet[];
  readiness: Record<string, WordReadiness>;
  busy: boolean;
  onNewWord: () => void;
  onEditWord: (wordId: string) => void;
  onDeleteWord: (wordId: string) => void;
  onSaveSet: (setId: string | null, title: string, wordIds: string[]) => void;
  onDeleteSet: (setId: string) => void;
  onBack: () => void;
}

type Tab = 'words' | 'sets';

const MyContentScreen: React.FC<Props> = ({
  allWords,
  userWords,
  sets,
  readiness,
  busy,
  onNewWord,
  onEditWord,
  onDeleteWord,
  onSaveSet,
  onDeleteSet,
  onBack,
}) => {
  const [tab, setTab] = useState<Tab>('words');
  const [editingSet, setEditingSet] = useState<WordSet | null>(null);
  const [setTitle, setSetTitle] = useState('');
  const [setWords, setSetWords] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  const userSets = sets.filter((s) => /^u[a-f0-9]{16}$/.test(s.id));
  const byId = useMemo(() => new Map(allWords.map((w) => [w.id, w])), [allWords]);

  const startNewSet = () => {
    setEditingSet({ id: '', title: '', wordIds: [] });
    setSetTitle('');
    setSetWords([]);
  };

  const startEditSet = (set: WordSet) => {
    setEditingSet(set);
    setSetTitle(set.title);
    setSetWords([...set.wordIds]);
  };

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? allWords.filter((w) => w.name.toLowerCase().startsWith(q)) : allWords;
    return list.filter((w) => !setWords.includes(w.id)).slice(0, 60);
  }, [allWords, search, setWords]);

  return (
    <Panel testId="my-content">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <BigButton onClick={onBack} tone="secondary" testId="my-content-back">
          ← Назад
        </BigButton>
        <BigButton
          onClick={() => setTab('words')}
          tone={tab === 'words' ? 'primary' : 'secondary'}
          testId="my-content-tab-words"
        >
          Свои слова ({userWords.length})
        </BigButton>
        <BigButton
          onClick={() => setTab('sets')}
          tone={tab === 'sets' ? 'primary' : 'secondary'}
          testId="my-content-tab-sets"
        >
          Комплекты ({userSets.length})
        </BigButton>
      </div>

      {tab === 'words' && (
        <>
          <BigButton onClick={onNewWord} disabled={busy} testId="my-content-new-word">
            + Новое слово
          </BigButton>
          <ScrollArea testId="my-content-words">
            {userWords.length === 0 && (
              <p style={{ fontSize: 19, color: palette.textDim, margin: 0 }}>
                Своих слов пока нет. Своё слово работает наравне с поставочными во всех трёх этапах.
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 8 }}>
              {userWords.map((word) => {
                const r = readiness[word.id];
                return (
                  <div
                    key={word.id}
                    data-testid={`my-word-${word.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      background: 'rgba(255,255,255,0.10)',
                      borderRadius: 12,
                      padding: '10px 14px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ fontSize: 22, fontWeight: 700, minWidth: 180 }}>{word.name}</span>
                    {/* Готовность показывается списком, а не значком: педагогу
                        нужно знать, ЧЕГО не хватает, а не что «что-то не так» */}
                    <span
                      data-testid={`my-word-readiness-${word.id}`}
                      style={{ fontSize: 18, color: r && r.missing.length === 0 ? '#8ed0a0' : palette.textDim, flex: 1 }}
                    >
                      {!r
                        ? ''
                        : r.missing.length === 0
                          ? '✓ работает на всех этапах'
                          : `не хватает: ${r.missing.join(', ')}`}
                    </span>
                    <BigButton onClick={() => onEditWord(word.id)} tone="secondary" testId={`my-word-edit-${word.id}`}>
                      Изменить
                    </BigButton>
                    <BigButton onClick={() => onDeleteWord(word.id)} tone="danger" testId={`my-word-delete-${word.id}`}>
                      Удалить
                    </BigButton>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </>
      )}

      {tab === 'sets' && !editingSet && (
        <>
          <BigButton onClick={startNewSet} disabled={busy} testId="my-content-new-set">
            + Новый комплект
          </BigButton>
          <ScrollArea testId="my-content-sets">
            {userSets.length === 0 && (
              <p style={{ fontSize: 19, color: palette.textDim, margin: 0 }}>
                Комплектов пока нет. Комплект — это набор слов для одного занятия.
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 8 }}>
              {userSets.map((set) => (
                <div
                  key={set.id}
                  data-testid={`my-set-${set.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    background: 'rgba(255,255,255,0.10)',
                    borderRadius: 12,
                    padding: '10px 14px',
                  }}
                >
                  <span style={{ fontSize: 22, fontWeight: 700, minWidth: 240 }}>{set.title}</span>
                  <span style={{ fontSize: 18, color: palette.textDim, flex: 1 }}>
                    слов: {set.wordIds.length}
                  </span>
                  <BigButton onClick={() => startEditSet(set)} tone="secondary" testId={`my-set-edit-${set.id}`}>
                    Изменить
                  </BigButton>
                  <BigButton onClick={() => onDeleteSet(set.id)} tone="danger" testId={`my-set-delete-${set.id}`}>
                    Удалить
                  </BigButton>
                </div>
              ))}
            </div>
          </ScrollArea>
        </>
      )}

      {tab === 'sets' && editingSet && (
        <>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              data-testid="set-editor-title"
              value={setTitle}
              placeholder="Название комплекта"
              onChange={(e) => setSetTitle(e.target.value)}
              style={{ fontSize: 22, padding: '10px 14px', borderRadius: 12, border: 'none', width: 320 }}
            />
            <BigButton
              onClick={() => {
                onSaveSet(editingSet.id || null, setTitle, setWords);
                setEditingSet(null);
              }}
              disabled={busy || setTitle.trim().length === 0}
              testId="set-editor-save"
            >
              Сохранить
            </BigButton>
            <BigButton onClick={() => setEditingSet(null)} tone="secondary" testId="set-editor-cancel">
              Отмена
            </BigButton>
          </div>

          {/* Две панели, как у эталона: слева библиотека, справа комплект */}
          <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 19 }}>Все слова</span>
                <input
                  data-testid="set-editor-search"
                  value={search}
                  placeholder="поиск"
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ fontSize: 18, padding: '6px 10px', borderRadius: 10, border: 'none', width: 140 }}
                />
              </div>
              <ScrollArea testId="set-editor-library">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingRight: 8 }}>
                  {candidates.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      data-testid={`set-editor-add-${w.id}`}
                      onClick={() => setSetWords((list) => [...list, w.id])}
                      style={{
                        background: 'rgba(255,255,255,0.14)',
                        color: palette.text,
                        border: 'none',
                        borderRadius: 10,
                        padding: '8px 12px',
                        fontSize: 18,
                        cursor: 'pointer',
                      }}
                    >
                      {w.name} +
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 19 }}>В комплекте ({setWords.length})</span>
              <ScrollArea testId="set-editor-picked">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingRight: 8 }}>
                  {setWords.map((id, index) => (
                    <button
                      key={`${id}-${index}`}
                      type="button"
                      data-testid={`set-editor-remove-${id}`}
                      onClick={() => setSetWords((list) => list.filter((x) => x !== id))}
                      style={{
                        background: palette.accent,
                        color: palette.textDark,
                        border: 'none',
                        borderRadius: 10,
                        padding: '8px 12px',
                        fontSize: 18,
                        cursor: 'pointer',
                      }}
                    >
                      {byId.get(id)?.name ?? id} ✕
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </>
      )}
    </Panel>
  );
};

export default MyContentScreen;
