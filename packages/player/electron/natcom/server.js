// packages/player/electron/natcom/server.js
// Встроенный локальный сервер виджета «Конструктор природных сообществ»
// (Тип 5, см. Тип5_план_реализации.md, раздел 1). В отличие от «Хронолинии»
// (только IPC внутри одного Electron-окна), у этого виджета есть РЕАЛЬНЫЙ
// сетевой сервер: Express + socket.io, слушающий на 0.0.0.0, чтобы браузеры
// ДРУГИХ устройств школьной сети (ученики) могли подключиться по IP
// учительского ПК — тот же Node-рантайм, что и весь остальной main-процесс,
// не отдельный исполняемый файл и не Docker-контейнер, как у оригинала.
//
// Эпик 4 бэклога (T5-030..034): REST (`/api/options`, `/api/license`,
// `/api/projects/:id`) + ёмкость подключений через socket.io
// (`join`/`disconnect`/`changeClients`).
//
// Эпик 8.1 бэклога (T5-073..076): веб-клиент ученика - отдельный vite-бандл
// (packages/natcom-student-web), раздаётся статикой через `express.static`;
// `/library-assets/:fileName` - те же файлы библиотеки, что `natcomlib://`
// у Electron-стороны (packages/player/src/natcom/mediaUrl.ts), но обычным
// HTTP-путём (в браузере нет кастомных Electron-протоколов); `/api/library` -
// полная библиотека (браузеру без Electron IPC негде её больше взять);
// `/api/active-project` + событие `activeProjectChanged` - какую презентацию
// сейчас показывает педагог (см. `setActiveProject`, вызывается из
// PlayerScreen.tsx через IPC при открытии/закрытии экрана «Плеер»).
//
// Эпик 10 бэклога (T5-090/091): админ-панель - ТОЖЕ веб-интерфейс (ТЗ FR-011:
// "посредством браузера... административный интерфейс, с ограниченным
// доступом"), не Electron-экран. Вход - через существующую модель
// LicenseUser центрального KIOSK-сервера (POST /api/auth/editor-login, тот
// же эндпоинт, что уже использует вход в editor-web) - embedded-сервер
// делает исходящий запрос к центральному серверу вместо собственной
// bcrypt-реализации; проверяется, что залогинившийся LicenseUser относится
// к ТОЙ ЖЕ лицензии, что активация этого устройства (иначе чужой
// сотрудник другой школы мог бы зайти в админку по LAN). Локальная
// сессия - короткоживущий токен в памяти (adminSessions), не хранится на
// диске: это состояние текущего рабочего дня, не презентации.
//
// `resetAllConnections()` теперь ДЕЙСТВИТЕЛЬНО вызывается по сети - но
// только за `requireRole('admin')`, т.е. только после реального входа через
// LicenseUser. До Эпика 10 (когда такого входа не было) это было
// осознанно НЕ публичным API - см. историю в Тип5_бэклог.md, Эпик 4/8.1.

const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Server: SocketIoServer } = require('socket.io');
const { hasAtLeastRole } = require('@kiosk/shared');
const { resolveWithinRoot } = require('../chrono/pathGuard');
const projectStore = require('./projectStore');

const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000; // рабочая смена - 8 часов

// T5-040/T5-041: роль - атрибут сессии, проверяемый на сервере, не только
// скрытие кнопки в UI. Фабрика (не готовая функция) - adminSessions должен
// быть отдельным для каждого запущенного сервера (важно для тестов,
// поднимающих несколько независимых серверов подряд).
function createAttachRole(adminSessions) {
  return function attachRole(req, _res, next) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const session = token ? adminSessions.get(token) : null;
    if (session && session.expiresAt > Date.now()) {
      req.natcomRole = 'admin';
    } else {
      if (token) adminSessions.delete(token);
      req.natcomRole = 'student';
    }
    next();
  };
}

function requireRole(minRole) {
  return (req, res, next) => {
    if (!hasAtLeastRole(req.natcomRole, minRole)) {
      res.status(403).json({ error: 'Недостаточно прав' });
      return;
    }
    next();
  };
}

// Небольшая, сознательно отдельная от guessMime() в main.js карта - та
// умеет магические байты (нужно для kioskcache/chronomedia, куда попадают
// произвольные пользовательские файлы). Файлы библиотеки - наши
// собственные, с известным набором расширений, определять тип по сигнатуре
// не требуется.
const LIBRARY_ASSET_MIME = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

function guessLibraryAssetMime(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  return LIBRARY_ASSET_MIME[ext] || 'application/octet-stream';
}

