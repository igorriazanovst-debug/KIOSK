// Разовый CLI-скрипт: применяет offline-генератор Этапа 4, Класс А
// покрытия FR-022 ТЗ, к pilotContent.json. Не часть рантайма плеера.
// Запуск (из любой директории):
// node --experimental-strip-types packages/player/src/mathmachine/content/runGenerateFR022Group2.ts

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { MathMachineContent } from '@kiosk/shared';
import { mergeIntoContent, countFR022Group2Tasks } from './generateFR022Group2Content.ts';

const contentPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'pilotContent.json');
const content = JSON.parse(fs.readFileSync(contentPath, 'utf-8')) as MathMachineContent;
const merged = mergeIntoContent(content);
fs.writeFileSync(contentPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
console.log(`FR022 Group 2: added ${countFR022Group2Tasks()} tasks across 13 topics to ${contentPath}`);
