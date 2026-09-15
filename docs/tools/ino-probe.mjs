// Печатает текст, видимый на экране приложения. Нужен разделу 10 программы
// испытаний: там проверяется не поведение кнопок, а то, ЧТО написано на экране
// после запуска с испорченными данными.
import http from 'node:http';
import ws from './KIOSK/packages/player/node_modules/ws/index.js';
const { WebSocket } = ws;

const PORT = Number(process.argv[2] || 9679);
const list = await new Promise((res, rej) =>
  http
    .get({ host: '127.0.0.1', port: PORT, path: '/json/list' }, (r) => {
      let s = '';
      r.on('data', (c) => (s += c));
      r.on('end', () => res(JSON.parse(s)));
    })
    .on('error', rej)
);
const page = list.filter((x) => x.type === 'page')[0];
const sock = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
await new Promise((r, j) => {
  sock.on('open', r);
  sock.on('error', j);
});
let id = 0;
const pending = new Map();
sock.on('message', (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
});
const send = (method, params = {}) =>
  new Promise((r) => {
    const i = ++id;
    pending.set(i, r);
    sock.send(JSON.stringify({ id: i, method, params }));
  });
await send('Runtime.enable');
await new Promise((r) => setTimeout(r, 900));
const res = await send('Runtime.evaluate', {
  expression: 'document.body.innerText',
  returnByValue: true,
});
console.log((res.result?.result?.value || '').replace(/\s+/g, ' ').trim());
sock.close();
