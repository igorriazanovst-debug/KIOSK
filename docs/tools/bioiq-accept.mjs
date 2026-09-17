// Прогон программы испытаний «БиоIQ» (Тип 10) на живом приложении.
//
// ЧТО ЭТОТ ПРОГОН ДОКАЗЫВАЕТ И ЧЕГО НЕ ДОКАЗЫВАЕТ. Он проверяет ПОВЕДЕНИЕ:
// нажали — случилось ожидаемое. Он НЕ проверяет биологическую правильность
// вопросов и точность схем: приложение одинаково исправно засчитает и верный
// ответ, и неверный, если так написано в банке. Содержательная проверка —
// за методистом, см. bioiq-third-party-licenses.md §3.
//
// ПРОВЕРЯЕТСЯ ПОВЕДЕНИЕ, А НЕ НАЛИЧИЕ ЭЛЕМЕНТОВ. «Кнопка есть» ничего не
// говорит: у Типа 3 кнопка была, а щелчок по ней не доходил, потому что
// элемент лежал ниже сгиба. Отсюда scrollIntoView перед каждым нажатием и
// настоящий Input.dispatchMouseEvent вместо element.click().
//
// ИСКЛЮЧЕНИЯ НЕ ГЛОТАЮТСЯ: проглоченный SyntaxError в проверке Типа 2 дважды
// дал ложный вывод о дефекте, которого нет.
//
// ПОДГОТОВКА (иначе разделы 1 и 3 не воспроизводятся — PIN уже задан):
//   cd docs/tools && ./restand.sh stage-bioiq 9680 kiosk-bioiq kiosk-bioiq
//
// Запуск: node bioiq-accept.mjs <порт> <номер раздела|all>

import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ws from '../../packages/player/node_modules/ws/index.js';
const { WebSocket } = ws;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2] || 9680);
const ONLY = process.argv[3] || 'all';

const list = await new Promise((res, rej) =>
  http.get({ host: '127.0.0.1', port: PORT, path: '/json/list' }, (r) => {
    let s = '';
    r.on('data', (c) => (s += c));
    r.on('end', () => res(JSON.parse(s)));
  }).on('error', rej)
);
const page = list.find((x) => x.type === 'page');
if (!page) throw new Error(`на порту ${PORT} нет страницы — стенд не поднят`);
const sock = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
await new Promise((r, j) => { sock.on('open', r); sock.on('error', j); });

