// packages/player/electron/natcom/server.js
// Встроенный локальный сервер виджета «Конструктор природных сообществ»
// (Тип 5, см. Тип5_план_реализации.md, раздел 1). В отличие от «Хронолинии»
// (только IPC внутри одного Electron-окна), у этого виджета есть РЕАЛЬНЫЙ
// сетевой сервер: Express + socket.io, слушающий на 0.0.0.0, чтобы браузеры
// ДРУГИХ устройств школьной сети (ученики) могли подключиться по IP
// учительского ПК — тот же Node-рантайм, что и весь остальной main-процесс,
// не отдельный исполняемый файл и не Docker-контейнер, как у оригинала.
//
// Эпик 2 бэклога (вертикальный срез): только заглушка-страница и учёт факта
// подключения/отключения по socket.io, без ёмкости/ролей/домена — это
// нарастает в следующих эпиках (T5-030+).

const express = require('express');
const http = require('http');
const { Server: SocketIoServer } = require('socket.io');

/**
 * @param {{ port: number, onLog?: (...args: unknown[]) => void }} options
 * @returns {{ httpServer: import('http').Server, io: import('socket.io').Server, stop: () => Promise<void> }}
 */
function startNatComServer({ port, onLog = () => {} }) {
  const app = express();

  app.get('/', (_req, res) => {
    res.type('html').send(
      '<!doctype html><html><head><meta charset="utf-8"><title>Конструктор природных сообществ</title></head>' +
      '<body style="font-family:sans-serif;padding:40px;text-align:center;">' +
      '<h1>Конструктор природных сообществ</h1>' +
      '<p>Встроенный сервер запущен. Это временная заглушка вертикального среза (Эпик 2).</p>' +
      '</body></html>'
    );
  });

  const httpServer = http.createServer(app);
  const io = new SocketIoServer(httpServer, {
    cors: { origin: '*' },
  });

  io.on('connection', (socket) => {
    onLog('[natcom] client connected:', socket.id);
    socket.on('disconnect', (reason) => {
      onLog('[natcom] client disconnected:', socket.id, reason);
    });
  });

  httpServer.on('error', (err) => {
    // EADDRINUSE и подобные — не должны ронять весь Electron-процесс
    // (T5-112, диагностика типовых сбоев среды). Пока — просто лог, живая
    // диагностика для педагога добавится вместе с UI виджета (Эпик 6/12).
    onLog('[natcom] server error:', err && err.message);
  });

  // 0.0.0.0, не 'localhost' - иначе другие устройства школьной сети не
  // смогут подключиться к учительскому ПК по его IP, только сам плеер.
  httpServer.listen(port, '0.0.0.0', () => {
    onLog('[natcom] listening on 0.0.0.0:' + port);
  });

  function stop() {
    return new Promise((resolve) => {
      io.close(() => {
        httpServer.close(() => resolve());
      });
    });
  }

  return { httpServer, io, stop };
}

module.exports = { startNatComServer };
