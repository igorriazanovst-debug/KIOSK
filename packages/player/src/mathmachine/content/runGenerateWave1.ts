// Разовый CLI-скрипт: применяет offline-генератор Этапа 2b, волна 1, к
// pilotContent.json. Не часть рантайма плеера, не импортируется приложением.
// Запуск: node --experimental-strip-types packages/player/src/mathmachine/content/runGenerateWave1.ts
// (путь к pilotContent.json резолвится от расположения этого файла, а не
// от текущей директории — можно запускать из любого места).

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { MathMachineContent } from '@kiosk/shared';
import { mergeIntoContent, countWave1Tasks } from './generateWave1Content.ts';

const contentPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'pilotContent.json');
const content = JSON.parse(fs.readFileSync(contentPath, 'utf-8')) as MathMachineContent;
const merged = mergeIntoContent(content);
fs.writeFileSync(contentPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
console.log(`Wave 1: added ${countWave1Tasks()} tasks across 5 topics to ${contentPath}`);
