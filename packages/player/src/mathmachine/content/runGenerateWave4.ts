// Разовый CLI-скрипт: применяет offline-генератор Этапа 2b, волна 4, к
// pilotContent.json. Не часть рантайма плеера. Запуск (из любой директории):
// node --experimental-strip-types packages/player/src/mathmachine/content/runGenerateWave4.ts

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { MathMachineContent } from '@kiosk/shared';
import { mergeIntoContent, countWave4Tasks } from './generateWave4Content.ts';

const contentPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'pilotContent.json');
const content = JSON.parse(fs.readFileSync(contentPath, 'utf-8')) as MathMachineContent;
const merged = mergeIntoContent(content);
fs.writeFileSync(contentPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
console.log(`Wave 4: added ${countWave4Tasks()} tasks across 6 topics to ${contentPath}`);
