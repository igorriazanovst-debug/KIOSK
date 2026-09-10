// packages/player/src/words/screens/MyWordsScreen.tsx
// «Мои слова» — точка входа в редактор контента педагога.
//
// Закрывает требования ТЗ: строка 57 (создание своих слов и объединение их
// в темы) и строка 56 в части создания, удаления и переименования
// комплектов. Сам разбор эталона показывает ровно такой экран: список своих
// слов и комплектов с набором операций внизу.
//
// Удаление слова — с подтверждением, потому что оно необратимо и вдобавок
// вычищает слово из всех комплектов, где оно использовалось. Педагог должен
// узнать об этом ДО удаления, а не обнаружить потом.

import React, { useState } from 'react';
import { BigButton, ErrorBanner, ScreenFrame, ScrollArea, palette, TOUCH_TARGET_PX } from '../ui';
import { userMediaUrl } from '../mediaUrl';
import type { UserWord, UserSet, WordsLibrary } from '@kiosk/shared';

interface Props {
  words: UserWord[];
  sets: UserSet[];
  library: WordsLibrary | null;
  error: string | null;
  busy: boolean;
  onBack: () => void;
  onNewWord: () => void;
  onEditWord: (wordId: string) => void;
  onDeleteWord: (wordId: string) => void;
  onNewSet: () => void;
  onEditSet: (setId: string) => void;
  onDeleteSet: (setId: string) => void;
}

const MyWordsScreen: React.FC<Props> = ({
  words,
  sets,
  library,
  error,
  busy,
  onBack,
  onNewWord,
  onEditWord,
  onDeleteWord,
  onNewSet,
  onEditSet,
  onDeleteSet,
}) => {
  const [confirm, setConfirm] = useState<{ kind: 'word' | 'set'; id: string; title: string } | null>(
    null
  );

  const setsUsingWord = (wordId: string) => sets.filter((s) => s.wordIds.includes(wordId));

  const confirmText = () => {
    if (!confirm) return '';
    if (confirm.kind === 'set') return `Удалить комплект «${confirm.title}»? Слова останутся.`;
    const affected = setsUsingWord(confirm.id);
    const tail =
      affected.length > 0
        ? ` Оно будет убрано из ${affected.length === 1 ? 'комплекта' : 'комплектов'}: ${affected
            .map((s) => `«${s.title}»`)
            .join(', ')}.`
        : '';
    return `Удалить слово «${confirm.title}»?${tail}`;
  };

  return (
    <ScreenFrame title="Мои слова" onBack={onBack}>
      <ErrorBanner text={error} />

      {confirm && (
        <div
          data-testid="confirm"
          style={{
            background: palette.panelLight,
            border: `2px solid ${palette.accent}`,
            borderRadius: 12,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <span style={{ fontSize: 24 }}>{confirmText()}</span>
          <div style={{ display: 'flex', gap: 12 }}>
            <BigButton
              onClick={() => {
                const target = confirm;
                setConfirm(null);
                if (target.kind === 'word') onDeleteWord(target.id);
                else onDeleteSet(target.id);
              }}
              tone="danger"
              testId="confirm-yes"
            >
              Удалить
            </BigButton>
            <BigButton onClick={() => setConfirm(null)} tone="secondary" testId="confirm-no">
              Отмена
            </BigButton>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 24, flex: 1, minHeight: 0 }}>
        {/* Свои слова */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 26 }}>Слова ({words.length})</span>
            <BigButton onClick={onNewWord} testId="new-word">
              + Слово
            </BigButton>
          </div>

          <ScrollArea style={{ flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {words.length === 0 && (
                <span style={{ fontSize: 20, color: palette.textMuted }}>
                  Своих слов пока нет. Можно добавить слово с картинкой и записать его голосом.
                </span>
              )}
              {words.map((word) => (
                <div
                  key={word.id}
                  data-testid={`my-word-${word.name}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    background: palette.panel,
                    borderRadius: 12,
                    padding: 10,
                    minHeight: TOUCH_TARGET_PX,
                  }}
                >
                  {word.imageFile ? (
                    <img
                      src={userMediaUrl(word.imageFile)}
                      alt=""
                      style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }}
                    />
                  ) : (
                    <span style={{ width: 56, textAlign: 'center', fontSize: 28 }}>🔊</span>
                  )}
                  <span style={{ flex: 1, fontSize: 24, minWidth: 0 }}>{word.name}</span>
                  <BigButton onClick={() => onEditWord(word.id)} tone="secondary" testId={`edit-word-${word.name}`}>
                    Правка
                  </BigButton>
                  <BigButton
                    onClick={() => setConfirm({ kind: 'word', id: word.id, title: word.name })}
                    tone="danger"
                    disabled={busy}
                    testId={`delete-word-${word.name}`}
                  >
                    Удалить
                  </BigButton>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Комплекты */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 26 }}>Комплекты ({sets.length})</span>
            <BigButton onClick={onNewSet} testId="new-set">
              + Комплект
            </BigButton>
          </div>

          <ScrollArea style={{ flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sets.length === 0 && (
                <span style={{ fontSize: 20, color: palette.textMuted }}>
                  Комплект — это своя тема для занятия. В него можно взять и поставочные слова, и свои.
                </span>
              )}
              {sets.map((set) => (
                <div
                  key={set.id}
                  data-testid={`my-set-${set.title}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    background: palette.panel,
                    borderRadius: 12,
                    padding: 10,
                    minHeight: TOUCH_TARGET_PX,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 24 }}>{set.title}</div>
                    <div style={{ fontSize: 18, color: palette.textMuted }}>
                      слов: {set.wordIds.length}
                    </div>
                  </div>
                  <BigButton onClick={() => onEditSet(set.id)} tone="secondary" testId={`edit-set-${set.title}`}>
                    Правка
                  </BigButton>
                  <BigButton
                    onClick={() => setConfirm({ kind: 'set', id: set.id, title: set.title })}
                    tone="danger"
                    disabled={busy}
                    testId={`delete-set-${set.title}`}
                  >
                    Удалить
                  </BigButton>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      {library && (
        <span style={{ fontSize: 18, color: palette.textMuted }}>
          В поставке {library.words.length} слов и {library.themes.length} тем — их можно брать в свои комплекты.
        </span>
      )}
    </ScreenFrame>
  );
};

export default MyWordsScreen;
