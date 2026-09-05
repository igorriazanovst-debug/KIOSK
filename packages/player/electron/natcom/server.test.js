// packages/player/electron/natcom/server.test.js
// T5-034: "постановочный прогон" - реальный HTTP-сервер (startNatComServer)
// на эфемерном порту + настоящие socket.io-client подключения, не моки.
// Проверяет то же самое, что и живой прогон через packaged-Electron: при
// ёмкости K клиент K+1 получает отказ, "Отключить всех" реально обнуляет
// список подключений и рассылает changeClients.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const { io: ioClient } = require('socket.io-client');
const { startNatComServer, requireRole, createAttachRole } = require('./server');
const projectStore = require('./projectStore');

// Подставной "центральный сервер" (POST /api/auth/editor-login) - реальный
// HTTP-сервер на эфемерном порту, не мок на уровне JS-модуля (тот же принцип,
// что withServer ниже: подменяется только внешняя система, не наш код).
function withMockCentralServer(handler, fn) {
  return new Promise((resolvePromise, rejectPromise) => {
    const mockServer = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          handler(req, res, body ? JSON.parse(body) : {});
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    });
    mockServer.on('error', rejectPromise);
    mockServer.listen(0, '127.0.0.1', async () => {
      const url = `http://127.0.0.1:${mockServer.address().port}`;
      try {
        await fn(url);
      } finally {
        mockServer.close(() => resolvePromise());
      }
    });
  });
}

function respondJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function makeTempBaseDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'natcom-server-test-'));
}

function connectClient(port) {
  return ioClient(`http://127.0.0.1:${port}`, { reconnection: false });
}

function waitForConnect(socket) {
  return new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
}

function joinAck(socket) {
  return new Promise((resolve) => socket.emit('join', {}, resolve));
}

function waitForEvent(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}

async function withServer(opts, fn) {
  const baseDir = makeTempBaseDir();
  const handle = startNatComServer({
    port: 0,
    maxClients: 2,
    baseDir,
    getLicenseInfo: () => null,
    onLog: () => {},
    ...opts
  });
  // httpServer.listen() резолвится асинхронно - до события 'listening'
  // handle.httpServer.address() возвращает null (порт 0 - эфемерный, узнать
  // его можно только после реального bind).
  if (!handle.httpServer.listening) {
    await new Promise((resolve) => handle.httpServer.once('listening', resolve));
  }
  const port = handle.httpServer.address().port;
  try {
    await fn({ handle, port, baseDir });
  } finally {
    for (const [, s] of handle.io.sockets.sockets) s.disconnect(true);
    await handle.stop();
  }
}

test('GET /api/options reflects maxClients and live connectedCount', async () => {
  await withServer({}, async ({ port }) => {
    const before = await fetch(`http://127.0.0.1:${port}/api/options`).then((r) => r.json());
    assert.deepEqual(before, { maxClients: 2, connectedCount: 0 });

    const client = connectClient(port);
    await waitForConnect(client);
    await joinAck(client);

    const after = await fetch(`http://127.0.0.1:${port}/api/options`).then((r) => r.json());
    assert.equal(after.connectedCount, 1);

    client.close();
  });
});

test('GET /api/license reports unavailable when getLicenseInfo returns null', async () => {
  await withServer({ getLicenseInfo: () => null }, async ({ port }) => {
    const body = await fetch(`http://127.0.0.1:${port}/api/license`).then((r) => r.json());
    assert.deepEqual(body, { available: false });
  });
});

test('GET /api/license reports plan/organizationId/expiresAt when a license is present', async () => {
  await withServer(
    { getLicenseInfo: () => ({ plan: 'PRO', organizationId: 'org-1', expiresAt: '2027-01-01T00:00:00.000Z' }) },
    async ({ port }) => {
      const body = await fetch(`http://127.0.0.1:${port}/api/license`).then((r) => r.json());
      assert.deepEqual(body, {
        available: true,
        plan: 'PRO',
        organizationId: 'org-1',
        expiresAt: '2027-01-01T00:00:00.000Z'
      });
    }
  );
});

test('GET /api/projects/:id serves a real saved project, 404 for unknown id', async () => {
  await withServer({}, async ({ port, baseDir }) => {
    const project = projectStore.createProject(baseDir, {
      title: 'Тестовая презентация',
      backgroundId: 'bg-les',
      ownerId: 'owner-1',
      organizationId: 'org-1'
    });

    const resp = await fetch(`http://127.0.0.1:${port}/api/projects/${project.id}`);
    assert.equal(resp.status, 200);
    const body = await resp.json();
    assert.equal(body.id, project.id);
    assert.equal(body.title, 'Тестовая презентация');

    const missing = await fetch(`http://127.0.0.1:${port}/api/projects/does-not-exist`);
    assert.equal(missing.status, 404);
  });
});

