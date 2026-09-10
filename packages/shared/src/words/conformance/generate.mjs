// packages/shared/src/words/conformance/generate.mjs
// Генератор сверочных векторов виджета «Я знаю много слов».
//
// ЗАЧЕМ: Android реализуется отдельным нативным приложением, а не поверх
// этого кода (решение от 08.09.2026). Значит игровые правила будут написаны
// второй раз на другом языке, и единственный способ не разъехаться в
// поведении — общий машинно-проверяемый набор ожиданий.
//
// Векторы СНИМАЮТСЯ С ТЕКУЩЕЙ РЕАЛИЗАЦИИ и фиксируют её как контракт. Это не
// доказательство правильности — это фиксация: любое расхождение (в этой
// реализации при рефакторинге или в нативной при написании) становится
// видимым падением теста, а не тихой разницей в поведении на уроке.
//
// Запуск: npm run build && node src/words/conformance/generate.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const shared = require('../../../dist/index.js');
const HERE = path.dirname(fileURLToPath(import.meta.url));

const {
  wordImagePath,
  themeCoverPath,
  themeIntroAudioPath,
  themeFinalAudioPath,
  wordAudioPaths,
  audioFilesPerWord,
  schemeHasAudio,
  awardFor,
  upgradeAward,
  accuracy,
  WORDS_AWARD_THRESHOLDS,
  applyCreateProfile,
  applySaveScore,
  parseWordsLibrary,
} = shared;

const SCHEMES = {
  reference: { voices: ['boy', 'girl'], phrasesPerVoice: 5, neutral: true },
  mvp: { voices: ['girl'], phrasesPerVoice: 2, neutral: true },
  silent: { voices: [], phrasesPerVoice: 0, neutral: false },
};

/** 1. Раскладка ресурсов: идентификатор слова — ключ ко всем его файлам */
const resources = {
  wordImage: ['0000', '0204', '1419'].map((id) => ({ wordId: id, path: wordImagePath(id) })),
  themeCover: ['digits', 'transport'].map((id) => ({ themeId: id, path: themeCoverPath(id) })),
  themeIntro: [{ themeId: 'digits', voice: 'girl', path: themeIntroAudioPath('digits', 'girl') }],
  themeFinal: [{ themeId: 'digits', path: themeFinalAudioPath('digits') }],
  audioBySchema: Object.entries(SCHEMES).map(([name, scheme]) => ({
    scheme: name,
    definition: scheme,
    hasAudio: schemeHasAudio(scheme),
    filesPerWord: audioFilesPerWord(scheme),
    pathsFor0000: wordAudioPaths('0000', scheme),
  })),
};

/** 2. Достижения: пороги и монотонность */
const tallies = [
  { completed: 10, flawless: 10, errors: 0 },
  { completed: 10, flawless: 9, errors: 1 },
  { completed: 10, flawless: 8, errors: 2 },
  { completed: 10, flawless: 7, errors: 4 },
  { completed: 10, flawless: 6, errors: 9 },
  { completed: 10, flawless: 0, errors: 30 },
  { completed: 0, flawless: 0, errors: 0 },
  { completed: 3, flawless: 3, errors: 0 },
];

const TIERS = ['wooden', 'silver', 'gold'];
const upgrades = [];
for (const current of [null, ...TIERS]) {
  for (const earned of [null, ...TIERS]) {
    upgrades.push({ current, earned, result: upgradeAward(current, earned) });
  }
}

const awards = {
  thresholds: WORDS_AWARD_THRESHOLDS.map((t) => ({ tier: t.tier, minAccuracy: t.minAccuracy })),
  byTally: tallies.map((tally) => ({
    tally,
    accuracy: accuracy(tally),
    tier: awardFor(tally),
  })),
  monotonicUpgrade: upgrades,
};

/** 3. Правила имени игрока и записи достижения */
function nameCase(name, existing = []) {
  try {
    const { created } = applyCreateProfile(existing, name, 'FIXED-ID', 'FIXED-TIME');
    return { name, accepted: true, storedName: created.name };
  } catch (err) {
    return { name, accepted: false, error: err.message };
  }
}

