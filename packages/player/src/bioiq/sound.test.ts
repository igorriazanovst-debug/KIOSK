// packages/player/src/bioiq/sound.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playCorrectTone, playWrongTone } from './sound.ts';

class FakeGain {
  gain = { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} };
  connect() {}
}

class FakeOscillator {
  type = '';
  frequency = { value: 0 };
  started = false;
  stopped = false;
  connect() {}
  start() {
    this.started = true;
  }
  stop() {
    this.stopped = true;
  }
}

function fakeAudioContextClass(oscillators: FakeOscillator[]) {
  return class {
    currentTime = 0;
    createGain() {
      return new FakeGain();
    }
    createOscillator() {
      const osc = new FakeOscillator();
      oscillators.push(osc);
      return osc;
    }
  };
}

test('playCorrectTone does nothing when window is unavailable (non-browser context)', () => {
  const original = (globalThis as any).window;
  delete (globalThis as any).window;
  try {
    assert.doesNotThrow(() => playCorrectTone());
  } finally {
    (globalThis as any).window = original;
  }
});

test('playCorrectTone does nothing when AudioContext is unsupported', () => {
  const original = (globalThis as any).window;
  (globalThis as any).window = {};
  try {
    assert.doesNotThrow(() => playCorrectTone());
  } finally {
    (globalThis as any).window = original;
  }
});

test('playCorrectTone starts an ascending sequence of oscillators when AudioContext is available', () => {
  const original = (globalThis as any).window;
  const oscillators: FakeOscillator[] = [];
  (globalThis as any).window = { AudioContext: fakeAudioContextClass(oscillators) };
  try {
    playCorrectTone();
    assert.ok(oscillators.length >= 2, 'expected at least two notes for a recognizable chime');
    assert.ok(oscillators.every((o) => o.started), 'every oscillator must be started, not just created');
    const frequencies = oscillators.map((o) => o.frequency.value);
    const isAscending = frequencies.every((f, i) => i === 0 || f > frequencies[i - 1]);
    assert.equal(isAscending, true, 'correct-answer chime should rise in pitch');
  } finally {
    (globalThis as any).window = original;
  }
});

test('playWrongTone starts a descending sequence of oscillators, distinct from the correct chime', () => {
  const original = (globalThis as any).window;
  const oscillators: FakeOscillator[] = [];
  (globalThis as any).window = { AudioContext: fakeAudioContextClass(oscillators) };
  try {
    playWrongTone();
    assert.ok(oscillators.length >= 2);
    const frequencies = oscillators.map((o) => o.frequency.value);
    const isDescending = frequencies.every((f, i) => i === 0 || f < frequencies[i - 1]);
    assert.equal(isDescending, true, 'wrong-answer buzz should fall in pitch, opposite of the correct chime');
  } finally {
    (globalThis as any).window = original;
  }
});