test('capacity: the (maxClients+1)-th join is rejected, earlier ones stay connected', async () => {
  await withServer({}, async ({ port }) => {
    const clientA = connectClient(port);
    const clientB = connectClient(port);
    const clientC = connectClient(port);
    await Promise.all([waitForConnect(clientA), waitForConnect(clientB), waitForConnect(clientC)]);

    const ackA = await joinAck(clientA);
    const ackB = await joinAck(clientB);
    const ackC = await joinAck(clientC);

    assert.equal(ackA.accepted, true);
    assert.equal(ackB.accepted, true);
    assert.equal(ackC.accepted, false);
    assert.equal(ackC.reason, 'capacity');

    clientA.close();
    clientB.close();
    clientC.close();
  });
});

test('changeClients is broadcast to connected clients on join and disconnect', async () => {
  await withServer({}, async ({ port }) => {
    const clientA = connectClient(port);
    await waitForConnect(clientA);

    const changePromise = waitForEvent(clientA, 'changeClients');
    await joinAck(clientA);
    const change = await changePromise;
    assert.deepEqual(change, { count: 1, maxClients: 2 });

    const clientB = connectClient(port);
    await waitForConnect(clientB);
    const secondChangePromise = waitForEvent(clientA, 'changeClients');
    await joinAck(clientB);
    const secondChange = await secondChangePromise;
    assert.deepEqual(secondChange, { count: 2, maxClients: 2 });

    clientA.close();
    clientB.close();
  });
});

test('resetAllConnections disconnects everyone and zeroes the connected count', async () => {
  await withServer({}, async ({ handle, port }) => {
    const clientA = connectClient(port);
    const clientB = connectClient(port);
    await Promise.all([waitForConnect(clientA), waitForConnect(clientB)]);
    await joinAck(clientA);
    await joinAck(clientB);
    assert.equal(handle.getConnectedCount(), 2);

    const disconnectedA = new Promise((resolve) => clientA.once('disconnect', resolve));
    const disconnectedB = new Promise((resolve) => clientB.once('disconnect', resolve));

    handle.resetAllConnections();
    await Promise.all([disconnectedA, disconnectedB]);

    assert.equal(handle.getConnectedCount(), 0);
    const options = await fetch(`http://127.0.0.1:${port}/api/options`).then((r) => r.json());
    assert.equal(options.connectedCount, 0);
  });
});

// T5-040/T5-041 - роль как атрибут сессии, серверная проверка не только
// скрытием кнопки. Сейчас у сервера нет мутирующих REST-маршрутов (создание/
// правка остаются Electron IPC-only), поэтому реального 403 в проде пока
// неоткуда взяться - но сам guard уже работает и протестирован здесь
// напрямую, чтобы Эпик 7/8 могли добавить requireRole('teacher') на первую
// мутирующую операцию без переизобретения механизма.
test('requireRole allows a request whose role meets the minimum', () => {
  const req = { natcomRole: 'student' };
  let called = false;
  const res = { status: () => { throw new Error('should not reject'); } };
  requireRole('student')(req, res, () => { called = true; });
  assert.equal(called, true);
});

test('requireRole rejects a request below the minimum with 403', () => {
  const req = { natcomRole: 'student' };
  let statusCode = null;
  let body = null;
  const res = {
    status(code) { statusCode = code; return this; },
    json(payload) { body = payload; }
  };
  let called = false;
  requireRole('teacher')(req, res, () => { called = true; });
  assert.equal(called, false);
  assert.equal(statusCode, 403);
  assert.ok(body && body.error);
});

test('existing REST routes stay reachable for the student-level session everyone gets', async () => {
  await withServer({}, async ({ port }) => {
    const options = await fetch(`http://127.0.0.1:${port}/api/options`);
    assert.equal(options.status, 200);
    const license = await fetch(`http://127.0.0.1:${port}/api/license`);
    assert.equal(license.status, 200);
  });
});

// Эпик 8.1 (T5-073/074) - веб-клиент ученика: библиотека, активная
// презентация, статика файлов библиотеки по обычному HTTP-пути (браузер
// без Electron не видит natcomlib://).

test('GET /api/library returns 503 when no library was loaded, 200 with it otherwise', async () => {
  await withServer({}, async ({ port }) => {
    const missing = await fetch(`http://127.0.0.1:${port}/api/library`);
    assert.equal(missing.status, 503);
  });

  const library = { schemaVersion: 1, backgrounds: [], categories: [], objects: [], media: [] };
  await withServer({ library }, async ({ port }) => {
    const resp = await fetch(`http://127.0.0.1:${port}/api/library`);
    assert.equal(resp.status, 200);
    assert.deepEqual(await resp.json(), library);
  });
});

