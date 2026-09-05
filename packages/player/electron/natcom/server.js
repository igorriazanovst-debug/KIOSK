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
// Осознанное отличие от протокола оригинала: там `reset` ("отключить всех") -
// обычное клиентское socket.io-событие, которое мог прислать ЛЮБОЙ
// подключившийся браузер. Ролей/авторизации (Эпик 5) здесь ещё нет, поэтому
// делать `reset` публичным событием значило бы дать любому ученику право
// вышвырнуть весь класс - реальная дыра, которую мы сознательно не
// копируем. Вместо этого `resetAllConnections()` - функция на самом объекте
// сервера, вызываемая только доверенным Electron-кодом (учительский UI,
// когда появится в Эпике 10), никогда не socket.io-событием.

const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server: SocketIoServer } = require('socket.io');
const { hasAtLeastRole } = require('@kiosk/shared');
const { resolveWithinRoot } = require('../chrono/pathGuard');
const projectStore = require('./projectStore');

// T5-040/T5-041: роль - атрибут сессии, проверяемый на сервере, не только
// скрытие кнопки в UI. Сейчас у этого сервера ЕДИНСТВЕННЫЙ сетевой
// "вход" - браузер ученика (Педагог работает через Electron IPC
// учительского экрана, это отдельный доверенный процесс, который никогда
// не пересекает сеть) - поэтому каждый REST-запрос сюда архитектурно
// student-сессия. requireRole() уже готов принять более высокий порог,
// когда Эпик 9+ добавит первую мутирующую операцию, реально требующую
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
 *   onLog?: (...args: unknown[]) => void
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
  onLog = () => {}
}) {
  const app = express();
  app.use(attachRole);

  // Веб-клиент ученика (Эпик 8.1) - статика из отдельного vite-бандла
  // (packages/natcom-student-web/dist), если он собран и положен рядом
  // (extraResources в packaged-сборке, относительный путь в dev). Если его
  // нет - ниже остаётся плейсхолдер-страница (dev без сборки студенческого
  // бандла, или самый первый запуск до Эпика 8.1 в старой версии кода).
  if (studentWebDir && fs.existsSync(studentWebDir)) {
    app.use(express.static(studentWebDir));
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
    // диагностика для педагога добавится вместе с UI админ-панели (Эпик 10).
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

module.exports = { startNatComServer, attachRole, requireRole };
