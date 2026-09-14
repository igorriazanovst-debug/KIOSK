// packages/player/src/inophone/screens/DictionaryScreen.tsx
// Словарь с поиском (ТЗ строка 90).
//
// ПОИСК ИДЁТ ПО ВСЕМ ШЕСТИ ЯЗЫКАМ СРАЗУ, а не по выбранному. Пособие открывает
// человек, который ищет слово тем языком, каким владеет, — и заставлять его
// сначала указать, на каком языке он собирается искать, значит требовать
// ответа на вопрос, которого он себе не задавал.
//
// РЕГИСТР И «Ё» НЕ ИМЕЮТ ЗНАЧЕНИЯ. «Ковер» обязан находить «ковёр»: на
// клавиатуре у доски «ё» набирают единицы, и пустая выдача читается как
// «такого слова в программе нет».
//
// ПОКАЗЫВАЕТСЯ НЕ ВЕСЬ СЛОВАРЬ СРАЗУ. Понятий по ТЗ не меньше трёхсот
// пятидесяти; список такой длины на доске бесполезен, и без запроса
// показывается его начало с явной подписью, сколько всего.

import React from 'react';
import { inophone } from '@kiosk/shared';
import type { InophoneLibrary, LanguageCode } from '../types';
import { Panel, ScreenHeader, palette } from '../ui';
import { conceptImageUrl } from '../mediaUrl';
import { matches } from '../search';

const PAGE = 40;

interface Props {
  library: InophoneLibrary;
  interfaceLanguage: LanguageCode;
  studyLanguages: readonly LanguageCode[];
  onSpeak: (conceptId: string, code: LanguageCode) => void;
  onBack: () => void;
}

const DictionaryScreen: React.FC<Props> = ({
  library,
  interfaceLanguage,
  studyLanguages,
  onSpeak,
  onBack,
}) => {
  const [query, setQuery] = React.useState('');

  const shown = React.useMemo(() => {
    const all = library.concepts.filter((c) => matches(c, query));
    return { total: all.length, rows: all.slice(0, PAGE) };
  }, [library, query]);

  const columns: LanguageCode[] = [
    interfaceLanguage,
    ...studyLanguages.filter((c) => c !== interfaceLanguage),
  ];

  return (
    <div>
      <ScreenHeader title="Словарь" onBack={onBack} />

      <Panel style={{ marginBottom: 18 }}>
        <input
          data-testid="inophone-search"
          value={query}
          placeholder="Поиск на любом из шести языков"
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            fontSize: 22,
            padding: '12px 16px',
            borderRadius: 12,
            border: `2px solid ${palette.panelEdge}`,
            background: palette.card,
            color: palette.textDark,
          }}
        />
        <div data-testid="inophone-found" style={{ marginTop: 10, fontSize: 18, color: palette.textDim }}>
          {shown.total === 0
            ? 'Ничего не нашлось'
            : shown.rows.length < shown.total
              ? `Найдено ${shown.total}, показаны первые ${shown.rows.length}`
              : `Найдено ${shown.total}`}
        </div>
      </Panel>

      <div style={{ display: 'grid', gap: 12 }}>
        {shown.rows.map((c) => (
          <Panel key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 12 }}>
            {c.hasPicture && (
              <img
                src={conceptImageUrl(c.id)}
                alt=""
                style={{ width: 72, height: 72, objectFit: 'contain', background: palette.card, borderRadius: 10 }}
              />
            )}
            <div style={{ display: 'flex', flex: 1, gap: 16, flexWrap: 'wrap' }}>
              {columns.map((code) => {
                const t = c.translations[code];
                if (!t) return null;
                return (
                  <button
                    key={code}
                    type="button"
                    data-testid={`inophone-dict-${c.id}-${code}`}
                    onClick={() => onSpeak(c.id, code)}
                    disabled={!t.hasAudio}
                    title={t.hasAudio ? 'Послушать' : 'Произношение ещё не записано'}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      textAlign: 'left',
                      cursor: t.hasAudio ? 'pointer' : 'default',
                      color: code === interfaceLanguage ? palette.accent : palette.text,
                      padding: 0,
                      minWidth: 160,
                    }}
                  >
                    <div style={{ fontSize: 14, color: palette.textDim }}>
                      {inophone.languageInfo(code).nativeName}
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 600 }}>
                      {t.text} {t.hasAudio ? '▶' : ''}
                    </div>
                  </button>
                );
              })}
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
};

export default DictionaryScreen;
