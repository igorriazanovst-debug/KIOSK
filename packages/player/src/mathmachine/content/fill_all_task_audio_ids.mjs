// Разовый скрипт: проставляет audioTaskTextId = task.id для КАЖДОГО
// задания каталога, у которого реально существует сгенерированный mp3
// (см. generate_all_task_audio.ps1) — не безусловно всем, на случай если
// генерация части заданий не удалась (см. audio_generation_failures.log).
// Расширяет fill_pilot_audio_ids.mjs (тот проставлял только 18 пилотных)
// на весь каталог. JSON.parse/stringify с тем же стилем отступов, что и
// все runGenerateWaveN.ts скрипты — не PowerShell ConvertTo-Json (тот
// переформатировал бы весь файл).

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const contentPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'pilotContent.json');
const mediaDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'public', 'media');

const content = JSON.parse(fs.readFileSync(contentPath, 'utf-8'));
let filled = 0;
let missing = 0;
for (const task of Object.values(content.tasks)) {
  const mp3Path = path.join(mediaDir, `${task.id}.mp3`);
  if (!fs.existsSync(mp3Path)) {
    console.log(`SKIP (mp3 not found): ${task.id}`);
    missing++;
    continue;
  }
  task.audioTaskTextId = task.id;
  filled++;
}

fs.writeFileSync(contentPath, JSON.stringify(content, null, 2) + '\n', 'utf-8');
console.log(`Filled audioTaskTextId for ${filled} tasks. Missing mp3 for ${missing} tasks.`);
