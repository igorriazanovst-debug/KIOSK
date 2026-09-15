// Отрисовка ПОДЛОЖКИ сцены в PNG — чтобы посмотреть на фон глазами.
//
// ВНИМАНИЕ, ЧЕГО ЭТОТ СНИМОК НЕ ПОКАЗЫВАЕТ. Он открывает файл подложки через
// `file://`, а приложение грузит её своим протоколом `inophonelib://`, где
// весь путь закодирован одним куском. Разница уже стоила дефекта, дошедшего
// до пользователя: подложка ссылалась на рисунки предметов относительным
// путём, через `file://` они подхватывались, а в приложении не грузился ни
// один — поле было пустым.
//
// Поэтому: СЦЕНУ ЦЕЛИКОМ смотреть снимком ИЗ ПРИЛОЖЕНИЯ (`ino-shot2.mjs`),
// а этим скриптом — только фон.
//
// Запуск: node ino-render.mjs <id сцены>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ws from './KIOSK/packages/player/node_modules/ws/index.js';
const { WebSocket } = ws;

const sceneId = process.argv[2] || 'bedroom';
const svgPath = path.resolve('KIOSK/packages/inophone-library/assets/img/scenes', `${sceneId}.svg`);
if (!fs.existsSync(svgPath)) {
  console.error(`нет такой сцены: ${svgPath}`);
  process.exit(1);
}

const list = await new Promise((res, rej) =>
  http
    .get({ host: '127.0.0.1', port: 9444, path: '/json/list' }, (r) => {
      let s = '';
      r.on('data', (c) => (s += c));
      r.on('end', () => res(JSON.parse(s)));
    })
    .on('error', rej)
);
const page = list.find((t) => t.type === 'page');
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
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 1280,
  height: 800,
  deviceScaleFactor: 1,
  mobile: false,
});
await send('Page.navigate', { url: pathToFileURL(svgPath).href });
// Картинки понятий подтягиваются отдельными запросами — четырёх секунд хватает
// на все двенадцать
await wait(4000);
const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(`scene-${sceneId}.png`, Buffer.from(shot.result.data, 'base64'));
await send('Emulation.clearDeviceMetricsOverride');
console.log(`снято: scene-${sceneId}.png`);
sock.close();
