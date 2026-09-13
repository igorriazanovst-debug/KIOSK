// packages/player/src/alphabet/screens/PlayScreen.tsx
// Игровой экран всех трёх этапов.
//
// ОДИН КОМПОНЕНТ, А НЕ ТРИ. У эталона это три отдельных экрана (LetterShow,
// WordCompleting, WordMake), но разводит их только НИЖНЯЯ панель: сверху
// везде иллюстрация, ход партии, проверка ответа и переход к следующему
// вопросу одинаковы. Три копии этого каркаса разошлись бы при первой же
// правке — и разошлись бы незаметно, потому что каждый экран проверяют
// отдельно.
//
// ОЗВУЧКА — ТОЛЬКО ПО КНОПКЕ, никогда сама. Это перенесено из Тип 2, где
// пользователь потребовал прямо, и причина общая: автоматическая реплика в
// начале каждого вопроса мешает, когда занятие идёт в группе. Пока озвучки в
// пакете нет, кнопка отключена и объясняет почему, а не молчит.
//
// А ВОТ ВОПРОС СЛОВО НЕ НАЗЫВАЕТ — и здесь мы с Тип 2 расходимся. Там
// вопросом было «найди слово Автобус», и назвать слово значило задать вопрос.
// Здесь ровно наоборот: узнать слово по картинке — это и есть задание, и
// написать его текстом значит выдать ответ. Первая версия так и делала:
// «Собери слово по слогам «Ёжик»» — собирать после этого нечего.
//
// Поэтому подпись говорит только ЗАДАЧУ, а само слово несут картинка и
// озвучка. Следствие: пока озвучки нет, всё держится на картинке — и
// заглушки в пакете контента подписаны словом, то есть игра сейчас легче,
// чем будет с настоящими рисунками. Это записано в README пакета.

import React from 'react';
import { alphabet } from '@kiosk/shared';
import type { AlphabetLibrary } from '../types';
import { BigButton, palette } from '../ui';
import { LetterTile, SyllableTile, WordCell, WordPicture } from '../components/GamePieces';
import type { PieceState } from '../components/GamePieces';
import { wordImageUrl } from '../mediaUrl';

type Session = ReturnType<typeof alphabet.buildAlphabetSession>;
type Question = ReturnType<typeof alphabet.currentQuestion>;

interface Props {
  library: AlphabetLibrary;
  session: Session;
  /** Последний ответ — для подсветки; null сразу после перехода к вопросу */
  lastChoice: { key: string; correct: boolean } | null;
  hasAudio: boolean;
  playerName: string;
  onAnswer: (choice: string | number) => void;
  onSpeak: () => void;
  onExit: () => void;
}

const STAGE_PROMPT: Record<string, string> = {
  letterShow: 'С какой буквы начинается это слово?',
  wordCompleting: 'Какого слога не хватает?',
  wordMake: 'Собери слово из слогов',
};

const PlayScreen: React.FC<Props> = ({
  library,
  session,
  lastChoice,
  hasAudio,
  playerName,
  onAnswer,
  onSpeak,
  onExit,
}) => {
  const question = alphabet.currentQuestion(session) as Question;
  if (!question) return null;

  const word = library.words.find((w) => w.id === question.wordId);
  const syllableName = (id: string) =>
    library.syllables.find((s) => s.id === id)?.name ?? id;

  const expected = alphabet.expectedKey(question, session.cellIndex);

  /**
   * Состояние плитки. Отвергнутые варианты ОСТАЮТСЯ на панели красными, а не
   * исчезают: исчезающая кнопка сбивает — ребёнок помнит, что «тут что-то
   * было», и ищет пропажу вместо того, чтобы искать ответ.
   */
  const pieceState = (key: string): PieceState => {
    if (session.rejected.includes(key)) return 'wrong';
    if (lastChoice && lastChoice.correct && lastChoice.key === key) return 'correct';
    return 'idle';
  };

  const answered = (key: string) => session.rejected.includes(key);

  const questionNumber = session.questionIndex + 1;
  const total = session.questionsPerPlayer;

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        alignItems: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          width: '100%',
          // Шапка над сценой: без своего слоя её перекрывали бы крупные
          // плитки при узком окне — та же поправка, что понадобилась в Тип 2
          zIndex: 5,
        }}
      >
        <BigButton onClick={onExit} tone="secondary" testId="play-exit">
          ← Выйти
        </BigButton>
        <div data-testid="play-progress" style={{ fontSize: 22, color: palette.textDim }}>
          Вопрос {questionNumber} из {total}
        </div>
        {session.playerIds.length > 1 && (
          <div data-testid="play-player" style={{ fontSize: 22, fontWeight: 700 }}>
            Ходит {playerName}
          </div>
        )}
      </div>

      {/* Задача — текстом всегда. Слово не называем: см. шапку файла */}
      <div
        data-testid="play-prompt"
        style={{ fontSize: 30, fontWeight: 700, textAlign: 'center' }}
      >
        {STAGE_PROMPT[question.stage]}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 24,
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          minHeight: 0,
          width: '100%',
        }}
      >
        <WordPicture
          src={wordImageUrl(question.wordId)}
          alt={word?.name ?? ''}
          size={question.stage === 'letterShow' ? 300 : 240}
          testId="play-picture"
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
          {question.stage !== 'letterShow' && (
            <div data-testid="play-cells" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {question.stage === 'wordCompleting' &&
                question.shownSyllableIds.map((id, index) => (
                  <WordCell key={index} syllable={syllableName(id)} testId={`play-cell-${index}`} />
                ))}
              {question.stage === 'wordCompleting' && (
                <WordCell syllable={null} active testId="play-cell-empty" />
              )}
              {question.stage === 'wordMake' &&
                question.answerSyllableIds.map((id, index) => (
                  <WordCell
                    key={index}
                    syllable={index < session.cellIndex ? syllableName(id) : null}
                    active={index === session.cellIndex}
                    testId={`play-cell-${index}`}
                  />
                ))}
            </div>
          )}

          <BigButton
            onClick={onSpeak}
            tone="secondary"
            disabled={!hasAudio}
            testId="play-speak"
          >
            {hasAudio ? '🔊 Озвучить' : '🔇 Озвучка ещё не записана'}
          </BigButton>
        </div>
      </div>

      {/* Панель вариантов — всегда восемь, как у эталона */}
      <div
        data-testid="play-options"
        style={{
          background: palette.panel,
          borderRadius: 24,
          padding: 16,
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          justifyContent: 'center',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {question.stage === 'letterShow'
          ? question.optionLetterNumbers.map((number) => {
              const key = String(number);
              const letter = library.letters.find((l) => l.number === number);
              return (
                <LetterTile
                  key={number}
                  letter={letter?.name ?? '?'}
                  state={pieceState(key)}
                  disabled={answered(key)}
                  onClick={() => onAnswer(number)}
                  testId={`play-option-${number}`}
                />
              );
            })
          : question.optionSyllableIds.map((id) => (
              <SyllableTile
                key={id}
                syllable={syllableName(id)}
                state={pieceState(id)}
                disabled={answered(id)}
                onClick={() => onAnswer(id)}
                testId={`play-option-${id}`}
              />
            ))}
      </div>

      {/* Скрытая подсказка для живой проверки: что здесь верно. Игроку не
          видна, но позволяет прогону не «угадывать» ответ перебором — иначе
          проверка проходила бы даже на сломанной проверке ответа */}
      <span data-testid="play-expected" hidden>
        {expected}
      </span>
    </div>
  );
};

export default PlayScreen;
