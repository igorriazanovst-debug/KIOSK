import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AudioBus } from './AudioBus.ts';
import type { SoundPlayer } from './AudioBus.ts';

/** Проигрыватель-двойник: запоминает, что играло, и даёт управлять окончанием */
function fakePlayer() {
  const played: string[] = [];
  let volume = 0;
  let stops = 0;
  const pending: Array<() => void> = [];
  const player: SoundPlayer = {
    play(url) {
      played.push(url);
      return new Promise<void>((resolve) => pending.push(resolve));
    },
    stop() {
      stops += 1;
    },
    setVolume(v) {
      volume = v;
    },
  };
  return {
    player,
    played,
    get volume() { return volume; },
    get stops() { return stops; },
    finishOne() { const r = pending.shift(); if (r) r(); },
    async finishAll() {
      while (pending.length) { pending.shift()!(); await Promise.resolve(); }
    },
  };
}

test('реплики играют последовательно, а не наслаиваются', async () => {
  const fake = fakePlayer();
  const bus = new AudioBus(fake.player);
  bus.startRound('r1');

  bus.say(['a.mp3', 'b.mp3'], 'r1');
  await Promise.resolve();
  assert.deepEqual(fake.played, ['a.mp3'], 'вторая реплика ждёт окончания первой');

  fake.finishOne();
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(fake.played, ['a.mp3', 'b.mp3']);
});

test('запоздалая реплика прошлой партии не звучит в новой', async () => {
  // Ребёнок вышел из темы не дослушав — реплика прошлой партии не должна
  // догнать следующую и произнести чужое слово
  const fake = fakePlayer();
  const bus = new AudioBus(fake.player);
  bus.startRound('round-1');

  const first = bus.say(['слово-из-первой-партии.mp3'], 'round-1');
  await Promise.resolve();
  assert.deepEqual(fake.played, ['слово-из-первой-партии.mp3']);

  bus.startRound('round-2');
  fake.finishOne();
  await first;

  // Реплика, поставленная в очередь ДО смены раунда, но не начатая, отброшена
  const stale = bus.say(['ещё-одна-из-первой.mp3'], 'round-1');
  await stale;
  assert.deepEqual(fake.played, ['слово-из-первой-партии.mp3'], 'вторая не заиграла');
});

test('цепочка обрывается на середине, если раунд сменился', async () => {
  const fake = fakePlayer();
  const bus = new AudioBus(fake.player);
  bus.startRound('r1');

  const task = bus.say(['1.mp3', '2.mp3', '3.mp3'], 'r1');
  await Promise.resolve();
  fake.finishOne();
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(fake.played, ['1.mp3', '2.mp3']);

  bus.startRound('r2');
  fake.finishOne();
  await task;
  assert.deepEqual(fake.played, ['1.mp3', '2.mp3'], 'третья уже не заиграла');
});

test('битый или отсутствующий файл не роняет очередь', async () => {
  // Пакет контента может быть вообще без озвучки — звук производится отдельно
  const played: string[] = [];
  const player: SoundPlayer = {
    play(url) {
      played.push(url);
      return url === 'сломан.mp3' ? Promise.reject(new Error('404')) : Promise.resolve();
    },
    stop() {},
    setVolume() {},
  };
  const bus = new AudioBus(player);
  bus.startRound('r1');

  await bus.say(['сломан.mp3', 'целый.mp3'], 'r1');
  assert.deepEqual(played, ['сломан.mp3', 'целый.mp3'], 'после ошибки очередь продолжилась');
});

test('новая партия останавливает то, что играет прямо сейчас', async () => {
  const fake = fakePlayer();
  const bus = new AudioBus(fake.player);
  bus.startRound('r1');
  assert.equal(fake.stops, 1);
  bus.startRound('r2');
  assert.equal(fake.stops, 2);
});

test('громкость 0..100 переводится в 0..1 и зажимается по краям', () => {
  const fake = fakePlayer();
  const bus = new AudioBus(fake.player);
  bus.setVolume(50);
  assert.equal(fake.volume, 0.5);
  assert.equal(bus.volume, 50);

  bus.setVolume(300);
  assert.equal(fake.volume, 1);
  bus.setVolume(-20);
  assert.equal(fake.volume, 0);
});

test('после stop() ничего не играет, пока не начат новый раунд', async () => {
  const fake = fakePlayer();
  const bus = new AudioBus(fake.player);
  bus.startRound('r1');
  bus.stop();
  await bus.say(['a.mp3'], 'r1');
  assert.deepEqual(fake.played, []);
});
