// Разовый CLI-скрипт: применяет offline-генератор Этапа 3, Группа 1
// покрытия FR-022 ТЗ, к pilotContent.json. Не часть рантайма плеера.
// Запуск (из любой директории):
// node --experimental-strip-types packages/player/src/mathmachine/content/runGenerateFR022Group1.ts

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { MathMachineContent } from '@kiosk/shared';
import { mergeIntoContent, countFR022Group1Tasks } from './generateFR022Group1Content.ts';

const contentPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'pilotContent.json');
const content = JSON.parse(fs.readFileSync(contentPath, 'utf-8')) as MathMachineContent;
const merged = mergeIntoContent(content);
fs.writeFileSync(contentPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
console.log(`FR022 Group 1: added ${countFR022Group1Tasks()} tasks across 8 topics to ${contentPath}`);
