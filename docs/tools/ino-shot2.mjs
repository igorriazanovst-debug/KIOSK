// Снимок сцены ИЗ САМОГО ПРИЛОЖЕНИЯ, а не из файла подложки.
import http from 'node:http';
import fs from 'node:fs';
import ws from './KIOSK/packages/player/node_modules/ws/index.js';
const { WebSocket } = ws;
const mode = process.argv[2] || 'training';
const list = await new Promise((res, rej) =>
  http.get({ host: '127.0.0.1', port: 9679, path: '/json/list' }, (r) => {
    let s = ''; r.on('data', (c) => (s += c)); r.on('end', () => res(JSON.parse(s)));
  }).on('error', rej));
const sock = new WebSocket(list.filter((x) => x.type === 'page')[0].webSocketDebuggerUrl, { perMessageDeflate: false });
await new Promise((r, j) => { sock.on('open', r); sock.on('error', j); });
let id = 0; const pending = new Map();
sock.on('message', (raw) => { const m = JSON.parse(raw.toString()); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); sock.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => {
  const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'ошибка');
  return r.result?.result?.value;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = async (sel) => {
  const b = await ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null;
    el.scrollIntoView({block:'center'}); const r = el.getBoundingClientRect();
    return r.width ? { x: Math.round(r.left+r.width/2), y: Math.round(r.top+r.height/2) } : null; })()`);
  if (!b) throw new Error('нет элемента ' + sel);
  for (const type of ['mousePressed','mouseReleased'])
    await send('Input.dispatchMouseEvent', { type, x: b.x, y: b.y, button: 'left', clickCount: 1 });
  await wait(350);
};
const t = (x) => `[data-testid="${x}"]`;
await send('Runtime.enable');
await send('Page.enable');
await wait(600);
const sc = await ev(`document.querySelector('[data-scene]').dataset.scene`);
if (sc === 'profiles') {
  const has = await ev(`!!document.querySelector('[data-testid^="inophone-profile-"]')`);
  if (!has) {
    await ev(`(() => { const el=document.querySelector('[data-testid=inophone-new-profile]');
      const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
      s.call(el,'Проверка'); el.dispatchEvent(new Event('input',{bubbles:true})); })()`);
    await click(t('inophone-create-profile'));
  }
  await click(t(await ev(`document.querySelector('[data-testid^="inophone-profile-"]').dataset.testid`)));
}
await click(t('inophone-scene-bedroom'));
await click(t(`inophone-mode-${mode}`));
if (mode !== 'learning') await click(t('inophone-count-5'));
await click(t('inophone-start'));
await wait(2500);
const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(`app-${mode}.png`, Buffer.from(shot.result.data, 'base64'));
console.log('снято: app-' + mode + '.png');
sock.close();
