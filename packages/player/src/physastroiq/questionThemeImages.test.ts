// packages/player/src/physastroiq/questionThemeImages.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { questionThemeImageUrl, PHYSASTROIQ_QUESTION_THEMES } from './questionThemeImages.ts';
import physicsContentJson from './content/physastroiqPhysicsContent.json' with { type: 'json' };
import astroContentJson from './content/physastroiqAstroContent.json' with { type: 'json' };

const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'public');

const themesOf = (content: { questions: { theme: string }[] }) => new Set(content.questions.map((q) => q.theme));

test('у каждой темы ОБЕИХ поставляемых викторин есть картинка, и список тем совпадает с банками', () => {
  const usedThemes = new Set([...themesOf(physicsContentJson), ...themesOf(astroContentJson)]);
  assert.deepEqual(new Set(PHYSASTROIQ_QUESTION_THEMES), usedThemes);
});

test('темы физики и астрономии не пересекаются — иначе одна картинка обслуживала бы два предмета', () => {
  const physics = themesOf(physicsContentJson);
  const shared = [...themesOf(astroContentJson)].filter((t) => physics.has(t));
  assert.deepEqual(shared, []);
});

test('файл каждой картинки лежит в поставке и не пустой', () => {
  for (const theme of PHYSASTROIQ_QUESTION_THEMES) {
    const url = questionThemeImageUrl(theme);
    assert.ok(url && url.startsWith('./physastroiq/questionThemes/'), `тема «${theme}»: неожиданный путь ${url}`);
    const file = path.join(PUBLIC, url!.slice(2));
    assert.ok(fs.existsSync(file), `тема «${theme}»: нет файла ${file}`);
    assert.ok(fs.statSync(file).size > 12000, `тема «${theme}»: картинка подозрительно мала`);
  }
});

test('у каждой темы своя картинка — две темы на один файл означают забытую эмблему', () => {
  const files = PHYSASTROIQ_QUESTION_THEMES.map((t) => questionThemeImageUrl(t));
  assert.equal(new Set(files).size, files.length);
});

test('в каталоге нет картинок мимо списка тем', () => {
  const onDisk = fs.readdirSync(path.join(PUBLIC, 'physastroiq', 'questionThemes')).sort();
  const mapped = PHYSASTROIQ_QUESTION_THEMES.map((t) => path.basename(questionThemeImageUrl(t)!)).sort();
  assert.deepEqual(onDisk, mapped);
});

test('для незнакомой темы (викторина учителя) картинка не выдумывается', () => {
  assert.equal(questionThemeImageUrl('Совершенно незнакомая тема'), null);
});
