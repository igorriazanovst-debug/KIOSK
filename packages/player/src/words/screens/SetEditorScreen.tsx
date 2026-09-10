// packages/player/src/words/screens/SetEditorScreen.tsx
// Библиотека элементов и сборка комплекта — ТЗ строка 56: «создания,
// удаления, переименования, импортирования и экспортирования своих
// комплектов слов, как из существующих слов, так и из слов, добавленных
// самостоятельно».
//
// Устройство экрана повторяет эталон: слева полный список всех слов с
// поиском по названию, справа собираемый комплект, слова переносятся между
// списками. Условие «как из существующих, так и из своих» выполняется
// буквально — оба вида слов в одном списке, свои помечены.

import React, { useMemo, useState } from 'react';
import { BigButton, ErrorBanner, ScreenFrame, ScrollArea, palette, TOUCH_TARGET_PX } from '../ui';
import Keyboard from '../components/Keyboard';
import { wordImageUrl, userMediaUrl } from '../mediaUrl';
import type { UserSet, UserWord, WordsLibrary } from '@kiosk/shared';
import type { SetDraft } from '../types';

interface Props {
  library: WordsLibrary | null;
  userWords: UserWord[];
  /** null — создаём новый комплект */
  editing: UserSet | null;
  error: string | null;
  busy: boolean;
  onCancel: () => void;
  onSave: (draft: SetDraft) => void;
}

interface Item {
  id: string;
  name: string;
  imageUrl: string | null;
  own: boolean;
}

const SetEditorScreen: React.FC<Props> = ({
  library,
  userWords,
  editing,
  error,
  busy,
  onCancel,
  onSave,
}) => {
  const [title, setTitle] = useState(editing?.title ?? '');
  const [chosen, setChosen] = useState<string[]>(editing ? [...editing.wordIds] : []);
  const [query, setQuery] = useState('');
  const [renaming, setRenaming] = useState(!editing);

  const allItems: Item[] = useMemo(() => {
    const library_ = (library?.words ?? []).map((w) => ({
      id: w.id,
      name: w.name,
      imageUrl: wordImageUrl(w.id),
      own: false,
    }));
    const own = userWords.map((w) => ({
      id: w.id,
      name: w.name,
      imageUrl: w.imageFile ? userMediaUrl(w.imageFile) : null,
      own: true,
    }));
    return [...own, ...library_];
  }, [library, userWords]);

  const byId = useMemo(() => new Map(allItems.map((i) => [i.id, i])), [allItems]);

  const available = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return allItems.filter(
      (i) => !chosen.includes(i.id) && (!needle || i.name.toLowerCase().includes(needle))
    );
  }, [allItems, chosen, query]);

  const card = (item: Item, onPress: () => void, testPrefix: string) => (
    <button
      key={item.id}
      data-testid={`${testPrefix}-${item.name}`}
      onClick={onPress}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: palette.panel,
        border: item.own ? `2px solid ${palette.accent}` : 'none',
        borderRadius: 10,
        padding: 8,
        minHeight: TOUCH_TARGET_PX,
        cursor: 'pointer',
        color: palette.text,
        fontFamily: 'inherit',
        textAlign: 'left',
      }}
    >
      {item.imageUrl ? (
        <img src={item.imageUrl} alt="" style={{ width: 44, height: 44, objectFit: 'contain' }} />
      ) : (
        <span style={{ width: 44, textAlign: 'center', fontSize: 24 }}>🔊</span>
      )}
      <span style={{ flex: 1, fontSize: 22 }}>{item.name}</span>
      {item.own && <span style={{ fontSize: 16, color: palette.textMuted }}>своё</span>}
    </button>
  );

  if (renaming) {
    return (
      <ScreenFrame title={editing ? 'Название комплекта' : 'Новый комплект'} onBack={onCancel}>
        <ErrorBanner text={error} />
        <div
          data-testid="set-title"
          style={{
            minHeight: TOUCH_TARGET_PX,
            fontSize: 32,
            padding: '12px 18px',
            borderRadius: 12,
            border: `2px solid ${palette.accent}`,
            background: palette.bg,
          }}
        >
          {title || <span style={{ color: palette.textMuted }}>Введите название темы</span>}
        </div>
        <Keyboard value={title} onChange={setTitle} maxLength={80} />
        <div style={{ display: 'flex', gap: 16 }}>
          <BigButton onClick={onCancel} tone="secondary">
            Отмена
          </BigButton>
          <BigButton
            onClick={() => setRenaming(false)}
            disabled={!title.trim()}
            wide
            testId="title-done"
          >
            Дальше — выбрать слова
          </BigButton>
        </div>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame title={`Комплект «${title}»`} onBack={onCancel}>
      <ErrorBanner text={error} />

      <div style={{ display: 'flex', gap: 20, flex: 1, minHeight: 0 }}>
        {/* Библиотека элементов */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          <span style={{ fontSize: 24 }}>Все слова ({available.length})</span>
          <input
            data-testid="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по названию"
            style={{
              minHeight: TOUCH_TARGET_PX - 16,
              fontSize: 22,
              padding: '8px 14px',
              borderRadius: 10,
              border: `2px solid ${palette.panelLight}`,
              background: palette.bg,
              color: palette.text,
            }}
          />
          <ScrollArea style={{ flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {available.length === 0 && (
                <span style={{ fontSize: 20, color: palette.textMuted }}>Ничего не найдено</span>
              )}
              {available.map((item) =>
                card(item, () => setChosen((ids) => [...ids, item.id]), 'available')
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Собираемый комплект */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 24 }}>В комплекте ({chosen.length})</span>
            <BigButton onClick={() => setRenaming(true)} tone="secondary" testId="rename-set">
              Переименовать
            </BigButton>
          </div>
          <ScrollArea style={{ flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {chosen.length === 0 && (
                <span style={{ fontSize: 20, color: palette.textMuted }}>
                  Нажимайте слова слева, чтобы добавить их в комплект
                </span>
              )}
              {chosen.map((id) => {
                const item = byId.get(id);
                if (!item) return null;
                return card(item, () => setChosen((ids) => ids.filter((x) => x !== id)), 'chosen');
              })}
            </div>
          </ScrollArea>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <BigButton onClick={onCancel} tone="secondary" testId="cancel-set">
          Отмена
        </BigButton>
        <BigButton
          onClick={() => onSave({ title: title.trim(), wordIds: chosen })}
          disabled={busy || chosen.length < 2 || !title.trim()}
          wide
          testId="save-set"
        >
          Сохранить комплект
        </BigButton>
        {chosen.length < 2 && (
          <span style={{ fontSize: 18, color: palette.textMuted }}>
            Нужно хотя бы два слова — иначе выбирать ребёнку не из чего
          </span>
        )}
      </div>
    </ScreenFrame>
  );
};

export default SetEditorScreen;
