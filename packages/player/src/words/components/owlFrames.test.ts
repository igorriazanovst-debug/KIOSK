// packages/player/src/words/components/owlFrames.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  owlFrame,
  isAnimated,
  BLINK_PERIOD_MS,
  BLINK_DURATION_MS,
  SPEECH_FRAME_MS,
} from './owlFrames.ts';

test('в покое сова почти всё время смотрит открытыми глазами', () => {
  assert.equal(owlFrame('idle', 0), 'idle');
  assert.equal(owlFrame('idle', 1000), 'idle');
  assert.equal(owlFrame('idle', BLINK_PERIOD_MS - BLINK_DURATION_MS - 1), 'idle');
});

test('моргание случается в конце периода и коротко', () => {
  assert.equal(owlFrame('idle', BLINK_PERIOD_MS - BLINK_DURATION_MS), 'blink');
  assert.equal(owlFrame('idle', BLINK_PERIOD_MS - 1), 'blink');
  // следующий период начинается снова с открытых глаз
  assert.equal(owlFrame('idle', BLINK_PERIOD_MS), 'idle');
});

test('моргание повторяется в каждом периоде', () => {
  for (const n of [1, 2, 5, 17]) {
    const t = n * BLINK_PERIOD_MS - 10;
    assert.equal(owlFrame('idle', t), 'blink', `период ${n}`);
  }
});

test('доля времени с закрытыми глазами мала — сова не выглядит спящей', () => {
  let closed = 0;
  const step = 20;
  const span = BLINK_PERIOD_MS * 3;
  for (let t = 0; t < span; t += step) {
    if (owlFrame('idle', t) === 'blink') closed += 1;
  }
  const share = closed / (span / step);
  assert.ok(share < 0.08, `закрыты ${(share * 100).toFixed(1)}% времени`);
});

test('речь чередует открытый и закрытый клюв', () => {
  assert.equal(owlFrame('speaking', 0), 'speaking');
  assert.equal(owlFrame('speaking', SPEECH_FRAME_MS), 'idle');
  assert.equal(owlFrame('speaking', SPEECH_FRAME_MS * 2), 'speaking');
  assert.equal(owlFrame('speaking', SPEECH_FRAME_MS * 3), 'idle');
});

test('за секунду речи клюв успевает шевельнуться несколько раз', () => {
  const seen = new Set<string>();
  let switches = 0;
  let prev = owlFrame('speaking', 0);
  for (let t = 0; t <= 1000; t += 10) {
    const f = owlFrame('speaking', t);
    seen.add(f);
    if (f !== prev) switches += 1;
    prev = f;
  }
  assert.deepEqual([...seen].sort(), ['idle', 'speaking']);
  assert.ok(switches >= 4, `смен кадра за секунду: ${switches}`);
});

test('указание и радость — устойчивые жесты, кадр не скачет', () => {
  for (const t of [0, 100, 5000, 60_000]) {
    assert.equal(owlFrame('pointing', t), 'pointing');
    assert.equal(owlFrame('happy', t), 'happy');
  }
});

test('отрицательное время не ломает выбор кадра', () => {
  assert.equal(owlFrame('idle', -500), 'idle');
  assert.equal(owlFrame('speaking', -1), 'speaking');
});

test('перерисовка по кадрам нужна только там, где есть движение', () => {
  assert.equal(isAnimated('idle'), true);
  assert.equal(isAnimated('speaking'), true);
  assert.equal(isAnimated('pointing'), false);
  assert.equal(isAnimated('happy'), false);
});

test('каждый возвращаемый кадр соответствует поставляемому файлу', () => {
  const files = new Set(['idle', 'blink', 'speaking', 'pointing', 'happy']);
  const moods = ['idle', 'speaking', 'pointing', 'happy'] as const;
  for (const mood of moods) {
    for (let t = 0; t < BLINK_PERIOD_MS * 2; t += 37) {
      assert.ok(files.has(owlFrame(mood, t)), `неизвестный кадр для ${mood}`);
    }
  }
});