/**
 * @param {{
 *   port: number,
 *   maxClients: number,
 *   baseDir: string,
 *   assetsDir?: string | null,
 *   library?: import('@kiosk/shared').NatComLibrary | null,
 *   studentWebDir?: string | null,
 *   getLicenseInfo?: () => ({ plan: string, organizationId: string, expiresAt: string } | null),
 *   getCentralServerUrl?: () => string | null,
 *   getExpectedLicenseId?: () => string | null,
 *   onLog?: (...args: unknown[]) => void,
 *   onServerError?: (err: NodeJS.ErrnoException) => void
 * }} options
 * @returns {{
 *   httpServer: import('http').Server,
 *   io: import('socket.io').Server,
 *   stop: () => Promise<void>,
 *   resetAllConnections: () => void,
 *   getConnectedCount: () => number,
 *   setActiveProject: (projectId: string | null) => void
 * }}
 */
function startNatComServer({
  port,
  maxClients,
  baseDir,
  assetsDir = null,
  library = null,
  studentWebDir = null,
  getLicenseInfo = () => null,
  getCentralServerUrl = () => null,
  getExpectedLicenseId = () => null,
  onLog = () => {},
  onServerError = () => {}
}) {
  const app = express();
  const adminSessions = new Map();
  app.use(express.json());
  app.use(createAttachRole(adminSessions));

  // Веб-клиент ученика (Эпик 8.1) - статика из отдельного vite-бандла
  // (packages/natcom-student-web/dist), если он собран и положен рядом
  // (extraResources в packaged-сборке, относительный путь в dev). Если его
  // нет - ниже остаётся плейсхолдер-страница (dev без сборки студенческого
  // бандла, или более старая версия кода). extensions:['html'] даёт
  // /admin вместо /admin.html (T5-090).
  if (studentWebDir && fs.existsSync(studentWebDir)) {
    app.use(express.static(studentWebDir, { extensions: ['html'] }));
  }

  app.get('/', (_req, res) => {
    res.type('html').send(
      '<!doctype html><html><head><meta charset="utf-8"><title>Конструктор природных сообществ</title></head>' +
      '<body style="font-family:sans-serif;padding:40px;text-align:center;">' +
      '<h1>Конструктор природных сообществ</h1>' +
      '<p>Встроенный сервер запущен.</p>' +
      '</body></html>'
    );
  });

  // T5-030
  app.get('/api/options', requireRole('student'), (_req, res) => {
    res.json({ maxClients, connectedCount: connectedSockets.size });
  });

  app.get('/api/license', requireRole('student'), (_req, res) => {
    const info = getLicenseInfo();
    if (!info) {
      res.json({ available: false });
      return;
    }
    res.json({ available: true, ...info });
  });

  // T5-031 - REST здесь ТОЛЬКО на чтение (просмотр готовой презентации
  // браузером ученика). Создание/правка остаются через Electron IPC
  // учительского экрана (Home/Editor) - не через открытый без авторизации
  // REST, в отличие от read-file/save-file по произвольному имени у
  // оригинала.
  app.get('/api/projects/:id', requireRole('student'), (req, res) => {
    try {
      const project = projectStore.loadProject(baseDir, req.params.id);
      res.json(project);
    } catch {
      res.status(404).json({ error: 'Презентация не найдена' });
    }
  });

  // T5-073/074 - библиотека целиком: у браузера без Electron IPC нет
  // другого способа узнать названия/описания/ссылки на медиа объектов.
  app.get('/api/library', requireRole('student'), (_req, res) => {
    if (!library) {
      res.status(503).json({ error: 'Библиотека не загружена' });
      return;
    }
    res.json(library);
  });

  // Какую презентацию сейчас показывает педагог - устанавливается через
  // setActiveProject() (вызывается из main.js по IPC от PlayerScreen.tsx),
  // не хранится в файле - это состояние текущего сеанса показа, не самой
  // презентации.
  let activeProjectId = null;

  app.get('/api/active-project', requireRole('student'), (_req, res) => {
    res.json({ projectId: activeProjectId });
  });

  // T5-073 - файлы библиотеки (картинки/видео объектов и фонов) обычным
  // HTTP-путём, тот же guard (resolveWithinRoot), что у natcomlib:// на
  // стороне Electron.
  app.get('/library-assets/:fileName', requireRole('student'), (req, res) => {
    if (!assetsDir) {
      res.status(503).end();
      return;
    }
    try {
      const filePath = resolveWithinRoot(assetsDir, req.params.fileName);
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        res.status(404).end();
        return;
      }
      res.type(guessLibraryAssetMime(req.params.fileName)).sendFile(filePath);
    } catch {
      res.status(404).end();
    }
  });

  // T5-090 - вход администратора через существующую модель LicenseUser
  // центрального KIOSK-сервера, НЕ собственная bcrypt-реализация здесь.
  app.post('/api/admin/login', async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ error: 'Укажите email и пароль' });
      return;
    }
    const centralServerUrl = getCentralServerUrl();
    if (!centralServerUrl) {
      res.status(503).json({ error: 'Нет связи с центральным сервером KIOSK' });
      return;
    }

    let central;
    try {
      const resp = await fetch(centralServerUrl.replace(/\/+$/, '') + '/api/auth/editor-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      central = await resp.json().catch(() => null);
      if (!resp.ok || !central || !central.success) {
        res.status(401).json({ error: (central && central.message) || 'Неверный логин или пароль' });
        return;
      }
    } catch (err) {
      res.status(502).json({ error: 'Не удалось связаться с центральным сервером: ' + (err && err.message) });
      return;
    }

    const expectedLicenseId = getExpectedLicenseId();
    if (expectedLicenseId && central.license && central.license.id !== expectedLicenseId) {
      res.status(403).json({ error: 'Эта учётная запись относится к другой лицензии KIOSK' });
      return;
    }

    const sessionToken = crypto.randomUUID();
    adminSessions.set(sessionToken, { email: central.user.email, expiresAt: Date.now() + ADMIN_SESSION_TTL_MS });
    res.json({ sessionToken, email: central.user.email });
  });

  app.post('/api/admin/logout', requireRole('admin'), (req, res) => {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (token) adminSessions.delete(token);
    res.json({ success: true });
  });

  // T5-091 - экран «Клиенты»: N/максимум + список подключённых в реальном
  // времени (педагог перечитывает эту точку периодически - см. AdminApp.tsx).
  app.get('/api/admin/clients', requireRole('admin'), (_req, res) => {
    res.json({
      maxClients,
      connectedCount: connectedSockets.size,
      clients: Array.from(connectedSockets.entries()).map(([id, meta]) => ({ id, connectedAt: meta.connectedAt }))
    });
  });

  app.post('/api/admin/disconnect-all', requireRole('admin'), (_req, res) => {
    resetAllConnections();
    res.json({ success: true });
  });

  const httpServer = http.createServer(app);
  const io = new SocketIoServer(httpServer, {
    cors: { origin: '*' },
  });

  // T5-032/033: ёмкость - параметр (maxClients из свойств виджета), не
  // константа в коде. Map (не Set), т.к. Эпику 10 нужно время подключения
  // для таблицы «Клиенты» - раньше хватало id, теперь нужны метаданные.
  const connectedSockets = new Map();

  function broadcastChangeClients() {
    io.emit('changeClients', { count: connectedSockets.size, maxClients });
  }

  io.on('connection', (socket) => {
    onLog('[natcom] client connected:', socket.id);

    socket.on('join', (_payload, ack) => {
      const acknowledge = typeof ack === 'function' ? ack : () => {};
      if (connectedSockets.size >= maxClients) {
        acknowledge({ accepted: false, reason: 'capacity' });
        return;
      }
      connectedSockets.set(socket.id, { connectedAt: new Date().toISOString() });
      acknowledge({ accepted: true });
      broadcastChangeClients();
    });

    socket.on('disconnect', (reason) => {
      connectedSockets.delete(socket.id);
      onLog('[natcom] client disconnected:', socket.id, reason);
      broadcastChangeClients();
    });
  });

  httpServer.on('error', (err) => {
    // EADDRINUSE и подобные — не должны ронять весь Electron-процесс.
    // T5-112: педагог должен УВИДЕТЬ причину, не только запись в файле
    // отладочного лога, который он никогда не откроет - onServerError
    // прокидывается наружу (main.js -> natcom:get-server-info -> UI).
    onLog('[natcom] server error:', err && err.message);
    onServerError(err);
  });

  // 0.0.0.0, не 'localhost' - иначе другие устройства школьной сети не
  // смогут подключиться к учительскому ПК по его IP, только сам плеер.
  httpServer.listen(port, '0.0.0.0', () => {
    onLog('[natcom] listening on 0.0.0.0:' + port);
  });

  function resetAllConnections() {
    for (const id of connectedSockets.keys()) {
      const s = io.sockets.sockets.get(id);
      if (s) s.disconnect(true);
    }
    connectedSockets.clear();
    broadcastChangeClients();
  }

  function setActiveProject(projectId) {
    activeProjectId = projectId;
    io.emit('activeProjectChanged', { projectId });
  }

  function stop() {
    return new Promise((resolve) => {
      io.close(() => {
        httpServer.close(() => resolve());
      });
    });
  }

  return {
    httpServer,
    io,
    stop,
    resetAllConnections,
    getConnectedCount: () => connectedSockets.size,
    setActiveProject
  };
}

module.exports = { startNatComServer, createAttachRole, requireRole };
