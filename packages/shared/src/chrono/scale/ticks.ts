// packages/shared/src/chrono/scale/ticks.ts
// Генератор делений шкалы — подбирает шаг (единица + "красивый" множитель
// 1/2/5/10) так, чтобы в видимом диапазоне поместилось примерно нужное
// число делений, от секунд до миллиардов лет (строка 25 ТЗ — обязательное
// подписание при изменении масштаба).
//
// Работает через APPROX_YEARS_PER_UNIT (precision.ts) — единый прайс-лист
// "сколько лет в единице", не отдельная таблица шагов на каждую комбинацию
// вручную: перебор по единой лестнице + логарифмическое расстояние до
// идеального шага масштабируется на весь диапазон без явного перечисления
// секунда-минута-час-день-...-миллиард лет по отдельности.
//
// Это НЕ то же самое, что precision у ChronoMoment (precision.ts) — там
// "с какой точностью задан МОМЕНТ", здесь "какие линии сетки показывать
// при ТЕКУЩЕМ масштабе". Сознательно не переиспользует и не расширяет
// CALENDAR_PRECISIONS/EPOCH_PRECISIONS.

import { APPROX_YEARS_PER_UNIT, PRECISION_LADDER, type Precision } from '../precision';

const NICE_MULTIPLIERS = [1, 2, 5, 10] as const;

export interface TickStep {
  unit: Precision;
  multiplier: number;
  /** Шаг в приблизительных годах (той же оси, что toAxisYears) */
  stepYears: number;
}

export interface Tick extends TickStep {
  /** Позиция деления на оси, в приблизительных годах */
  axisYears: number;
}

/**
 * Подбирает единицу+множитель так, чтобы в диапазоне длиной visibleSpanYears
 * поместилось примерно targetTickCount делений. Расстояние до идеального
 * шага — логарифмическое (симметрично штрафует и слишком мелкий, и слишком
 * крупный шаг относительно идеала).
 */
export function chooseTickStep(visibleSpanYears: number, targetTickCount = 8): TickStep {
  if (!(visibleSpanYears > 0) || !Number.isFinite(visibleSpanYears)) {
    throw new RangeError(`chooseTickStep: visibleSpanYears must be a positive finite number, got ${visibleSpanYears}`);
  }
  if (!(targetTickCount > 0)) {
    throw new RangeError(`chooseTickStep: targetTickCount must be positive, got ${targetTickCount}`);
  }

  const idealStepYears = visibleSpanYears / targetTickCount;

  let best: TickStep | null = null;
  let bestDistance = Infinity;

  for (const unit of PRECISION_LADDER) {
    const unitYears = APPROX_YEARS_PER_UNIT[unit];
    for (const multiplier of NICE_MULTIPLIERS) {
      const stepYears = unitYears * multiplier;
      const distance = Math.abs(Math.log(stepYears / idealStepYears));
      // При точном совпадении по расстоянию ("год ×10" и "десятилетие ×1" —
      // одна и та же величина шага) предпочитаем меньший множитель: "каждое
      // десятилетие" естественнее как понятие и как подпись, чем "каждый
      // год, но показываем только каждый 10-й". Строгое "<" для основного
      // случая, отдельная проверка на равенство — только для этого тай-брейка.
      const isBetter = distance < bestDistance || (distance === bestDistance && best !== null && multiplier < best.multiplier);
      if (isBetter) {
        bestDistance = distance;
        best = { unit, multiplier, stepYears };
      }
    }
  }

  // Недостижимо на практике (PRECISION_LADDER непустая), но не молчать,
  // если это вдруг перестанет быть так.
  if (!best) {
    throw new Error('chooseTickStep: no candidate step found');
  }
  return best;
}

/**
 * Позиции делений (в приблизительных годах) в видимом диапазоне
 * [startAxisYears, endAxisYears] при выбранном автоматически шаге.
 */
export function generateTicks(startAxisYears: number, endAxisYears: number, targetTickCount = 8): Tick[] {
  if (!(endAxisYears > startAxisYears)) {
    throw new RangeError('generateTicks: endAxisYears must be greater than startAxisYears');
  }

  const step = chooseTickStep(endAxisYears - startAxisYears, targetTickCount);
  const epsilon = step.stepYears * 1e-9; // защита от пропуска/лишнего деления на границе из-за погрешности double

  const firstTick = Math.floor(startAxisYears / step.stepYears) * step.stepYears;
  const ticks: Tick[] = [];

  for (let value = firstTick; value <= endAxisYears + epsilon; value += step.stepYears) {
    if (value >= startAxisYears - epsilon) {
      ticks.push({ ...step, axisYears: value });
    }
  }

  return ticks;
}
