// docs/tools/shoot-chimiq.js
//
// Снимки экранов для chimiq-user-guide.md — тот же принцип, что у shoot.mjs
// (см. docs/tools/README.md): снимки делаются СЦЕНАРИЕМ, а не вручную, иначе
// инструкция молча устаревает при первой же правке интерфейса.
//
// В отличие от shoot.mjs (свой JSON-DSL "клик"/"ввод"/"жди") этот скрипт —
// прямой Node-драйвер по CDP, написанный для одноразового прогона Фазы
// документации ХимIQ (2026-09-15). Не переписан в JSON-DSL shoot.mjs
// сознательно: экраны chimiq используют смесь текстовых селекторов и
// aria-label (клетки игрового поля), а не сплошные data-testid, как
// alphabet/words - подгонять DSL под другой набор селекторов ради одного
// прогона было бы лишней работой. Сохранён здесь, а не как разовый скрипт в
// scratchpad, именно чтобы не повторить урок README: "первые 618 файлов
// контента Типа 3 сделал разовый скрипт, не сохранившийся в репозитории".
//
// ПОДГОТОВКА (вручную, см. §13 Сценарий_разработки_фичи.md - протокол
// подмены project.json - здесь не автоматизирована):
//   1. Собрать packages/player с TEST-ONLY project.json (canvas + один
//      виджет "chimiq", БЕЗ serverUrl/licenseKeyHash) - `npm run package`.
//      widget.properties ДОЛЖНО быть объектом ({} минимум) - Player.tsx
//      безусловно читает widget.properties.opacity, отсутствие ключа
//      (например "props" вместо "properties") роняет рендер целиком с
//      TypeError ещё до первого кадра (найдено 2026-09-16).
//   2. Немедленно восстановить реальный electron/project.json.
//   3. Очистить %AppData%\kiosk-chimiq (чистое состояние - см. restand.sh
//      идею у alphabet/words, здесь сделано вручную: Remove-Item).
//   4. Start-Process ".../dist-electron/win-unpacked/Kiosk Player.exe"
//      -ArgumentList "--remote-debugging-port=9333"
//   5. GET http://127.0.0.1:9333/json -> взять webSocketDebuggerUrl
//      страницы type:"page" И её PID процесса (см. §16 ниже).
//
// ЗАПУСК:
//   node shoot-chimiq.js "ws://127.0.0.1:9333/devtools/page/<ID>" <PID>
//
// Снимки сохраняются в ../img/chimiq/ (докидываются поверх существующих
// с теми же именами).
//
// СКРИНШОТ ЧЕРЕЗ GDI, НЕ CDP (найдено 2026-09-16, регенерация для раунда
// тематических иллюстраций). `Page.captureScreenshot` по сырому CDP-
// вебсокету здесь повторно ЗАВИСАЛ намертво (см. Сценарий_разработки_фичи.md
// §5a - известная проблема, не связана с кодом фичи) - весь скрипт стопорился
// на первом же screenshot('01-интро'), окно оставалось живым и отвечающим на
// Runtime.evaluate. Заменено на `gdi-screenshot.ps1` (Win32 GDI, по PID
// процесса окна) - тот же CDP-driver для кликов/чтения DOM, другой механизм
// снятия картинки. Обязателен второй аргумент CLI - PID главного процесса
// окна (Get-CimInstance/Get-Process, НЕ дочерние --type=renderer/gpu/utility).

const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const WebSocket = require(path.join(__dirname, '..', '..', 'packages', 'player', 'node_modules', 'ws'));

const WS_URL = process.argv[2];
const PID = process.argv[3];
if (!WS_URL || !PID) {
  console.error('нужны аргументы: ws:// URL страницы И PID главного процесса окна (см. GET http://127.0.0.1:9333/json и Get-Process)');
  process.exit(2);
}
const OUT_DIR = path.join(__dirname, '..', 'img', 'chimiq');
const GDI_SCRIPT = path.join(__dirname, 'gdi-screenshot.ps1');
fs.mkdirSync(OUT_DIR, { recursive: true });

