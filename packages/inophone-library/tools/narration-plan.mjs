// packages/inophone-library/tools/narration-plan.mjs
// План озвучки: что и на каком языке надо произнести.
//
// План строится ИЗ СОБРАННОГО ПАКЕТА, а не из каталога напрямую: озвучивать
// надо ровно то, что доехало до index.json. Список, составленный по другому
// источнику, разъезжается с пакетом при первой же правке каталога, и
// обнаруживается это тишиной на занятии.
//
// ДВА РАЗНЫХ СИНТЕЗАТОРА, и это не выбор из удобства:
//   ru, en — Windows SAPI (Irina, Zira). Голоса живые, ими озвучены Типы 2 и 3,
//            и «Инофон» не имеет права звучать хуже соседних пособий.
//   fr, de, zh, ba — eSpeak NG. Других голосов на машине нет: WinRT знает
//            только русский, SAPI — русский и английский. Решение пользователя
//            от 14.09.2026: ставим eSpeak и закрываем шесть языков полностью,
//            вместо того чтобы отдать пакет с четырьмя немыми языками.
//
// Запуск: node tools/narration-plan.mjs [--only ru,en]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ASSETS = path.join(ROOT, 'assets');

const sharedPath = path.resolve(ROOT, '../shared/dist/index.js');
const { inophone } = createRequire(import.meta.url)(sharedPath);

/** Какой синтезатор озвучивает язык */
export const ENGINE = {
  ru: 'sapi',
  en: 'sapi',
  fr: 'espeak',
  de: 'espeak',
  zh: 'espeak',
  ba: 'espeak',
};

/** Голоса SAPI — по имени, а не по «первому попавшемуся для культуры» */
export const SAPI_VOICE = {
  ru: 'Microsoft Irina Desktop',
  en: 'Microsoft Zira Desktop',
};

/**
 * Скорость eSpeak. Медленнее обычного НАМЕРЕННО: голос синтетический, и на
 * скорости по умолчанию слово из трёх слогов сливается в одно пятно. Пособие
 * существует ради того, чтобы слово можно было расслышать и повторить.
 */
export const ESPEAK_SPEED = 130;

export function buildPlan(only = null) {
  const library = inophone.parseInophoneLibrary(
    JSON.parse(fs.readFileSync(path.join(ROOT, 'index.json'), 'utf8'))
  );
  const codes = only ?? inophone.LANGUAGE_CODES;
  const items = [];
  for (const concept of library.concepts) {
    for (const code of codes) {
      const t = concept.translations[code];
      if (!t) continue;
      items.push({
        id: concept.id,
        code,
        text: t.text,
        engine: ENGINE[code],
        out: path.join(ASSETS, inophone.conceptAudioPath(concept.id, code)),
      });
    }
  }
  return items;
}

// Сравнение через pathToFileURL, а не сборкой строки руками: на Windows путь
// начинается с буквы диска, и `file://C:/...` не совпадает с `file:///C:/...` —
// скрипт молча ничего не делал
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = process.argv.indexOf('--only');
  const only = arg >= 0 ? process.argv[arg + 1].split(',') : null;
  const plan = buildPlan(only);
  const byEngine = {};
  const byCode = {};
  let done = 0;
  for (const it of plan) {
    byEngine[it.engine] = (byEngine[it.engine] ?? 0) + 1;
    byCode[it.code] = (byCode[it.code] ?? 0) + 1;
    if (fs.existsSync(it.out)) done += 1;
  }
  console.log(`к озвучке: ${plan.length}, уже есть: ${done}`);
  console.log('по языкам:', JSON.stringify(byCode));
  console.log('по синтезаторам:', JSON.stringify(byEngine));
  fs.writeFileSync(
    path.join(HERE, 'narration-plan.json'),
    JSON.stringify(plan.map(({ out, ...rest }) => ({ ...rest, out: path.relative(ROOT, out).replace(/\\/g, '/') })), null, 2) + '\n',
    'utf8'
  );
  console.log('план записан: tools/narration-plan.json');
}
