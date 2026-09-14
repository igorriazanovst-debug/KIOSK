// packages/inophone-library/tools/generate-illustrations.mjs
// Пакетная генерация иллюстраций понятий через SYNTX.
//
// Каждая картинка — В СВОЁМ ЧАТЕ: перед запросом скрипт уходит на чистый адрес
// модели. Продолжение в одном чате картинок не порождает вовсе (проверено на
// Типе 2 дважды), а согласованность здесь нужна по СТИЛЮ, а не по персонажу, и
// её держит общая часть промпта.
//
// ПРОГОН РЕЗЮМИРУЕМЫЙ: готовый файл пропускается. 396 генераций примерно по
// полминуты — это часа три, и рассчитывать надо на обрыв, а не на удачу.
//
// ЕДИНСТВЕННАЯ ПОЛОМКА, КОТОРАЯ ЗДЕСЬ СЛУЧАЕТСЯ, — зависшая страница. SYNTX
// подменяет кнопку отправки индикатором, пока генерирует, и иногда из этого
// состояния не выходит. На первом прогоне «Инофона» это остановило работу на
// 253-й картинке из 396: оставшиеся 138 просто посыпались одна за другой.
// Лечится перезагрузкой вкладки, поэтому неудача означает не «пропустить», а
// «перезагрузить и повторить».
//
// РАССИНХРОН ЛОВИТСЯ ЗАРАНЕЕ. Если у понятия нет описания, прогон не
// начинается вовсе — иначе это выяснилось бы на трёхсотой картинке.
//
// Запуск: node tools/generate-illustrations.mjs <порт CDP> <каталог результатов> [сколько]
//
// Требует открытого окна Chrome с отладочным портом, где выполнен вход в
// SYNTX. Chrome с версии 136 запрещает отладочный порт на профиле по
// умолчанию — нужен отдельный профиль.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { PROMPTS } from './illustration-prompts.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const SCRATCH = path.resolve(ROOT, '../../..');

const port = Number(process.argv[2]);
const outDir = path.resolve(process.argv[3]);
const limit = process.argv[4] ? Number(process.argv[4]) : Infinity;
fs.mkdirSync(outDir, { recursive: true });

// Общая часть промпта держит единый стиль всего набора. Она же требует
// пурпурного фона: по нему вырезается прозрачность (см. make-illustrations.mjs)
const STYLE =
  'Плоская векторная иллюстрация для детского обучающего приложения, ' +
  'в стиле детской книжки: толстые чистые контуры, простые формы, ' +
  'ограниченная тёплая палитра, равномерное освещение, без теней и бликов. ' +
  'Предмет показан ЦЕЛИКОМ, строго по центру кадра, крупно, не обрезан краями. ' +
  'Фон — сплошной однородный пурпурный #FF00FF, без градиентов и узоров. ' +
  'Без текста, без надписей, без рамок, без подписей. ';

const library = JSON.parse(fs.readFileSync(path.join(ROOT, 'index.json'), 'utf8'));
const ids = library.concepts.map((c) => c.id);

const missing = ids.filter((id) => !PROMPTS[id]);
if (missing.length > 0) {
  console.error(`Нет описания у ${missing.length} понятий: ${missing.slice(0, 20).join(', ')}`);
  process.exit(1);
}

const todo = ids.filter((id) => !fs.existsSync(path.join(outDir, `${id}.jpg`)));
console.log(`понятий ${ids.length}, уже нарисовано ${ids.length - todo.length}, осталось ${todo.length}`);

const gen = path.join(SCRATCH, 'syntx-gen.mjs');
if (!fs.existsSync(gen)) {
  console.error(`Нет отправщика промптов: ${gen}`);
  process.exit(1);
}
const reload = path.join(SCRATCH, 'syntx-reload.mjs');

/** Одна попытка. true — файл получился и он не пустой */
function attempt(id) {
  const out = path.join(outDir, `${id}.jpg`);
  const prompt = `${STYLE}Нарисуй: ${PROMPTS[id]}`;
  try {
    execFileSync(process.execPath, [gen, String(port), prompt, out], {
      stdio: 'pipe',
      // Полторы минуты, а не восемь. Мёртвая попытка всё равно кончится
      // перезагрузкой вкладки, и восемь минут ожидания перед ней — это
      // ровно восемь минут впустую. На прогоне из 396 картинок шесть таких
      // зависаний растянули работу вдвое
      timeout: 90 * 1000,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
    });
  } catch {
    return false;
  }
  // Пустой или крошечный файл — не картинка. Без этой проверки в пакет уедет
  // битый файл, и увидит его педагог, а не сборщик
  if (!fs.existsSync(out) || fs.statSync(out).size < 10000) {
    if (fs.existsSync(out)) fs.unlinkSync(out);
    return false;
  }
  return true;
}

function reloadTab() {
  if (!fs.existsSync(reload)) return false;
  try {
    execFileSync(process.execPath, [reload], {
      cwd: SCRATCH,
      stdio: 'pipe',
      timeout: 3 * 60 * 1000,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
    });
    return true;
  } catch {
    return false;
  }
}

let made = 0;
let revived = 0;
const failed = [];

for (const id of todo) {
  if (made >= limit) break;

  let ok = attempt(id);
  if (!ok) {
    // Повтор БЕЗ перезагрузки бессмыслен: он упрётся в ту же зависшую
    // страницу и потратит ещё восемь минут ожидания
    if (reloadTab()) revived += 1;
    ok = attempt(id);
  }

  if (!ok) {
    failed.push(id);
    continue;
  }
  made += 1;
  console.log(`${made}/${Math.min(limit, todo.length)}  ${id}`);
}

console.log(`нарисовано за прогон: ${made}, не вышло: ${failed.length}, перезагрузок страницы: ${revived}`);
if (failed.length > 0) console.log('не вышло: ' + failed.join(', '));
