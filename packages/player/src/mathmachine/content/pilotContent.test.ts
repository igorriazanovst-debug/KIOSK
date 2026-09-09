import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MathMachineContentSchema } from '@kiosk/shared';
import { listTopicsByCategory } from '../topicCategories.ts';
import pilotContent from './pilotContent.json' with { type: 'json' };

// public/media, не src/mathmachine/media — vite копирует public/* в dist/*
// без изменений при сборке; см. generate_pilot_audio.ps1.
const MEDIA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'public', 'media');

test('pilotContent.json validates against MathMachineContentSchema', () => {
  const result = MathMachineContentSchema.safeParse(pilotContent);
  assert.equal(result.success, true, result.success ? '' : JSON.stringify((result as any).error?.issues, null, 2));
});

test('pilotContent has exactly one hundred thirty-two topics (124 from Этап 1 + waves 1-12 + 8 from Этап 3 FR022 Group 1) with at least one group each', () => {
  const parsed = MathMachineContentSchema.parse(pilotContent);
  const topicIds = Object.keys(parsed.topics);
  assert.equal(topicIds.length, 132);
  for (const id of topicIds) {
    assert.ok(parsed.topics[id].groupIds.length >= 1);
  }
});

test('pilotContent has exactly 2904 tasks (2835 from Этап 1 + waves 1-12 + 69 from Этап 3 FR022 Group 1) — crosses the ТЗ FR-020 target of 2800+', () => {
  const parsed = MathMachineContentSchema.parse(pilotContent);
  assert.equal(Object.keys(parsed.tasks).length, 2904);
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
  assert.equal(checked, 2904, 'ТЗ FR-013 требует озвучку текста задания без оговорки объёма — все задания каталога должны иметь audioTaskTextId, включая Этап 3 (FR022 Group 1)');
});

test('every real topic categorizes into exactly one catalog-screen category (no orphans)', () => {
  const parsed = MathMachineContentSchema.parse(pilotContent);
  const categorized = listTopicsByCategory(parsed).flatMap((g) => g.topics.map((t) => t.topicId));
  const allTopicIds = Object.keys(parsed.topics);
  assert.equal(categorized.length, allTopicIds.length, 'a topic id matched no category (or matched more than one) — add/fix a TOPIC_CATEGORIES prefix in topicCategories.ts');
  assert.deepEqual([...categorized].sort(), [...allTopicIds].sort());
});
