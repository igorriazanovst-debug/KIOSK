// packages/player/src/words/screens/WordImagesScreen.tsx
// Картинки поставочных слов: педагог может заменить любую своей и вернуть
// обратно поставочную (ТЗ строка 42 — «редактировать материалы»).
//
// Зачем отдельный экран, а не правка внутри «Моих слов»: там педагог заводит
// СВОИ слова, здесь — правит ЧУЖИЕ, поставочные. Операции разные по смыслу и
// по последствиям: своё слово можно удалить совсем, поставочное — нельзя,
// у него можно только подменить картинку, и подмена всегда обратима.
//
// Поставочный пакет при этом не трогается вовсе. Он read-only и приезжает в
// дистрибутиве; правка в нём не пережила бы обновление контента. Подмены
// лежат отдельным файлом в данных устройства.

import React, { useMemo, useState } from 'react';
import { BigButton, ErrorBanner, ScreenFrame, ScrollArea, palette, TOUCH_TARGET_PX } from '../ui';
import type { WordsLibrary, WordImageOverrides } from '@kiosk/shared';

interface Props {
  library: WordsLibrary | null;
  overrides: WordImageOverrides;
  error: string | null;
  busy: boolean;
  /** Ссылка на текущую картинку слова — своя, если она есть, иначе поставочная */
  imageUrlFor: (wordId: string) => string | null;
  onBack: () => void;
  onPick: (wordId: string) => void;
  onClear: (wordId: string) => void;
  /** Произнести слово — чтобы педагог слышал, к чему подбирает картинку */
  onSpeak: (wordId: string) => void;
}

const WordImagesScreen: React.FC<Props> = ({
  library,
  overrides,
  error,
  busy,
  imageUrlFor,
  onBack,
  onPick,
  onClear,
  onSpeak,
}) => {
  const [themeId, setThemeId] = useState<string | null>(null);

  const themes = library?.themes ?? [];
  const activeTheme = themeId ?? themes[0]?.id ?? null;

  const words = useMemo(() => {
    if (!library || !activeTheme) return [];
    const ids = new Set(library.themes.find((t) => t.id === activeTheme)?.wordIds ?? []);
    return library.words.filter((w) => ids.has(w.id));
  }, [library, activeTheme]);

  const changed = Object.keys(overrides).length;

  return (
    <ScreenFrame title="Картинки слов" onBack={onBack}>
      <ErrorBanner text={error} />

      {!library && (
        <span style={{ fontSize: 22, color: palette.textMuted }}>
          Пакет учебного контента не подключён — заменять пока нечего.
        </span>
      )}

      {library && (
        <>
          <span style={{ fontSize: 20, color: palette.textMuted }}>
            Можно поставить слову свою картинку. Поставочная при этом никуда не денется —
            её всегда можно вернуть. Заменено сейчас: {changed}.
          </span>

          {/* Темы вкладками: 270 слов одним списком не пролистать */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {themes.map((theme) => (
              <BigButton
                key={theme.id}
                onClick={() => setThemeId(theme.id)}
                tone={theme.id === activeTheme ? 'primary' : 'secondary'}
                testId={`theme-tab-${theme.id}`}
              >
                {theme.title}
              </BigButton>
            ))}
          </div>

          <ScrollArea style={{ flex: 1 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
              {words.map((word) => {
                const own = Object.prototype.hasOwnProperty.call(overrides, word.id);
                const url = imageUrlFor(word.id);
                return (
                  <div
                    key={word.id}
                    data-testid={`word-image-${word.id}`}
                    data-own-image={own ? 'true' : 'false'}
                    style={{
                      width: 260,
                      background: palette.panel,
                      borderRadius: 14,
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      border: own ? `2px solid ${palette.accent}` : '2px solid transparent',
                    }}
                  >
                    <div
                      style={{
                        height: 150,
                        background: palette.panelLight,
                        borderRadius: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {url ? (
                        <img src={url} alt="" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
                      ) : (
                        <span style={{ fontSize: 18, color: palette.textMuted }}>нет картинки</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ flex: 1, fontSize: 22 }}>{word.name}</span>
                      {own && <span style={{ fontSize: 15, color: palette.accent }}>своя</span>}
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => onSpeak(word.id)}
                        data-testid={`speak-${word.id}`}
                        aria-label={`Озвучить слово ${word.name}`}
                        style={{
                          minWidth: TOUCH_TARGET_PX,
                          minHeight: TOUCH_TARGET_PX - 12,
                          fontSize: 24,
                          borderRadius: 10,
                          border: 'none',
                          background: palette.panelLight,
                          color: palette.text,
                          cursor: 'pointer',
                        }}
                      >
                        🔊
                      </button>
                      <BigButton
                        onClick={() => onPick(word.id)}
                        tone="secondary"
                        disabled={busy}
                        testId={`pick-image-${word.id}`}
                      >
                        Заменить
                      </BigButton>
                      {own && (
                        <BigButton
                          onClick={() => onClear(word.id)}
                          tone="danger"
                          disabled={busy}
                          testId={`clear-image-${word.id}`}
                        >
                          Вернуть
                        </BigButton>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </>
      )}
    </ScreenFrame>
  );
};

export default WordImagesScreen;