test('GET /api/active-project defaults to null, setActiveProject updates it and broadcasts activeProjectChanged', async () => {
  await withServer({}, async ({ handle, port }) => {
    const before = await fetch(`http://127.0.0.1:${port}/api/active-project`).then((r) => r.json());
    assert.deepEqual(before, { projectId: null });

    const client = connectClient(port);
    await waitForConnect(client);
    const changePromise = waitForEvent(client, 'activeProjectChanged');

    handle.setActiveProject('project-123');

    const change = await changePromise;
    assert.deepEqual(change, { projectId: 'project-123' });

    const after = await fetch(`http://127.0.0.1:${port}/api/active-project`).then((r) => r.json());
    assert.deepEqual(after, { projectId: 'project-123' });

    client.close();
  });
});

test('GET /library-assets/:fileName serves a real file from assetsDir, 404 for unknown/missing', async () => {
  const assetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'natcom-assets-test-'));
  fs.writeFileSync(path.join(assetsDir, 'test.svg'), '<svg></svg>');

  await withServer({ assetsDir }, async ({ port }) => {
    const resp = await fetch(`http://127.0.0.1:${port}/library-assets/test.svg`);
    assert.equal(resp.status, 200);
    assert.ok(resp.headers.get('content-type').startsWith('image/svg+xml'));
    assert.equal((await resp.text()).trim(), '<svg></svg>');

    const missing = await fetch(`http://127.0.0.1:${port}/library-assets/does-not-exist.svg`);
    assert.equal(missing.status, 404);
  });

  await withServer({}, async ({ port }) => {
    // assetsDir не передан вовсе - 503, не 404 (различие "не настроено" vs "нет файла").
    const resp = await fetch(`http://127.0.0.1:${port}/library-assets/anything.svg`);
    assert.equal(resp.status, 503);
  });
});

// Эпик 10 (T5-090/091) - вход администратора через существующую модель
// LicenseUser центрального сервера (не собственная bcrypt-реализация),
// проверка что LicenseUser относится к ТОЙ ЖЕ лицензии, короткоживущая
// локальная сессия, «Отключить всех» и список клиентов доступны ТОЛЬКО
// после реального входа.

test('createAttachRole: no token -> student; valid session -> admin; expired session -> student and evicted', () => {
  const sessions = new Map();
  sessions.set('valid-token', { email: 'a@b.com', expiresAt: Date.now() + 60000 });
  sessions.set('expired-token', { email: 'a@b.com', expiresAt: Date.now() - 1000 });
  const attachRole = createAttachRole(sessions);

  const withAuthHeader = (token) => ({ headers: token ? { authorization: `Bearer ${token}` } : {} });

  let req = withAuthHeader(null);
  attachRole(req, {}, () => {});
  assert.equal(req.natcomRole, 'student');

  req = withAuthHeader('valid-token');
  attachRole(req, {}, () => {});
  assert.equal(req.natcomRole, 'admin');

  req = withAuthHeader('expired-token');
  attachRole(req, {}, () => {});
  assert.equal(req.natcomRole, 'student');
  assert.equal(sessions.has('expired-token'), false);
});

test('POST /api/admin/login returns 503 when no central server is configured', async () => {
  await withServer({}, async ({ port }) => {
    const resp = await fetch(`http://127.0.0.1:${port}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', password: 'x' })
    });
    assert.equal(resp.status, 503);
  });
});

test('POST /api/admin/login succeeds against a real (mocked) central server and issues a usable session', async () => {
  await withMockCentralServer(
    (req, res, body) => {
      assert.equal(req.url, '/api/auth/editor-login');
      assert.equal(body.email, 'teacher@school.ru');
      respondJson(res, 200, { success: true, license: { id: 'lic-1' }, user: { email: 'teacher@school.ru', role: 'OWNER' } });
    },
    async (centralUrl) => {
      await withServer(
        { getCentralServerUrl: () => centralUrl, getExpectedLicenseId: () => 'lic-1' },
        async ({ port }) => {
          const loginResp = await fetch(`http://127.0.0.1:${port}/api/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'teacher@school.ru', password: 'secret' })
          });
          assert.equal(loginResp.status, 200);
          const { sessionToken } = await loginResp.json();
          assert.ok(sessionToken);

          const withoutAuth = await fetch(`http://127.0.0.1:${port}/api/admin/clients`);
          assert.equal(withoutAuth.status, 403);

          const withAuth = await fetch(`http://127.0.0.1:${port}/api/admin/clients`, {
            headers: { Authorization: `Bearer ${sessionToken}` }
          });
          assert.equal(withAuth.status, 200);
          const body = await withAuth.json();
          assert.deepEqual(body, { maxClients: 2, connectedCount: 0, clients: [] });
        }
      );
    }
  );
});