const existingAnya = [{ id: 'a', name: 'Аня', createdAt: 'FIXED-TIME' }];
const rules = {
  profileName: [
    nameCase('Аня'),
    nameCase('  Боря  '),
    nameCase(''),
    nameCase('   '),
    nameCase('я'.repeat(41)),
    nameCase('я'.repeat(40)),
    nameCase('аня', existingAnya),
    nameCase('АНЯ', existingAnya),
  ],
  saveScore: [
    { from: {}, profileId: 'p1', themeId: 'digits', tier: 'wooden' },
    { from: { p1: { digits: 'wooden' } }, profileId: 'p1', themeId: 'digits', tier: 'gold' },
    { from: { p1: { digits: 'gold' } }, profileId: 'p1', themeId: 'digits', tier: 'wooden' },
    { from: { p1: { digits: 'silver' } }, profileId: 'p1', themeId: 'digits', tier: 'silver' },
  ].map((c) => {
    const r = applySaveScore(c.from, c.profileId, c.themeId, c.tier);
    return { ...c, changed: r.changed, resultingTier: r.tier };
  }),
};

/** 4. Валидация пакета контента: что обязано быть отвергнуто */
const validLibrary = {
  schemaVersion: 1,
  audioScheme: SCHEMES.silent,
  themes: [{ id: 'digits', title: 'Цифры', wordIds: ['0000'] }],
  words: [{ id: '0000', name: 'Один', themeId: 'digits', level: 0 }],
};

function libraryCase(label, library) {
  try {
    parseWordsLibrary(library);
    return { label, accepted: true };
  } catch (err) {
    return { label, accepted: false, issues: err.issues ?? [err.message] };
  }
}

const libraryValidation = [
  libraryCase('корректный пакет', validLibrary),
  libraryCase('нет версии схемы', { ...validLibrary, schemaVersion: undefined }),
  libraryCase('чужая версия схемы', { ...validLibrary, schemaVersion: 2 }),
  libraryCase('идентификатор слова не из четырёх цифр', {
    ...validLibrary,
    themes: [{ id: 'digits', title: 'Цифры', wordIds: ['1'] }],
    words: [{ id: '1', name: 'Один', themeId: 'digits', level: 0 }],
  }),
  libraryCase('дублирующиеся названия тем', {
    ...validLibrary,
    themes: [
      { id: 'pets', title: 'Домашние животные', wordIds: ['0000'] },
      { id: 'pets2', title: 'Домашние животные', wordIds: ['0001'] },
    ],
    words: [
      { id: '0000', name: 'Кошка', themeId: 'pets', level: 0 },
      { id: '0001', name: 'Собака', themeId: 'pets2', level: 0 },
    ],
  }),
  libraryCase('тема ссылается на несуществующее слово', {
    ...validLibrary,
    themes: [{ id: 'digits', title: 'Цифры', wordIds: ['0000', '9999'] }],
  }),
  libraryCase('слово не перечислено в своей теме', {
    ...validLibrary,
    themes: [{ id: 'digits', title: 'Цифры', wordIds: [] }],
  }),
];

const vectors = {
  note:
    'Сверочные векторы виджета «Я знаю много слов». Обе реализации — Electron (TypeScript) ' +
    'и нативная Android — обязаны давать ровно эти результаты. См. docs/words-cross-platform-contract.md',
  generatedFrom: 'packages/shared/src/words',
  resources,
  awards,
  rules,
  libraryValidation,
};

fs.writeFileSync(path.join(HERE, 'vectors.json'), JSON.stringify(vectors, null, 2) + '\n', 'utf8');
console.log('Векторы записаны: vectors.json');
console.log(
  `  ресурсы: ${resources.wordImage.length + resources.themeCover.length} путей, ${resources.audioBySchema.length} схем озвучки`
);
console.log(`  достижения: ${awards.byTally.length} счётов, ${awards.monotonicUpgrade.length} переходов`);
console.log(`  правила: ${rules.profileName.length} имён, ${rules.saveScore.length} записей достижения`);
console.log(`  валидация пакета: ${libraryValidation.length} случаев`);
