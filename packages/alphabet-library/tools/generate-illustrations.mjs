// packages/alphabet-library/tools/generate-illustrations.mjs
// Пакетная генерация иллюстраций слов через SYNTX.
//
// Перенесено из words-library (Тип 2) и отличается ровно двумя вещами:
// список берётся из illustration-prompts.mjs этого пакета, и он в пять раз
// длиннее — 95 картинок против 24. Копия, а не общий модуль: в Тип 2 сюда
// вшит список предметов, и вынести общее значило бы переписывать работающий
// скрипт ради одной константы. Общей осталась вся суть — см. оригинал.
//
// КАЖДАЯ КАРТИНКА — В СВОЁМ ЧАТЕ: перед запросом скрипт уходит на чистый
// адрес модели. Иначе продолжение в одном чате картинок не порождает вовсе
// (проверено дважды в Тип 2). Remix здесь не нужен — предметы разные,
// согласованность нужна по стилю, и её держит общая часть промпта.
//
// Прогон резюмируемый: готовый файл пропускается. 95 генераций по минуте —
// это полтора часа, и рассчитывать надо на обрыв, а не на один проход.
//
// Запуск: node tools/generate-illustrations.mjs <порт CDP> <каталог-результатов> [сколько]
//
// Требует открытого окна Chrome с отладочным портом, где выполнен вход в
// SYNTX. Chrome с версии 136 запрещает отладочный порт на профиле по
// умолчанию — нужен отдельный профиль.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ws from '../../player/node_modules/ws/index.js';
import { STYLE, PROMPTS } from './illustration-prompts.mjs';

const { WebSocket } = ws;

const port = Number(process.argv[2]);
const outDir = path.resolve(process.argv[3]);
/**
 * Сколько ПОПЫТОК сделать за прогон; без ограничения — все оставшиеся.
 *
 * Именно попыток, а не успехов. Первая версия считала успехи, и пробный
 * прогон «на одну картинку» при трёх неудачах подряд молча пошёл дальше по
 * списку и сжёг девять минут.
 */
const limit = process.argv[4] ? Number(process.argv[4]) : Infinity;
fs.mkdirSync(outDir, { recursive: true });

const ALL = Object.entries(PROMPTS).map(([id, what]) => ({ id, what }));

function targets() {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: '/json/list' }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
}

