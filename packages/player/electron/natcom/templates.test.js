// packages/player/electron/natcom/templates.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadTemplatesSync, findTemplatesDirSync } = require('./templates');
const { loadLibrarySync } = require('./library');

test('findTemplatesDirSync finds the dev-mode natcom-templates directory', () => {
  const found = findTemplatesDirSync();
  assert.ok(found, 'expected to find packages/natcom-templates in dev mode');
  assert.equal(path.basename(found), 'natcom-templates');
});

test('loadTemplatesSync returns null-safe empty array without a library', () => {
  assert.deepEqual(loadTemplatesSync(null), []);
});

test('loadTemplatesSync loads and validates all 7 ready-made presentations against the real library', () => {
  const { library } = loadLibrarySync();
  const templates = loadTemplatesSync(library);
  assert.equal(templates.length, 7, 'expected one ready-made presentation per natural community');

  const ids = templates.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length, 'template ids must be unique');

  for (const template of templates) {
    assert.equal(template.isDefault, true, `${template.id} should be flagged isDefault`);
    assert.ok(template.title.length > 0, `${template.id} should have a title`);
    assert.ok(library.backgrounds.some((b) => b.id === template.backgroundId), `${template.id} references a real background`);
    assert.ok(template.objects.length > 0, `${template.id} should place at least one object`);
    for (const obj of template.objects) {
      assert.ok(library.objects.some((o) => o.id === obj.libraryObjectId), `${template.id}: ${obj.libraryObjectId} must exist in the library`);
    }
  }

  const backgroundIds = new Set(templates.map((t) => t.backgroundId));
  assert.equal(backgroundIds.size, 7, 'each of the 7 backgrounds should have exactly one ready-made presentation');
});
