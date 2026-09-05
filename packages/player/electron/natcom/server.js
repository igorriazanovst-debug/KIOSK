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
// Осознанное отличие от протокола оригинала: там `reset` ("отключить всех") -
// обычное клиентское socket.io-событие, которое мог прислать ЛЮБОЙ
// подключившийся браузер. Ролей/авторизации (Эпик 5) здесь ещё нет, поэтому
// делать `reset` публичным событием значило бы дать любому ученику право
// вышвырнуть весь класс - реальная дыра, которую мы сознательно не
// копируем. Вместо этого `resetAllConnections()` - функция на самом объекте
// сервера, вызываемая только доверенным Electron-кодом (учительский UI,
// когда появится в Эпике 9), никогда не socket.io-событием.

const express = require('express');
const http = require('http');
const { Server: SocketIoServer } = require('socket.io');
const { hasAtLeastRole } = require('@kiosk/shared');
const projectStore = require('./projectStore');

// T5-040/T5-041: роль - атрибут сессии, проверяемый на сервере, не только
// скрытие кнопки в UI. Сейчас у этого сервера ЕДИНСТВЕННЫЙ сетевой
// "вход" - браузер ученика (Педагог работает через Electron IPC
// учительского экрана, это отдельный доверенный процесс, который никогда
// не пересекает сеть) - поэтому каждый REST-запрос сюда архитектурно
// student-сессия. requireRole() уже готов принять более высокий порог,
// когда Эпик 7/8 добавит первую мутирующую операцию, реально требующую
// роли «Педагог»/«Администратор».
function attachRole(req, _res, next) {
  req.natcomRole = 'student';
  next();
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

/**
 * @param {{
 *   port: number,
 *   maxClients: number,
 *   baseDir: string,
 *   getLicenseInfo?: () => ({ plan: string, organizationId: string, expiresAt: string } | null),
 *   onLog?: (...args: unknown[]) => void
 * }} options
 * @returns {{
 *   httpServer: import('http').Server,
 *   io: import('socket.io').Server,
 *   stop: () => Promise<void>,
 *   resetAllConnections: () => void,
 *   getConnectedCount: () => number
 * }}
 */
function startNatComServer({ port, maxClients, baseDir, getLicenseInfo = () => null, onLog = () => {} }) {
  const app = express();
  app.use(attachRole);

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

  const httpServer = http.createServer(app);
  const io = new SocketIoServer(httpServer, {
    cors: { origin: '*' },
  });

  // T5-032/033: ёмкость - параметр (maxClients из свойств виджета), не
  // константа в коде.
  const connectedSockets = new Set();

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
      connectedSockets.add(socket.id);
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
    // EADDRINUSE и подобные — не должны ронять весь Electron-процесс
    // (T5-112, диагностика типовых сбоев среды). Пока — просто лог, живая
    // диагностика для педагога добавится вместе с UI виджета (Эпик 9).
    onLog('[natcom] server error:', err && err.message);
  });

  // 0.0.0.0, не 'localhost' - иначе другие устройства школьной сети не
  // смогут подключиться к учительскому ПК по его IP, только сам плеер.
  httpServer.listen(port, '0.0.0.0', () => {
    onLog('[natcom] listening on 0.0.0.0:' + port);
  });

  function resetAllConnections() {
    for (const id of connectedSockets) {
      const s = io.sockets.sockets.get(id);
      if (s) s.disconnect(true);
    }
    connectedSockets.clear();
    broadcastChangeClients();
  }

  function stop() {
    return new Promise((resolve) => {
      io.close(() => {
        httpServer.close(() => resolve());
      });
    });
  }

  return { httpServer, io, stop, resetAllConnections, getConnectedCount: () => connectedSockets.size };
}

module.exports = { startNatComServer, attachRole, requireRole };