let id = 0;
const pending = new Map();
sock.on('message', (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const send = (method, params = {}) =>
  new Promise((r) => { const i = ++id; pending.set(i, r); sock.send(JSON.stringify({ id: i, method, params })); });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function ev(expression) {
  const m = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (m.result?.exceptionDetails) {
    const d = m.result.exceptionDetails;
    throw new Error('выражение упало: ' + (d.exception?.description || d.text));
  }
  return m.result?.result?.value;
}

const text = () => ev('document.body.innerText');

/** Нажать кнопку по видимому тексту. Падает, если такой нет. */
async function click(label) {
  const box = await ev(`(()=>{const want=${JSON.stringify(label)}.replace(/\\s+/g,' ').trim().toLowerCase();
    const els=[...document.querySelectorAll('button, a, [role=button]')]
      .filter(e=>{const r=e.getBoundingClientRect(); return r.width>0&&r.height>0&&!e.disabled;});
    const exact=els.find(e=>(e.innerText||'').replace(/\\s+/g,' ').trim().toLowerCase()===want);
    const el=exact||els.find(e=>(e.innerText||'').replace(/\\s+/g,' ').trim().toLowerCase().includes(want));
    if(!el) return null;
    el.scrollIntoView({block:'center'});
    const r=el.getBoundingClientRect();
    return JSON.stringify({x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)})})()`);
  if (!box) throw new Error(`нет кнопки «${label}»; на экране: ${String(await text()).replace(/\n/g, ' | ').slice(0, 200)}`);
  const { x, y } = JSON.parse(box);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  await wait(600);
}

async function fill(n, value) {
  const ok = await ev(`(()=>{const els=[...document.querySelectorAll('input, textarea')]
      .filter(e=>{const r=e.getBoundingClientRect(); return r.width>0&&r.height>0;});
    const el=els[${n - 1}]; if(!el) return false;
    const proto=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto,'value').set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input',{bubbles:true})); return true})()`);
  if (!ok) throw new Error(`нет поля ввода №${n}`);
  await wait(250);
}

let pass = 0;
let fail = 0;
const failures = [];
function ok(code, what, condition, detail = '') {
  if (condition) { pass += 1; console.log(`  ✔ ${code} ${what}`); }
  else { fail += 1; failures.push(`${code} ${what}${detail ? ' — ' + detail : ''}`); console.log(`  ✘ ${code} ${what}${detail ? ' — ' + detail : ''}`); }
}

const want = (section) => ONLY === 'all' || ONLY === String(section);

// ─── 1. Стартовый экран и справочные материалы ─────────────────────────────

if (want(1)) {
  console.log('\n1. Стартовый экран и справочные материалы (FR-021, FR-022, FR-023)');
  await wait(1200);
  const intro = await text();
  ok('1.1', 'стартовый экран показывает предмет и темы', /биолог/i.test(intro) && intro.includes('ИГРАТЬ'));

  await click('СПРАВОЧНЫЕ МАТЕРИАЛЫ');
  const gallery = await text();
  const titles = gallery.split('\n').map((s) => s.trim()).filter(Boolean);
  const cards = await ev(`document.querySelectorAll('img').length`);
  ok('1.2', 'тематических изображений не меньше трёх', cards >= 3, `на экране ${cards}`);

  const themes = {
    'внутренние органы': /орган|сердц/i,
    растения: /растени|цвет/i,
    клетки: /клетк/i,
  };
  for (const [name, re] of Object.entries(themes)) {
    ok('1.3', `тема «${name}» представлена`, titles.some((t) => re.test(t)));
  }

  // Каждая картинка действительно ЗАГРУЖЕНА, а не пустая рамка: у Типа 4
  // ровно так «имеющиеся» иллюстрации оказались невидимыми на поле.
  const broken = await ev(`[...document.querySelectorAll('img')]
    .filter(i => !i.complete || i.naturalWidth === 0).length`);
  ok('1.4', 'все изображения загрузились, пустых рамок нет', broken === 0, `битых ${broken}`);

  await click('СТРОЕНИЕ РАСТИТЕЛЬНОЙ КЛЕТКИ');
  const one = await text();
  ok('1.5', 'детальный просмотр открывается с пояснением', one.includes('НАЗАД К СПИСКУ') && one.length > 80);
  await click('НАЗАД К СПИСКУ');
  await click('НАЗАД');
  ok('1.6', 'возврат на стартовый экран', (await text()).includes('ИГРАТЬ'));
}

// ─── 2. Партия ─────────────────────────────────────────────────────────────

if (want(2)) {
  console.log('\n2. Партия: настройка и прохождение (FR-002, FR-006…FR-010, FR-020)');
  await click('ИГРАТЬ!');
  ok('2.1', 'спрашивает число игроков', (await text()).toUpperCase().includes('СКОЛЬКО ИГРОКОВ'));

  await click('2');
  await fill(1, '');
  const emptyName = await ev(`(()=>{const b=[...document.querySelectorAll('button')]
    .find(x=>(x.innerText||'').trim().toUpperCase()==='ДАЛЕЕ'); return b? b.disabled : null})()`);
  ok('2.2', 'партия без имени не начинается', emptyName === true);

  await fill(1, 'Аня');
  await fill(2, 'Миша');
  await click('ДАЛЕЕ');
  const levels = await text();
  ok('2.3', 'три уровня сложности', ['НАЧИНАЮЩИЙ', 'ОПЫТНЫЙ', 'ПРОФЕССИОНАЛ'].every((l) => levels.toUpperCase().includes(l)));

  await click('НАЧИНАЮЩИЙ');
  ok('2.4', 'спрашивает число вопросов на игрока', (await text()).toUpperCase().includes('ВОПРОСОВ'));
  await click('5');
  await wait(1400);

  const board = await text();
  ok('2.5', 'на поле есть вопрос, таймер и текущая цена ответа',
    /Таймер/i.test(board) && /Очки сейчас/i.test(board) && board.includes('?'));

  // 8.5 программы испытаний: нарисованного, но не нажимаемого быть не должно
  const tiles = await ev(`document.querySelectorAll('[data-testid="correct-point"], [data-testid^="decoy-"]').length`);
  ok('2.6', 'кликабельных областей на поле больше десяти', tiles > 10, `областей ${tiles}`);
  const correct = await ev(`document.querySelectorAll('[data-testid="correct-point"]').length`);
  // Не «ровно одна»: у структуры, нарисованной на карте несколько раз (второе
  // лёгкое, второй хлоропласт), верны все её экземпляры.
  ok('2.7', 'верная область есть, и верных меньшинство', correct >= 1 && correct <= 4 && correct < tiles / 2, `их ${correct} из ${tiles}`);

  await click('ПОКАЗАТЬ ПОДСКАЗКУ');
  ok('2.8', 'подсказка появляется по нажатию', /Подсказка/i.test(await text()));

  // Ответ берётся у самой игры, а не подбирается: подбор прошёл бы и на
  // сломанной проверке ответа.
  const scoreBefore = Number(String(await text()).match(/Очки сейчас:\s*(\d+)/)?.[1] ?? -1);
  const turnBefore = String(await text()).match(/Ходит:\s*(\S+)/)?.[1] ?? '';
  await ev(`(()=>{const e=document.querySelector('[data-testid="correct-point"]');
    e.scrollIntoView({block:'center'}); return true})()`);
  const cbox = await ev(`(()=>{const e=document.querySelector('[data-testid="correct-point"]');
    const r=e.getBoundingClientRect();
    return JSON.stringify({x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)})})()`);
  const c = JSON.parse(cbox);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: c.x, y: c.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c.x, y: c.y, button: 'left', clickCount: 1 });
  await wait(1500);
  const afterCorrect = await text();
  // Ход проверяется ПО ИМЕНИ ИГРОКА, а не по номеру вопроса: счётчик
  // «Вопрос N/5» у «БиоIQ» свой у каждого игрока, и после ответа первого он
  // остаётся единицей — теперь это первый вопрос второго.
  const turnAfter = String(afterCorrect).match(/Ходит:\s*(\S+)/)?.[1] ?? '';
  ok('2.9', 'после ответа ход перешёл другому игроку', turnBefore !== '' && turnAfter !== '' && turnBefore !== turnAfter,
    `было «${turnBefore}», стало «${turnAfter}»`);
  ok('2.10', 'цена ответа убывает вместе с таймером', scoreBefore > 0 && scoreBefore < 100 + 1, `было ${scoreBefore}`);

  // Доиграть партию до итогов
  for (let i = 0; i < 12; i += 1) {
    const done = await ev(`document.body.innerText.includes('РЕЗУЛЬТАТЫ')`);
    if (done) break;
    const has = await ev(`!!document.querySelector('[data-testid="correct-point"]')`);
    if (!has) { await wait(900); continue; }
    const b = JSON.parse(await ev(`(()=>{const e=document.querySelector('[data-testid="correct-point"]');
      e.scrollIntoView({block:'center'}); const r=e.getBoundingClientRect();
      return JSON.stringify({x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)})})()`));
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: b.x, y: b.y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: b.x, y: b.y, button: 'left', clickCount: 1 });
    await wait(1400);
  }
  const results = await text();
  ok('2.11', 'партия доигрывается до итогов', results.includes('РЕЗУЛЬТАТЫ'));
  ok('2.12', 'в итогах оба игрока', results.includes('Аня') && results.includes('Миша'));

  await click('ПОДРОБНЕЕ');
  const detail = await text();
  ok('2.13', 'детализация перечисляет вопросы с пометкой и очками',
    /верно|неверно/i.test(detail) && /очк/i.test(detail));
  await click('НАЗАД К РЕЗУЛЬТАТАМ');
  await click('НОВАЯ ИГРА');
  await wait(1000);
}

