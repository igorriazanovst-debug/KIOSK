// Разовый CLI-скрипт: применяет offline-генератор Этапа 2b, волна 7
// (укрупнённая), к pilotContent.json. Не часть рантайма плеера. Запуск
// (из любой директории):
// node --experimental-strip-types packages/player/src/mathmachine/content/runGenerateWave7.ts

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { MathMachineContent } from '@kiosk/shared';
import { mergeIntoContent, countWave7Tasks } from './generateWave7Content.ts';

const contentPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'pilotContent.json');
const content = JSON.parse(fs.readFileSync(contentPath, 'utf-8')) as MathMachineContent;
const merged = mergeIntoContent(content);
fs.writeFileSync(contentPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
console.log(`Wave 7: added ${countWave7Tasks()} tasks across 13 topics to ${contentPath}`);
