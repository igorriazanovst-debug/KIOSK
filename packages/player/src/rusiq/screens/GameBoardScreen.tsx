// packages/player/src/rusiq/screens/GameBoardScreen.tsx
import React, { useEffect, useRef, useState } from 'react';
import type { RusiqPoint, RusiqQuestion } from '../model/schema.ts';
import { scoreForAnswer, nextTurn, neutralTileLabels, orderTilesByPosition, type RusiqAnswerEvent } from '../gameLogic.ts';
import { rusiqItemImageUrl } from '../rusiqMediaUrl.ts';
import '../rusiqTheme.css';

interface Props {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  playerNames: string[];
  questionsByPlayer: RusiqQuestion[][];
  genericDecoyPoints: RusiqPoint[];
  onFinished: (answers: RusiqAnswerEvent[]) => void;
}

// Точки поля рендерятся в % от натурального размера изображения (раздел 5
// спеки), а не в абсолютных пикселях исходной картинки — сама картинка
// (1919×1080, см. rusiqContent.json `image`) показывается в ограниченном
// по ширине контейнере с сохранением пропорций через CSS `aspect-ratio`.
// Благодаря этому позиционирование корректно при любом фактическом размере
// показа: не нужно вручную пересчитывать масштаб-фактор для каждой точки.
const DISPLAY_MAX_WIDTH_CSS = 'min(1200px, 92vw)';

// Единый стиль для ВСЕХ точек в состоянии "не нажато" — правильный ответ,
// ложные точки текущего вопроса (`decoyPoints`) и общие ложные точки поля
// (`genericDecoyPoints`) визуально неотличимы (находка 6 финального ревью):
// иначе цвет точки сам по себе становится подсказкой правильного ответа.
// Прозрачность снижена (2026-09-12): каждая буква алфавита — вариант
// ответа, поэтому все 33 плитки покрыты областью клика одновременно
// (не разреженный набор decoy) - при плотности 0.55 сплошная заливка всей
// доски смотрелась тяжело; на 0.28 видно, что вся доска кликабельна, но
// сами буквы/картинки остаются хорошо читаемыми под областью.
const POINT_COLOR = 'rgba(90, 90, 90, 0.28)';
const POINT_RING = '2px solid rgba(255, 255, 255, 0.5)';
const FEEDBACK_CORRECT_COLOR = 'rgba(62, 207, 126, 0.85)';
const FEEDBACK_WRONG_COLOR = 'rgba(255, 107, 107, 0.85)';
const FEEDBACK_DURATION_MS = 900;

// Одна кликабельная плитка доски после дедупликации (см. buildTiles ниже).
interface BoardTile {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isCorrect: boolean;
}

function tileKey(point: { x: number; y: number }): string {
  return `${Math.round(point.x)}_${Math.round(point.y)}`;
}

// Находка живьём (2026-09-12): genericDecoyPoints теперь покрывает ВСЕ
// плитки доски (каждая буква алфавита - вариант ответа, не разреженный
// набор decoy - по прямому уточнению пользователя), поэтому плитка
// правильного ответа (и любая decoy-точка текущего вопроса, если она
// совпадает с уже покрытой generic-плиткой) раньше получала ДВА
// наложенных полупрозрачных слоя (generic + свой собственный) - визуально
// заметно темнее прочих плиток с одним слоем, то есть сама подсветка
// выдавала правильный ответ. Дедупликация по ключу x_y гарантирует ровно
// один отрисованный прямоугольник на плитку независимо от того, сколько
// логических точек (generic/decoy/correct) на неё претендует.
function buildTiles(question: RusiqQuestion, genericDecoyPoints: RusiqPoint[]): BoardTile[] {
  const correctKey = tileKey(question);
  const map = new Map<string, BoardTile>();
  for (const p of genericDecoyPoints) {
    const key = tileKey(p);
    map.set(key, { key, x: p.x, y: p.y, width: p.width, height: p.height, isCorrect: key === correctKey });
  }
  for (const p of question.decoyPoints) {
    const key = tileKey(p);
    map.set(key, { key, x: p.x, y: p.y, width: p.width, height: p.height, isCorrect: key === correctKey });
  }
  map.set(correctKey, { key: correctKey, x: question.x, y: question.y, width: question.width, height: question.height, isCorrect: true });
  return Array.from(map.values());
}

