// packages/player/src/bioiq/questionThemeImages.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { questionThemeImageUrl, BIOIQ_QUESTION_THEMES } from './questionThemeImages.ts';
import realContentJson from './content/bioiqRealContent.json' with { type: 'json' };

const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'public');

test('у каждой темы поставляемой викторины есть картинка, и список тем совпадает с банком', () => {
  const usedThemes = new Set(realContentJson.questions.map((q: { theme: string }) => q.theme));
  assert.deepEqual(new Set(BIOIQ_QUESTION_THEMES), usedThemes);
});

test('файл каждой картинки лежит в поставке и не пустой', () => {
  for (const theme of BIOIQ_QUESTION_THEMES) {
    const url = questionThemeImageUrl(theme);
    assert.ok(url && url.startsWith('./bioiq/questionThemes/'), `тема «${theme}»: неожиданный путь ${url}`);
    const file = path.join(PUBLIC, url!.slice(2));
    assert.ok(fs.existsSync(file), `тема «${theme}»: нет файла ${file}`);
    assert.ok(fs.statSync(file).size > 12000, `тема «${theme}»: картинка подозрительно мала`);
  }
});

test('в каталоге нет картинок мимо списка тем', () => {
  const onDisk = fs.readdirSync(path.join(PUBLIC, 'bioiq', 'questionThemes')).sort();
  const mapped = BIOIQ_QUESTION_THEMES.map((t) => path.basename(questionThemeImageUrl(t)!)).sort();
  assert.deepEqual(onDisk, mapped);
});

test('для незнакомой темы (викторина учителя) картинка не выдумывается', () => {
  assert.equal(questionThemeImageUrl('Совершенно незнакомая тема'), null);
});