test('POST /api/admin/login rejects a LicenseUser belonging to a different license', async () => {
  await withMockCentralServer(
    (_req, res) => respondJson(res, 200, { success: true, license: { id: 'lic-OTHER' }, user: { email: 'x@y.ru', role: 'MEMBER' } }),
    async (centralUrl) => {
      await withServer(
        { getCentralServerUrl: () => centralUrl, getExpectedLicenseId: () => 'lic-1' },
        async ({ port }) => {
          const resp = await fetch(`http://127.0.0.1:${port}/api/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'x@y.ru', password: 'secret' })
          });
          assert.equal(resp.status, 403);
        }
      );
    }
  );
});

test('POST /api/admin/login propagates invalid-credentials from the central server', async () => {
  await withMockCentralServer(
    (_req, res) => respondJson(res, 401, { success: false, message: 'Wrong password' }),
    async (centralUrl) => {
      await withServer({ getCentralServerUrl: () => centralUrl }, async ({ port }) => {
        const resp = await fetch(`http://127.0.0.1:${port}/api/admin/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'x@y.ru', password: 'wrong' })
        });
        assert.equal(resp.status, 401);
        const body = await resp.json();
        assert.equal(body.error, 'Wrong password');
      });
    }
  );
});

test('POST /api/admin/disconnect-all requires an admin session and actually disconnects real socket clients', async () => {
  await withMockCentralServer(
    (_req, res) => respondJson(res, 200, { success: true, license: { id: 'lic-1' }, user: { email: 'a@b.com', role: 'OWNER' } }),
    async (centralUrl) => {
      await withServer({ getCentralServerUrl: () => centralUrl }, async ({ handle, port }) => {
        const clientA = connectClient(port);
        const clientB = connectClient(port);
        await Promise.all([waitForConnect(clientA), waitForConnect(clientB)]);
        await joinAck(clientA);
        await joinAck(clientB);
        assert.equal(handle.getConnectedCount(), 2);

        const withoutAuth = await fetch(`http://127.0.0.1:${port}/api/admin/disconnect-all`, { method: 'POST' });
        assert.equal(withoutAuth.status, 403);
        assert.equal(handle.getConnectedCount(), 2);

        const loginResp = await fetch(`http://127.0.0.1:${port}/api/admin/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'a@b.com', password: 'secret' })
        });
        const { sessionToken } = await loginResp.json();

        const disconnectedA = new Promise((resolve) => clientA.once('disconnect', resolve));
        const disconnectedB = new Promise((resolve) => clientB.once('disconnect', resolve));

        const withAuth = await fetch(`http://127.0.0.1:${port}/api/admin/disconnect-all`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${sessionToken}` }
        });
        assert.equal(withAuth.status, 200);
        await Promise.all([disconnectedA, disconnectedB]);
        assert.equal(handle.getConnectedCount(), 0);
      });
    }
  );
});

// Эпик 12 (T5-112) - диагностика типовых сбоев среды: порт занят другим
// процессом должен дойти до onServerError (и оттуда - до UI педагога), не
// потеряться в файле отладочного лога.
test('a real EADDRINUSE (port already occupied by another process) is reported via onServerError', async () => {
  const blocker = http.createServer();
  // '0.0.0.0' - тот же адрес, что и настоящий startNatComServer ниже, иначе
  // на некоторых сетевых стеках bind на 0.0.0.0 поверх уже занятого
  // 127.0.0.1 не конфликтует (найдено при первом прогоне этого теста).
  await new Promise((resolve) => blocker.listen(0, '0.0.0.0', resolve));
  const occupiedPort = blocker.address().port;

  const baseDir = makeTempBaseDir();
  let capturedError = null;
  const handle = startNatComServer({
    port: occupiedPort,
    maxClients: 2,
    baseDir,
    onLog: () => {},
    onServerError: (err) => { capturedError = err; }
  });

  await new Promise((resolve) => setTimeout(resolve, 300));

  assert.ok(capturedError, 'expected onServerError to have been called');
  assert.equal(capturedError.code, 'EADDRINUSE');

  await new Promise((resolve) => blocker.close(resolve));
  // handle.httpServer никогда не успешно забиндился - stop()/close() ему не нужны.
});
