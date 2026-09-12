// Пакетная генерация иллюстраций слов через SYNTX.
//
// Каждая картинка — в СВОЁМ чате: перед запросом скрипт уходит на чистый
// адрес модели. Иначе продолжение в одном чате картинок не порождает вовсе
// (проверено дважды), а Remix здесь не нужен — предметы разные, согласованность
// нужна по стилю, а не по персонажу, и её держит общая часть промпта.
//
// Прогон резюмируемый: готовый файл пропускается. 24 генерации по минуте —
// это полчаса, и рассчитывать надо на обрыв.
//
// Запуск: node tools/generate-illustrations.mjs <порт CDP> <каталог-результатов>
//
// Требует открытого окна Chrome с отладочным портом, где выполнен вход в
// SYNTX. Chrome с версии 136 запрещает отладочный порт на профиле по
// умолчанию — нужен отдельный профиль.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ws from '../../player/node_modules/ws/index.js';
const { WebSocket } = ws;

const port = Number(process.argv[2]);
const outDir = path.resolve(process.argv[3]);
fs.mkdirSync(outDir, { recursive: true });

// Общая часть промпта держит единый стиль всего набора
const STYLE =
  'Плоская векторная иллюстрация для детского обучающего приложения, ' +
  'в стиле детской книжки: толстые чистые контуры, простые формы, ' +
  'ограниченная тёплая палитра, равномерное освещение, без теней и бликов. ' +
  'Предмет показан ЦЕЛИКОМ, строго по центру кадра, крупно, не обрезан краями. ' +
  'Фон — сплошной однородный пурпурный #FF00FF, без градиентов и узоров. ' +
  'Без текста, без надписей, без рамок, без подписей. ';

/** id → что рисуем. Тексты подобраны под ребёнка 4–8 лет */
const ITEMS = [
  // Цифры: крупная дружелюбная цифра плюс столько же предметов —
  // так карточка читается и как число, и как количество
  { id: '0000', what: 'большая цифра 1 и рядом один красный мячик' },
  { id: '0001', what: 'большая цифра 2 и рядом два красных мячика' },
  { id: '0002', what: 'большая цифра 3 и рядом три красных мячика' },
  { id: '0003', what: 'большая цифра 4 и рядом четыре красных мячика' },
  { id: '0004', what: 'большая цифра 5 и рядом пять красных мячиков' },
  // Моя комната
  { id: '0100', what: 'детская кровать с подушкой и одеялом, вид сбоку' },
  { id: '0101', what: 'деревянный стол, вид спереди' },
  { id: '0102', what: 'деревянный стул со спинкой, вид спереди' },
  { id: '0103', what: 'настольная лампа с абажуром' },
  { id: '0104', what: 'окно с рамой и занавесками, за стеклом голубое небо' },
  // Транспорт
  { id: '0200', what: 'городской автобус, вид сбоку' },
  { id: '0201', what: 'двухколёсный велосипед, вид сбоку' },
  { id: '0202', what: 'пассажирский самолёт в полёте, вид сбоку' },
  { id: '0203', what: 'маленький кораблик с парусом на волнах' },
  { id: '0204', what: 'поезд с локомотивом и вагоном, вид сбоку' },
  // Еда
  { id: '0300', what: 'красное яблоко с зелёным листиком' },
  { id: '0301', what: 'буханка хлеба' },
  { id: '0302', what: 'стакан молока' },
  { id: '0303', what: 'оранжевая морковка с зелёной ботвой' },
  { id: '0304', what: 'кусок жёлтого сыра с дырочками' },
];

/** Обложки тем — та же стилистика, но композиция из предметов темы */
const THEMES = [
  { id: 'theme-digits', what: 'весёлая композиция из цифр от 1 до 5 разных цветов' },
  { id: 'theme-my_room', what: 'уютная детская комната: кровать, стол, стул, лампа и окно' },
  { id: 'theme-transport', what: 'композиция из транспорта: автобус, велосипед, самолёт, кораблик и поезд' },
  { id: 'theme-food', what: 'композиция из продуктов: яблоко, хлеб, стакан молока, морковь и сыр' },
];

