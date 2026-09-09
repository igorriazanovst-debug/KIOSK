// Разовый скрипт: точечно проставляет audioTaskTextId для 18 пилотных
// заданий Этапа 1 после generate_pilot_audio.ps1 — не через
// PowerShell ConvertTo-Json (переформатировал бы весь 309-задачный
// файл), а безопасным JSON.parse/stringify с тем же стилем отступов,
// что и все runGenerateWaveN.ts скрипты.

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PILOT_TASK_IDS = [
  'add1_intro', 'add1_1', 'add1_2', 'add1_3', 'add1_4',
  'add2_intro', 'add2_1', 'add2_2', 'add2_3',
  'count1_intro', 'count1_1', 'count1_2', 'count1_3', 'count1_4',
  'count2_intro', 'count2_1', 'count2_2', 'count2_3',
];

const contentPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'pilotContent.json');
// public/media, не src/mathmachine/media — см. generate_pilot_audio.ps1.
const mediaDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'public', 'media');

const content = JSON.parse(fs.readFileSync(contentPath, 'utf-8'));
let filled = 0;
for (const taskId of PILOT_TASK_IDS) {
  const task = content.tasks[taskId];
  if (!task) {
    console.log(`SKIP (task not found): ${taskId}`);
    continue;
  }
  const mp3Path = path.join(mediaDir, `${taskId}.mp3`);
  if (!fs.existsSync(mp3Path)) {
    console.log(`SKIP (mp3 not found): ${taskId}`);
    continue;
  }
  task.audioTaskTextId = taskId;
  filled++;
}

fs.writeFileSync(contentPath, JSON.stringify(content, null, 2) + '\n', 'utf-8');
console.log(`Filled audioTaskTextId for ${filled} tasks.`);
