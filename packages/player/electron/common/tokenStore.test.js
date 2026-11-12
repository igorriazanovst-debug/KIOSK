// K2-F10: токен активации и player-debug.log живут в userData (профиль
// приложения), а не рядом с exe. На Linux каталог установки (/opt)
// принадлежит root: запись туда молча падает (EACCES), и после каждого
// рестарта киоск снова просит активацию. Здесь - чистые функции путей
// и миграции со старого места (иначе обновление разлогинило бы киоски).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { tokenFileName, resolveTokenPath, migrateLegacyTokenFiles, cleanupTokenFiles } = require('./tokenStore');

test('tokenFileName привязан к проекту (смена проекта = новая активация)', () => {
  assert.equal(tokenFileName('010fd04f-d516-45d0-a4ef-582247dcb3ae'), 'player-token-010fd04f.json');
  assert.equal(tokenFileName(null), 'player-token-noproj.json');
});

test('resolveTokenPath кладёт токен в userData, не рядом с exe', () => {
  assert.equal(
    resolveTokenPath('/home/user/.config/kiosk-player', 'proj-1'),
    path.join('/home/user/.config/kiosk-player', 'player-token-proj-1.json'),
  );
});

test('migrateLegacyTokenFiles переносит токены из каталога установки в userData', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kiosk-token-'));
  const execDir = path.join(tmp, 'opt-app');
  const userDataDir = path.join(tmp, 'user-data');
  fs.mkdirSync(execDir); fs.mkdirSync(userDataDir);
  fs.writeFileSync(path.join(execDir, 'player-token-010fd04f.json'), JSON.stringify({ token: 't' }));
  fs.writeFileSync(path.join(execDir, 'player-token-otherproj.json'), JSON.stringify({ token: 'x' }));
  const moved = migrateLegacyTokenFiles({ execDir, userDataDir });
  assert.deepEqual(moved.sort(), ['player-token-010fd04f.json', 'player-token-otherproj.json']);
  assert.ok(fs.existsSync(path.join(userDataDir, 'player-token-010fd04f.json')));
  assert.ok(!fs.existsSync(path.join(execDir, 'player-token-010fd04f.json')));
  // повторная миграция идемпотентна
  assert.deepEqual(migrateLegacyTokenFiles({ execDir, userDataDir }), []);
  // запись в старом месте не затирает более новый токен в userData
  fs.writeFileSync(path.join(execDir, 'player-token-010fd04f.json'), JSON.stringify({ token: 'old' }));
  fs.writeFileSync(path.join(userDataDir, 'player-token-010fd04f.json'), JSON.stringify({ token: 'new' }));
  migrateLegacyTokenFiles({ execDir, userDataDir });
  assert.equal(JSON.parse(fs.readFileSync(path.join(userDataDir, 'player-token-010fd04f.json'))).token, 'new');
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('migrateLegacyTokenFiles не падает на отсутствующем каталоге', () => {
  assert.deepEqual(migrateLegacyTokenFiles({ execDir: '/нет/такого', userDataDir: '/тоже/нет' }), []);
});

test('cleanupTokenFiles удаляет только токены, не трогая данные пользователей (P-03)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kiosk-token-'));
  fs.writeFileSync(path.join(tmp, 'player-token-a.json'), '{}');
  fs.writeFileSync(path.join(tmp, 'player-token-b.json'), '{}');
  fs.writeFileSync(path.join(tmp, 'user-data.json'), '{}');
  const removed = cleanupTokenFiles(tmp);
  assert.deepEqual(removed.sort(), ['player-token-a.json', 'player-token-b.json']);
  assert.ok(fs.existsSync(path.join(tmp, 'user-data.json')));
  fs.rmSync(tmp, { recursive: true, force: true });
});