const GameBoardScreen: React.FC<Props> = ({ imageUrl, imageWidth, imageHeight, playerNames, questionsByPlayer, genericDecoyPoints, onFinished }) => {
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [questionIndexByPlayer, setQuestionIndexByPlayer] = useState<number[]>(() => playerNames.map(() => 0));
  const [elapsed, setElapsed] = useState(0);
  const [answers, setAnswers] = useState<RusiqAnswerEvent[]>([]);
  const [hintShown, setHintShown] = useState(false);
  // Подсветка выбранной плитки зелёным/красным на FEEDBACK_DURATION_MS перед
  // переходом к следующему вопросу — по прямому запросу пользователя
  // (2026-09-12), чтобы игрок видел подтверждение своего клика, а не мгновенную
  // смену вопроса без обратной связи.
  const [feedback, setFeedback] = useState<{ key: string; correct: boolean } | null>(null);

  // Защита от повторного клика на один и тот же вопрос, пока не сработал
  // отложенный переход — единственная точка входа для "истёк таймер"/"клик
  // по плитке"/"сдался", см. commitAdvance().
  const hasAnsweredRef = useRef(false);
  const feedbackTimeoutRef = useRef<number | null>(null);

  const currentQuestion = questionsByPlayer[currentPlayer][questionIndexByPlayer[currentPlayer]];
  const tiles = orderTilesByPosition(buildTiles(currentQuestion, genericDecoyPoints));
  const tileLabels = neutralTileLabels(tiles);

  // Обнуляет таймер и заводит секундный тик на каждый новый вопрос
  // (смена currentPlayer или его индекса вопроса). Само истечение времени
  // обрабатывается ОТДЕЛЬНЫМ эффектом ниже, реагирующим на `elapsed` — так
  // он всегда видит свежие currentQuestion/currentPlayer из замыкания
  // текущего рендера, без риска устаревшего замыкания внутри setInterval.
  useEffect(() => {
    setElapsed(0);
    setHintShown(false);
    setFeedback(null);
    hasAnsweredRef.current = false;
    const interval = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [currentPlayer, questionIndexByPlayer[currentPlayer]]);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current !== null) window.clearTimeout(feedbackTimeoutRef.current);
    };
  }, []);

  // Истечение времени вопроса (находка 4 финального ревью): раньше ничего
  // не вызывало advance() при elapsed >= timeSeconds, из-за чего вопрос
  // можно было держать открытым бесконечно. Явная проверка hasAnsweredRef
  // здесь (а не только внутри commitAdvance) нужна потому, что клик по
  // плитке теперь взводит hasAnsweredRef СРАЗУ, но саму мутацию состояния
  // откладывает на FEEDBACK_DURATION_MS - без проверки здесь истечение
  // таймера в этом окне повторно вызвало бы commitAdvance поверх уже
  // запланированного отложенного вызова.
  useEffect(() => {
    if (elapsed >= currentQuestion.timeSeconds && !hasAnsweredRef.current) {
      hasAnsweredRef.current = true;
      commitAdvance({ playerIndex: currentPlayer, score: 0, correct: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed]);

  function commitAdvance(event: RusiqAnswerEvent) {
    const updatedAnswers = [...answers, event];
    setAnswers(updatedAnswers);

    const nextIndexForCurrent = questionIndexByPlayer[currentPlayer] + 1;
    const allDone = playerNames.every((_, p) => (p === currentPlayer ? nextIndexForCurrent : questionIndexByPlayer[p]) >= questionsByPlayer[p].length);

    if (allDone) {
      onFinished(updatedAnswers);
      return;
    }

    setQuestionIndexByPlayer((prev) => prev.map((idx, p) => (p === currentPlayer ? nextIndexForCurrent : idx)));
    setCurrentPlayer((prev) => nextTurn(prev, playerNames.length));
  }

  function handleTileClick(tile: BoardTile) {
    if (hasAnsweredRef.current) return;
    hasAnsweredRef.current = true;
    const correct = tile.isCorrect;
    const score = correct ? scoreForAnswer(currentQuestion.price, currentQuestion.timeSeconds, elapsed, true) : 0;
    setFeedback({ key: tile.key, correct });
    feedbackTimeoutRef.current = window.setTimeout(() => {
      setFeedback(null);
      commitAdvance({ playerIndex: currentPlayer, score, correct });
    }, FEEDBACK_DURATION_MS);
  }

  function handleGiveUp() {
    if (hasAnsweredRef.current) return;
    hasAnsweredRef.current = true;
    commitAdvance({ playerIndex: currentPlayer, score: 0, correct: false });
  }

  function handleShowHint() {
    setHintShown(true);
  }

  const remainingSeconds = Math.max(0, currentQuestion.timeSeconds - elapsed);
  const liveScore = scoreForAnswer(currentQuestion.price, currentQuestion.timeSeconds, elapsed, true);

  // Кликабельная область — прямоугольник со своими width/height у каждой
  // точки (то же пространство координат, что x/y), выражен в % от контейнера
  // (не в px): контейнер задан через aspect-ratio, поэтому % ширины/высоты
  // масштабируется ровно так же, как x/y в pointPosition ниже, при любом
  // фактическом размере показа. Раньше все точки были фиксированным 22px
  // КРУГОМ вне зависимости от точного пикселя клика — при высокой плотности
  // decoy-точек на одной видимой картинке-ответе (найдено живьём 2026-09-12)
  // это делало результат клика "куда-то в правильный ответ" непредсказуемым.
  // Первая попытка (просто увеличенный радиус круга) не решила суть: нужна
  // именно область, привязанная к силуэту/иконке конкретного ответа (обычно
  // прямоугольная плитка), а не абстрактный круг любого размера — обратная
  // связь пользователя после первой попытки.
  function pointStyle(point: { width: number; height: number }, activeFeedback: { correct: boolean } | null): React.CSSProperties {
    const background = activeFeedback ? (activeFeedback.correct ? FEEDBACK_CORRECT_COLOR : FEEDBACK_WRONG_COLOR) : POINT_COLOR;
    const border = activeFeedback ? `2px solid ${activeFeedback.correct ? '#3ecf7e' : '#ff6b6b'}` : POINT_RING;
    return {
      position: 'absolute',
      width: `${(point.width / imageWidth) * 100}%`,
      height: `${(point.height / imageHeight) * 100}%`,
      transform: 'translate(-50%, -50%)',
      borderRadius: 6,
      background,
      border,
      boxShadow: '0 0 6px rgba(0, 0, 0, 0.4)',
      padding: 0,
      cursor: hasAnsweredRef.current ? 'default' : 'pointer',
      transition: 'background 120ms ease, border-color 120ms ease',
    };
  }

  function pointPosition(point: RusiqPoint): React.CSSProperties {
    return {
      left: `${(point.x / imageWidth) * 100}%`,
      top: `${(point.y / imageHeight) * 100}%`,
    };
  }

  return (
    <div className="riq-page" style={{ padding: 0 }}>
      <div className="riq-scoreboard">
        <span className="riq-scoreboard-item">
          Вопрос <strong>{questionIndexByPlayer[currentPlayer] + 1}</strong>/{questionsByPlayer[currentPlayer].length}
        </span>
        <span className="riq-scoreboard-item">
          Ходит: <strong>{playerNames[currentPlayer]}</strong>
        </span>
        <span className={`riq-scoreboard-item ${remainingSeconds <= 5 ? 'riq-scoreboard-timer-urgent' : 'riq-scoreboard-timer'}`}>
          Таймер: <strong>{remainingSeconds}с</strong>
        </span>
        <span className="riq-scoreboard-item">
          Очки сейчас: <strong>{liveScore}</strong>
        </span>
        <button onClick={handleGiveUp} className="riq-btn riq-btn-danger riq-btn-small">
          Сдаюсь
        </button>
      </div>
      <p className="riq-question-text">{currentQuestion.text}</p>
      {/* FR-015 (Фаза 2b) - иллюстрирующая картинка к вопросу, отдельная от
          общего фона доски ниже. */}
      {currentQuestion.questionImage && (
        <img
          src={rusiqItemImageUrl(currentQuestion.questionImage)}
          alt=""
          style={{ display: 'block', maxWidth: 220, maxHeight: 160, margin: '10px auto 0', borderRadius: 8 }}
        />
      )}
      {currentQuestion.helpText.length > 0 && (
        <div className="riq-hint">
          {hintShown ? (
            <>
              <p className="riq-hint-text">Подсказка: {currentQuestion.helpText}</p>
              {currentQuestion.hintImage && (
                <img
                  src={rusiqItemImageUrl(currentQuestion.hintImage)}
                  alt=""
                  style={{ display: 'block', maxWidth: 220, maxHeight: 160, margin: '6px auto 0', borderRadius: 8 }}
                />
              )}
            </>
          ) : (
            <button onClick={handleShowHint} className="riq-btn riq-btn-ghost riq-btn-small">
              Показать подсказку
            </button>
          )}
        </div>
      )}
      <div
        style={{
          position: 'relative',
          width: DISPLAY_MAX_WIDTH_CSS,
          aspectRatio: `${imageWidth} / ${imageHeight}`,
          margin: '20px auto 0',
          borderRadius: 10,
          overflow: 'hidden',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
          border: '2px solid var(--riq-border)',
        }}
      >
        <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', display: 'block' }} />
        {/* Одна плитка на уникальную позицию (buildTiles дедуплицирует
            generic/decoy/correct по x_y) - клик однозначен через tile.isCorrect,
            а не по ссылке на объект, но внешне плитки неотличимы до клика
            (находка 6 финального ревью) и до клика получают ровно один слой
            подсветки каждая (найдено живьём 2026-09-12 - двойное наложение
            слоёв на плитке правильного ответа делало её темнее остальных). */}
        {tiles.map((tile) => {
          const activeFeedback = feedback && feedback.key === tile.key ? feedback : null;
          return (
            <button
              key={tile.key}
              onClick={() => handleTileClick(tile)}
              style={{ ...pointStyle(tile, activeFeedback), ...pointPosition(tile), zIndex: tile.isCorrect ? 1 : 0 }}
              aria-label={tileLabels.get(tile.key)}
              data-testid={tile.isCorrect ? 'correct-point' : `decoy-${tile.key}`}
            />
          );
        })}
      </div>
    </div>
  );
};

export default GameBoardScreen;