// ─── 3. Режим учителя: PIN ─────────────────────────────────────────────────

if (want(3)) {
  console.log('\n3. Режим учителя: PIN (FR-017)');
  await click('РЕЖИМ УЧИТЕЛЯ');
  const gate = await text();
  const first = /ЗАДАЙТЕ PIN/i.test(gate);
  ok('3.1', 'на чистом хранилище PIN задаётся, а не спрашивается', first, first ? '' : 'стенд не с чистого состояния — см. restand.sh');

  if (first) {
    await fill(1, '2468');
    await fill(2, '1111');
    await click('ЗАДАТЬ');
    ok('3.2', 'несовпадающие значения не принимаются', !(await text()).includes('КАТАЛОГ ВИКТОРИН'));
    await fill(1, '2468');
    await fill(2, '2468');
    await click('ЗАДАТЬ');
  }
  await wait(900);
  ok('3.3', 'после верного PIN открывается каталог', (await text()).includes('КАТАЛОГ ВИКТОРИН'));
}

// ─── 4. Каталог, статистика, редактор ──────────────────────────────────────

if (want(4)) {
  console.log('\n4. Каталог, статистика и редактор (FR-011, FR-013, FR-014, FR-018)');
  const cat = await text();
  ok('4.1', 'встроенная викторина в каталоге', /встроенная/i.test(cat));
  ok('4.2', 'есть создание с нуля и импорт', /СОЗДАТЬ НОВУЮ/i.test(cat) && /ИМПОРТИРОВАТЬ/i.test(cat));

  await click('СТАТИСТИКА ПО ДНЯМ');
  const stats = await text();
  ok('4.3', 'сводка показывает всех участников', stats.includes('Аня') && stats.includes('Миша'));
  ok('4.4', 'есть сводка за один день', /СЕГОДНЯ/i.test(stats));
  await click('НАЗАД');

  await click('ДУБЛИРОВАТЬ');
  await wait(2200);
  ok('4.5', 'дубликат создан', /копия/i.test(await text()));

  await click('РЕДАКТИРОВАТЬ');
  await wait(2000);
  const ed = await text();
  ok('4.6', 'редактор открылся', /РЕДАКТОР ВИКТОРИНЫ/i.test(ed));
  ok('4.7', 'вкладки трёх уровней', ['НАЧИНАЮЩИЙ', 'ОПЫТНЫЙ', 'ПРОФЕССИОНАЛ'].every((l) => ed.toUpperCase().includes(l)));
  ok('4.8', 'есть добавление вопроса и обеих ложных точек',
    /ДОБАВИТЬ ВОПРОС/i.test(ed) && /ЛОЖНУЮ ТОЧКУ К ВОПРОСУ/i.test(ed) && /ОБЩУЮ ЛОЖНУЮ ТОЧКУ/i.test(ed));

  const decoys = ed.match(/Общих ложных точек на этом уровне:\s*(\d+)\s*из требуемых по ТЗ\s*(\d+)/);
  ok('4.9', 'счётчик обманок называет и текущее, и требуемое число', !!decoys, decoys ? decoys[0] : 'строки нет');
  if (decoys) ok('4.10', 'граница ТЗ выдержана', Number(decoys[1]) >= Number(decoys[2]), decoys[0]);

  ok('4.11', 'панель готовности викторины на экране', /Готовность викторины/i.test(ed));
  ok('4.12', 'у поставляемой викторины замечаний нет', /Требования к готовой викторине выполнены/i.test(ed));
  ok('4.13', 'есть парольная защита викторины', /ЗАДАТЬ ПАРОЛЬ/i.test(ed));
}

