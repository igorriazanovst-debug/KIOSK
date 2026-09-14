// packages/player/src/inophone/components/WordCard.tsx
// Карточка объекта: одно понятие на родном и изучаемых языках (ТЗ строка 90).
//
// РОДНОЙ ЯЗЫК СТОИТ ОТДЕЛЬНО И ПЕРВЫМ, а не в общем списке. Это опора, от
// которой ученик отталкивается; смешав его с изучаемыми, мы заставили бы
// каждый раз искать глазами, что из шести строк ему знакомо.
//
// ЯЗЫК НАЗЫВАЕТ СЕБЯ САМ — «Deutsch», а не «немецкий». Пособие для инофона
// открывает человек, который русского может ещё не знать, и подпись на языке,
// которого он не понимает, ничего ему не сообщает.
//
// МОЛЧАЩЕЕ СЛОВО ГОВОРИТ, ЧТО ОНО МОЛЧИТ. Кнопка звука у слова без записи не
// прячется, а показывается погашенной с подписью: исчезнувшая кнопка читается
// как «здесь звука не бывает», погашенная — как «этот ещё не записан», и
// второе — правда.

import React from 'react';
import { inophone } from '@kiosk/shared';
import type { LanguageCode } from '../types';
import { palette, BigButton } from '../ui';
import { conceptImageUrl } from '../mediaUrl';

export interface WordCardProps {
  conceptId: string;
  hasPicture: boolean;
  /** Написание и наличие звука по языкам */
  translations: Record<string, { text: string; hasAudio: boolean } | undefined>;
  interfaceLanguage: LanguageCode;
  studyLanguages: readonly LanguageCode[];
  onSpeak: (code: LanguageCode) => void;
  onClose: () => void;
}

const Line: React.FC<{
  code: LanguageCode;
  text: string;
  hasAudio: boolean;
  onSpeak: () => void;
  main?: boolean;
}> = ({ code, text, hasAudio, onSpeak, main }) => (
  <div
    data-testid={`inophone-word-${code}`}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '10px 0',
      borderTop: main ? 'none' : `1px solid ${palette.panelEdge}`,
    }}
  >
    <span style={{ width: 130, color: palette.textDim, fontSize: 18 }}>
      {inophone.languageInfo(code).nativeName}
    </span>
    <span
      style={{
        flex: 1,
        fontSize: main ? 34 : 30,
        fontWeight: main ? 700 : 600,
        color: main ? palette.accent : palette.text,
      }}
    >
      {text}
    </span>
    <button
      type="button"
      data-testid={`inophone-speak-${code}`}
      onClick={onSpeak}
      disabled={!hasAudio}
      title={hasAudio ? 'Послушать' : 'Произношение ещё не записано'}
      style={{
        background: hasAudio ? palette.accentCool : palette.panelEdge,
        color: palette.text,
        border: 'none',
        borderRadius: 12,
        minWidth: 56,
        minHeight: 56,
        fontSize: 24,
        cursor: hasAudio ? 'pointer' : 'default',
        opacity: hasAudio ? 1 : 0.45,
      }}
    >
      ▶
    </button>
  </div>
);

const WordCard: React.FC<WordCardProps> = ({
  conceptId,
  hasPicture,
  translations,
  interfaceLanguage,
  studyLanguages,
  onSpeak,
  onClose,
}) => {
  const native = translations[interfaceLanguage];

  return (
    <div
      data-testid="inophone-card"
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(21,34,48,0.82)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 18,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: palette.panel,
          border: `2px solid ${palette.panelEdge}`,
          borderRadius: 20,
          padding: 28,
          width: 720,
          maxWidth: '90%',
          display: 'flex',
          gap: 24,
        }}
      >
        {hasPicture && (
          <img
            src={conceptImageUrl(conceptId)}
            alt=""
            style={{ width: 220, height: 220, objectFit: 'contain', background: palette.card, borderRadius: 16 }}
          />
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          {native && (
            <Line
              code={interfaceLanguage}
              text={native.text}
              hasAudio={native.hasAudio}
              onSpeak={() => onSpeak(interfaceLanguage)}
              main
            />
          )}
          {studyLanguages.map((code) => {
            const t = translations[code];
            if (!t) return null;
            return (
              <Line
                key={code}
                code={code}
                text={t.text}
                hasAudio={t.hasAudio}
                onSpeak={() => onSpeak(code)}
              />
            );
          })}

          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
            <BigButton onClick={onClose} tone="secondary" testId="inophone-card-close">
              Закрыть
            </BigButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WordCard;
