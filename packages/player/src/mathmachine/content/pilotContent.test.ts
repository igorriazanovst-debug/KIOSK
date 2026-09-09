import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MathMachineContentSchema } from '@kiosk/shared';
import pilotContent from './pilotContent.json' with { type: 'json' };

// public/media, не src/mathmachine/media — vite копирует public/* в dist/*
// без изменений при сборке; см. generate_pilot_audio.ps1.
const MEDIA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'public', 'media');

test('pilotContent.json validates against MathMachineContentSchema', () => {
  const result = MathMachineContentSchema.safeParse(pilotContent);
  assert.equal(result.success, true, result.success ? '' : JSON.stringify((result as any).error?.issues, null, 2));
});

test('pilotContent has exactly one hundred twenty-four topics (2 from Этап 1 + 5 from wave 1 + 5 from wave 2 + 13 from wave 3 + 6 from wave 4 + 6 from wave 5 + 6 from wave 6 + 13 from wave 7 + 14 from wave 8 + 14 from wave 9 + 14 from wave 10 + 13 from wave 11 + 13 from wave 12) with at least one group each', () => {
  const parsed = MathMachineContentSchema.parse(pilotContent);
  const topicIds = Object.keys(parsed.topics);
  assert.equal(topicIds.length, 124);
  for (const id of topicIds) {
    assert.ok(parsed.topics[id].groupIds.length >= 1);
  }
});

test('pilotContent has exactly 2835 tasks (18 from Этап 1 + 80 from wave 1 + 76 from wave 2 + 135 from wave 3 + 92 from wave 4 + 100 from wave 5 + 104 from wave 6 + 348 from wave 7 + 368 from wave 8 + 388 from wave 9 + 378 from wave 10 + 374 from wave 11 + 374 from wave 12) — crosses the ТЗ FR-020 target of 2800+', () => {
  const parsed = MathMachineContentSchema.parse(pilotContent);
  assert.equal(Object.keys(parsed.tasks).length, 2835);
});

test('every task referenced by a group actually exists in tasks', () => {
  const parsed = MathMachineContentSchema.parse(pilotContent);
  for (const group of Object.values(parsed.groups)) {
    for (const taskId of group.taskIds) {
      assert.ok(parsed.tasks[taskId], `missing task ${taskId} referenced by group ${group.id}`);
    }
  }
});

test('every task with an audioTaskTextId has a corresponding mp3 file on disk', () => {
  const parsed = MathMachineContentSchema.parse(pilotContent);
  let checked = 0;
  for (const task of Object.values(parsed.tasks)) {
    if (!task.audioTaskTextId) continue;
    checked += 1;
    const mp3Path = path.join(MEDIA_DIR, `${task.audioTaskTextId}.mp3`);
    assert.ok(fs.existsSync(mp3Path), `missing audio file for task ${task.id}: ${mp3Path}`);
  }
  assert.equal(checked, 18, 'expected exactly 18 pilot tasks (Этап 1) to have narration audio');
});
