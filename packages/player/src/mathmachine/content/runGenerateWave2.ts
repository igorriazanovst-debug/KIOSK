// Разовый CLI-скрипт: применяет offline-генератор Этапа 2b, волна 2, к
// pilotContent.json. Не часть рантайма плеера. Запуск (из любой директории):
// node --experimental-strip-types packages/player/src/mathmachine/content/runGenerateWave2.ts

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { MathMachineContent } from '@kiosk/shared';
import { mergeIntoContent, countWave2Tasks } from './generateWave2Content.ts';

const contentPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'pilotContent.json');
const content = JSON.parse(fs.readFileSync(contentPath, 'utf-8')) as MathMachineContent;
const merged = mergeIntoContent(content);
fs.writeFileSync(contentPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
console.log(`Wave 2: added ${countWave2Tasks()} tasks across 5 topics to ${contentPath}`);