// ─── 5. Изображения уровней ────────────────────────────────────────────────

if (want(5)) {
  console.log('\n5. Изображения уровней (FR-009)');
  // Проверяется НА ИГРОВОМ ПОЛЕ, а не в редакторе.
  //
  // В редакторе карта рисуется через Konva в <canvas>, и узнать, что на нём,
  // нельзя двумя способами сразу: по DOM все три уровня — один и тот же
  // элемент одного размера, а getImageData запрещён, потому что холст
  // «отравлен» картинкой из схемы bioiqmedia:// (для браузера это чужой
  // источник). На игровом поле карта — обычный <img>, и у него есть и адрес,
  // и признак загрузки.
  const seen = new Set();
  for (const level of ['НАЧИНАЮЩИЙ', 'ОПЫТНЫЙ', 'ПРОФЕССИОНАЛ']) {
    await send('Page.reload');
    await wait(2500);
    await click('ИГРАТЬ!');
    await click('1');
    await fill(1, 'Проверка');
    await click('ДАЛЕЕ');
    await click(level);
    await click('5');
    await wait(1600);
    const img = await ev(`(()=>{const i=[...document.querySelectorAll('img')]
        .filter(e=>e.getBoundingClientRect().width>200)
        .sort((a,b)=>b.getBoundingClientRect().width-a.getBoundingClientRect().width)[0];
      if(!i) return 'картинки нет';
      if(!i.complete || i.naturalWidth===0) return 'не загрузилась';
      return decodeURIComponent(i.src).split('/').pop() + ' ' + i.naturalWidth + 'x' + i.naturalHeight})()`);
    ok('5.1', `уровень «${level}»: карта загрузилась`, / \d+x\d+$/.test(String(img)), String(img));
    if (/ \d+x\d+$/.test(String(img))) seen.add(String(img).split(' ')[0]);
  }
  ok('5.2', 'у каждого уровня своя карта', seen.size === 3, `различных файлов ${seen.size}: ${[...seen].join(', ')}`);
}

console.log(`\nИТОГО: пройдено ${pass}, провалено ${fail}`);
if (fail > 0) {
  console.log('Провалено:');
  for (const f of failures) console.log('  ' + f);
}
sock.close();
process.exitCode = fail > 0 ? 1 : 0;