let seq = 0;
class Cdp {
  constructor(s) {
    this.s = s;
    this.p = new Map();
    s.on('message', (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.id && this.p.has(m.id)) {
        const { resolve, reject } = this.p.get(m.id);
        this.p.delete(m.id);
        m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++seq;
    return new Promise((resolve, reject) => {
      this.p.set(id, { resolve, reject });
      this.s.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const r = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result.value;
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const page = (await targets()).find((t) => t.type === 'page' && t.url.includes('syntx.ai'));
if (!page) {
  console.error('вкладка SYNTX не найдена');
  process.exit(2);
}
const sock = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
await new Promise((res, rej) => {
  sock.on('open', res);
  sock.on('error', rej);
});
const cdp = new Cdp(sock);
await cdp.send('Runtime.enable');

let done = 0;
let skipped = 0;
let failed = 0;
const failures = [];

for (const item of ALL) {
  if (done + failed >= limit) break;
  const out = path.join(outDir, `${item.id}.jpg`);
  if (fs.existsSync(out) && fs.statSync(out).size > 5000) {
    skipped += 1;
    continue;
  }

  console.log(`[${done + failed + 1}] ${item.id}: ${item.what}`);

  await cdp.evaluate(`location.href='https://syntx.ai/ru/image/banana'; 1`);
  // Ждём ФАКТИЧЕСКОЙ готовности, а не фиксированных секунд: после серии
  // перезагрузок SPA иногда надолго залипает на заставке, и любой
  // фиксированный сон оказывается то избыточным, то недостаточным
  let ready = false;
  for (let i = 0; i < 30 && !ready; i += 1) {
    await wait(2000);
    try {
      ready = await cdp.evaluate(
        `!!document.querySelector('textarea') && !!document.querySelector('.send-actions__send')`
      );
    } catch {
      ready = false;
    }
  }
  if (!ready) {
    console.log('  страница не загрузилась');
    failed += 1;
    failures.push(item.id);
    continue;
  }
  await wait(1500);

  try {
    // Текст кладём НАТИВНЫМ СЕТТЕРОМ с событием input, а не кликом плюс
    // Input.insertText: клик для фокуса здесь ненадёжен — страница подмешивает
    // баннеры сверху и сдвигает вёрстку между замером координат и кликом
    const text = `${STYLE}Нарисуй: ${item.what}.`;
    const filled = await cdp.evaluate(`(() => {
      const ta = document.querySelector('textarea');
      if (!ta) return 'нет поля';
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      setter.call(ta, ${JSON.stringify(text)});
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      return ta.value.length;
    })()`);
    if (typeof filled !== 'number' || filled < 10) {
      console.log(`  промпт не введён: ${filled}`);
      failed += 1;
      failures.push(item.id);
      continue;
    }
    await wait(600);

    // Отправляем через el.click(), а НЕ настоящим кликом по координатам:
    // в Тип 2 настоящий клик по этой кнопке не срабатывал. Признак успеха
    // один надёжный — очистившееся поле ввода; проверять b.disabled
    // бесполезно, это гонка с перерисовкой Vue
    let sent = false;
    for (let attempt = 1; attempt <= 3 && !sent; attempt += 1) {
      await cdp.evaluate(
        `(() => { const b=document.querySelector('.send-actions__send'); if (b) b.click(); return 1; })()`
      );
      await wait(2500);
      sent = await cdp.evaluate(`(() => {
        const ta = document.querySelector('textarea');
        return !ta || ta.value.trim().length === 0;
      })()`);
      if (!sent) console.log(`  попытка ${attempt}: сообщение не ушло`);
    }
    if (!sent) {
      failed += 1;
      failures.push(item.id);
      continue;
    }

    // Ждём до пяти минут. Замерено: картинка приходит примерно через 90 с,
    // но под нагрузкой сервиса очередь растягивается, а обрыв ожидания стоит
    // дороже лишнего ожидания — генерация уже оплачена кредитами
    let url = null;
    for (let i = 0; i < 100; i += 1) {
      await wait(3000);
      const found = await cdp.evaluate(
        `[...document.querySelectorAll('img')].map(i=>i.getAttribute('src')||'').filter(s=>/generated/.test(s))`
      );
      if (found.length) {
        url = found[found.length - 1];
        break;
      }
      if (i > 0 && i % 10 === 0) console.log(`  жду ${i * 3} с…`);
    }
    if (!url) {
      console.log('  не дождался');
      failed += 1;
      failures.push(item.id);
      continue;
    }

    execFileSync('curl', ['-sL', '-o', out, url.replace(/_500(\.\w+)$/, '$1')]);
    const size = fs.statSync(out).size;
    if (size < 5000) {
      console.log(`  файл мал: ${size}`);
      fs.unlinkSync(out);
      failed += 1;
      failures.push(item.id);
      continue;
    }
    console.log(`  готово, ${(size / 1024).toFixed(0)} КБ`);
    done += 1;
  } catch (err) {
    console.log(`  сбой: ${err.message}`);
    failed += 1;
    failures.push(item.id);
  }
}

sock.close();
console.log(`\nИТОГ: сгенерировано ${done}, пропущено готовых ${skipped}, не удалось ${failed}`);
if (failures.length) console.log(`не получились: ${failures.join(', ')}`);
console.log(`всего в каталоге: ${fs.readdirSync(outDir).filter((f) => f.endsWith('.jpg')).length} из ${ALL.length}`);
