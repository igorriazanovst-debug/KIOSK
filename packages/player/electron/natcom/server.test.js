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
const { io: ioClient } = require('socket.io-client');
const { startNatComServer } = require('./server');
const projectStore = require('./projectStore');

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