const ALL = [...ITEMS, ...THEMES];

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
    this.s = s; this.p = new Map();
    s.on('message', (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.id && this.p.has(m.id)) {
        const { resolve, reject } = this.p.get(m.id); this.p.delete(m.id);
        m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++seq;
    return new Promise((resolve, reject) => { this.p.set(id, { resolve, reject }); this.s.send(JSON.stringify({ id, method, params })); });
  }
  async evaluate(expression) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result.value;
  }
  async clickSel(sel) {
    const box = await this.evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(sel)});
      if (!el) return null;
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
    })()`);
    if (!box) throw new Error('нет элемента ' + sel);
    for (const type of ['mousePressed', 'mouseReleased']) {
      await this.send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1, buttons: type === 'mousePressed' ? 1 : 0, pointerType: 'mouse' });
    }
  }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const page = (await targets()).find((t) => t.type === 'page' && t.url.includes('syntx.ai'));
if (!page) { console.error('вкладка SYNTX не найдена'); process.exit(2); }
const sock = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
await new Promise((res, rej) => { sock.on('open', res); sock.on('error', rej); });
const cdp = new Cdp(sock);
await cdp.send('Runtime.enable');

let done = 0, skipped = 0, failed = 0;

for (const item of ALL) {
  const out = path.join(outDir, `${item.id}.jpg`);
  if (fs.existsSync(out) && fs.statSync(out).size > 5000) { skipped += 1; continue; }

  console.log(`[${done + skipped + failed + 1}/${ALL.length}] ${item.id}: ${item.what}`);

  // чистый чат под каждую картинку
  await cdp.evaluate(`location.href='https://syntx.ai/ru/image/banana'; 1`);
  // Ждём ФАКТИЧЕСКОЙ готовности, а не фиксированных секунд: после серии
  // перезагрузок SPA иногда надолго залипает на заставке, и любой фиксированный
  // сон оказывается то избыточным, то недостаточным.
  let ready = false;
  for (let i = 0; i < 30 && !ready; i += 1) {
    await wait(2000);
    ready = await cdp.evaluate(`!!document.querySelector('textarea') && !!document.querySelector('.send-actions__send')`);
  }
  if (!ready) { console.log('  страница не загрузилась'); failed += 1; continue; }
  await wait(1500);

  try {
    // Текст кладём НАТИВНЫМ СЕТТЕРОМ с событием input, а не кликом плюс
    // Input.insertText: клик для фокуса здесь ненадёжен — страница подмешивает
    // рекламные баннеры сверху и сдвигает вёрстку между замером координат и
    // самим кликом. Ровно из-за этого первый прогон встал: текст не попадал в
    // поле, кнопка отправки оставалась disabled, и скрипт впустую ждал
    // картинку по 150 секунд на каждом пункте.
    const text = STYLE + 'Нарисуй: ' + item.what + '.';
    const filled = await cdp.evaluate(`(() => {
      const ta = document.querySelector('textarea');
      if (!ta) return 'нет поля';
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      setter.call(ta, ${JSON.stringify(text)});
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      return ta.value.length;
    })()`);
    if (typeof filled !== 'number' || filled < 10) {
      console.log('  промпт не введён: ' + filled);
      failed += 1;
      continue;
    }
    await wait(600);

    // Проверять здесь b.disabled бесполезно: это гонка с перерисовкой Vue —
    // кнопка бывает ещё disabled, а нажатие уже проходит. Признак успеха
    // один и надёжный: очистившееся поле ввода после нажатия.

    // Отправляем через el.click(), а НЕ через Input.dispatchMouseEvent по
    // координатам: настоящий клик по центру кнопки здесь не срабатывал —
    // сообщение не уходило. Заметки проекта предупреждают об обратном случае
    // (синтетика не работает там, где слушают onMouseDown), но проверять надо
    // каждый раз: здесь сработало именно синтетическое нажатие.
    // Отправка с повтором: признак успеха — очистившееся поле ввода
    let sent = false;
    for (let attempt = 1; attempt <= 3 && !sent; attempt += 1) {
      await cdp.evaluate(`(() => { const b=document.querySelector('.send-actions__send'); if (b) b.click(); return 1; })()`);
      await wait(2500);
      sent = await cdp.evaluate(`(() => {
        const ta = document.querySelector('textarea');
        return !ta || ta.value.trim().length === 0;
      })()`);
      if (!sent) console.log(`  попытка ${attempt}: сообщение не ушло`);
    }
    if (!sent) { failed += 1; continue; }

    let url = null;
    for (let i = 0; i < 50; i += 1) {
      await wait(3000);
      const found = await cdp.evaluate(
        `[...document.querySelectorAll('img')].map(i=>i.getAttribute('src')||'').filter(s=>/generated/.test(s))`
      );
      if (found.length) { url = found[found.length - 1]; break; }
    }
    if (!url) { console.log('  не дождался'); failed += 1; continue; }

    execFileSync('curl', ['-sL', '-o', out, url.replace(/_500(\.\w+)$/, '$1')]);
    const size = fs.statSync(out).size;
    if (size < 5000) { console.log('  файл мал: ' + size); fs.unlinkSync(out); failed += 1; continue; }
    console.log(`  готово, ${(size / 1024).toFixed(0)} КБ`);
    done += 1;
  } catch (err) {
    console.log('  сбой: ' + err.message);
    failed += 1;
  }
}

sock.close();
console.log(`\nИТОГ: сгенерировано ${done}, пропущено готовых ${skipped}, не удалось ${failed}`);
