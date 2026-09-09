// Разовый CLI-скрипт: применяет offline-генератор Этапа 2b, волна 11
// (укрупнённая), к pilotContent.json. Не часть рантайма плеера. Запуск
// (из любой директории):
// node --experimental-strip-types packages/player/src/mathmachine/content/runGenerateWave11.ts

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { MathMachineContent } from '@kiosk/shared';
import { mergeIntoContent, countWave11Tasks } from './generateWave11Content.ts';

const contentPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'pilotContent.json');
const content = JSON.parse(fs.readFileSync(contentPath, 'utf-8')) as MathMachineContent;
const merged = mergeIntoContent(content);
fs.writeFileSync(contentPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
console.log(`Wave 11: added ${countWave11Tasks()} tasks across 13 topics to ${contentPath}`);