const ws = new WebSocket(WS_URL);
let id = 1;
function send(method, params) {
  return new Promise((resolve, reject) => {
    const myId = id++;
    const handler = (msg) => {
      const data = JSON.parse(msg);
      if (data.id === myId) {
        ws.off('message', handler);
        if (data.error) reject(new Error(JSON.stringify(data.error)));
        else resolve(data);
      }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id: myId, method, params }));
  });
}

async function evalJs(expression, awaitPromise = false) {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
  if (res.result.exceptionDetails) throw new Error(JSON.stringify(res.result.exceptionDetails));
  return res.result.result.value;
}

async function screenshot(name) {
  const outPath = path.join(OUT_DIR, `${name}.png`);
  const out = execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', GDI_SCRIPT, '-ProcessId', PID, '-OutPath', outPath], { encoding: 'utf8' });
  console.log('saved', name, '->', out.trim());
}

async function click(selector) {
  const ok = await evalJs(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`);
  if (!ok) throw new Error('selector not found: ' + selector);
}

async function clickByText(tag, text) {
  const ok = await evalJs(`(() => {
    const els = Array.from(document.querySelectorAll(${JSON.stringify(tag)}));
    const el = els.find(e => e.textContent.trim() === ${JSON.stringify(text)});
    if (!el) return false;
    el.click();
    return true;
  })()`);
  if (!ok) throw new Error(`text not found: ${tag} "${text}"`);
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  await send('Page.enable', {});
  await send('Runtime.enable', {});
  await sleep(300);
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await sleep(200);

  await screenshot('01-интро');

  await clickByText('button', 'Справочные материалы');
  await sleep(300);
  await screenshot('02-справочные-материалы');

  await evalJs(`document.querySelectorAll('.ciq-page-medium button.ciq-btn-muted')[0].click()`);
  await sleep(300);
  await screenshot('03-справочные-деталь');
  await clickByText('button', 'Назад к списку');
  await sleep(200);
  await clickByText('button', 'Назад');
  await sleep(300);

  await clickByText('button', 'Играть!');
  await sleep(300);
  await screenshot('04-число-игроков');

  await evalJs(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === '1' && b.className.includes('tile')).click()`);
  await sleep(200);
  await clickByText('button', 'Далее');
  await sleep(200);
  await screenshot('05-уровень');

  await clickByText('button', 'Начинающий');
  await sleep(200);
  await screenshot('06-число-вопросов');

  await evalJs(`document.querySelectorAll('.ciq-btn-tile')[0].click()`);
  await sleep(400);
  await screenshot('07-игровое-поле');

  for (let i = 0; i < 20; i++) {
    const onResults = await evalJs(`document.body.innerText.includes('Результаты')`);
    if (onResults) break;
    const hasPoint = await evalJs(`!!document.querySelector('[data-testid="correct-point"]')`);
    if (!hasPoint) break;
    await click('[data-testid="correct-point"]');
    await sleep(1100);
  }
  await screenshot('08-результаты');

  await clickByText('button', 'Подробнее');
  await sleep(200);
  await screenshot('09-детализация');
  await clickByText('button', 'Назад к результатам');
  await sleep(200);
  await clickByText('button', 'Новая игра');
  await sleep(300);

  await clickByText('button', 'Режим учителя');
  await sleep(300);
  await screenshot('10-pin-учителя');

  await evalJs(`(() => {
    const inputs = document.querySelectorAll('input.ciq-input-pin');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(inputs[0], '1234'); inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    setter.call(inputs[1], '1234'); inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await sleep(200);
  await clickByText('button', 'Задать');
  await sleep(400);
  await screenshot('11-каталог-викторин');

  await clickByText('button', 'Статистика по дням');
  await sleep(300);
  await screenshot('12-статистика-по-дням');
}

ws.on('open', () => {
  main().then(() => { console.log('DONE'); process.exit(0); }).catch((err) => { console.error('ERROR', err.message); process.exit(1); });
});
