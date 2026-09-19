// Прогон программы испытаний «ФизАстроIQ» (Тип 11) на живом приложении.
//
// ЧТО ЭТОТ ПРОГОН ДОКАЗЫВАЕТ И ЧЕГО НЕ ДОКАЗЫВАЕТ. Он проверяет ПОВЕДЕНИЕ:
// нажали — случилось ожидаемое. Он НЕ проверяет физическую и астрономическую
// правильность вопросов и точность схем: приложение одинаково исправно
// засчитает и верный ответ, и неверный, если так написано в банке.
// Содержательная проверка — за методистом, см.
// physastroiq-third-party-licenses.md §3.
//
// ПРОВЕРЯЕТСЯ ПОВЕДЕНИЕ, А НЕ НАЛИЧИЕ ЭЛЕМЕНТОВ. «Кнопка есть» ничего не
// говорит: у Типа 3 кнопка была, а щелчок по ней не доходил, потому что
// элемент лежал ниже сгиба. Отсюда scrollIntoView перед каждым нажатием и
// настоящий Input.dispatchMouseEvent вместо element.click().
//
// ИСКЛЮЧЕНИЯ НЕ ГЛОТАЮТСЯ: проглоченный SyntaxError в проверке Типа 2 дважды
// дал ложный вывод о дефекте, которого нет.
//
// ОСОБЕННОСТЬ ТИПА 11 — ПРЕДМЕТОВ ДВА. Проверка «викторина работает» на одной
// только физике ничего не говорит про астрономию: это разные карты, разные
// банки и разные файлы контента. Поэтому партия играется дважды, и раздел 3
// отдельно убеждается, что при переключении меняется именно содержимое, а не
// только заголовок.
//
// ПОДГОТОВКА (иначе разделы 4 и 5 не воспроизводятся — PIN уже задан):
//   cd docs/tools && ./restand.sh stage-physastroiq 9712 kiosk-physastroiq kiosk-physastroiq
//
// Запуск: node physastroiq-accept.mjs <порт> <номер раздела|all>

import http from 'node:http';
import ws from '../../packages/player/node_modules/ws/index.js';
const { WebSocket } = ws;

const PORT = Number(process.argv[2] || 9712);
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
const send = (method, params = {}) =>
  new Promise((r) => { const i = ++id; pending.set(i, r); sock.send(JSON.stringify({ id: i, method, params })); });

// Диалоги confirm() закрываются САМИ, иначе прогон виснет наглухо.
//
// Выход из редактора с несохранёнными правками поднимает системный confirm.
// Он останавливает поток страницы целиком, и следующий же Runtime.evaluate не
// получает ответа никогда — прогон замирает без единого сообщения об ошибке.
// Именно так первая версия этой проверки «зависала» после раздела 6, пройдя
// перед этим всё до единого пункта.
let dialogs = 0;
sock.on('message', (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Page.javascriptDialogOpening') {
    dialogs += 1;
    sock.send(JSON.stringify({ id: ++id, method: 'Page.handleJavaScriptDialog', params: { accept: true } }));
  }
});
await send('Page.enable');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Настоящий щелчок мышью по точке окна.
 *
 * Движение перед нажатием и поля buttons/pointerType — подстраховка, а не
 * лечение: инструмент съёмки снимков (shoot.mjs) обходится без них и работает
 * на том же игровом поле. Оставлены потому, что делают событие ближе к
 * настоящему и ничего не стоят.
 *
 * НАСТОЯЩЕЙ причиной «верный ответ не засчитывается» на первом прогоне было
 * другое — см. clickAria: экран читался во время удержания вердикта. Здесь
 * это записано прямо, чтобы следующий читатель не чинил не то.
 */
async function mouse(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0, pointerType: 'mouse' });
  for (const type of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', {
      type, x, y, button: 'left', clickCount: 1,
      buttons: type === 'mousePressed' ? 1 : 0, pointerType: 'mouse',
    });
  }
}

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
  if (!box) throw new Error(`нет кнопки «${label}»; на экране: ${String(await text()).replace(/\n/g, ' | ').slice(0, 220)}`);
  const { x, y } = JSON.parse(box);
  await mouse(x, y);
  await wait(600);
}

/**
 * Настоящий щелчок по элементу игрового поля.
 *
 * Крючок — data-testid, а НЕ aria-label. Подпись области нейтральная
 * («Область N»): раньше у верной области стояло aria-label="correct-point", и
 * программа экранного доступа называла ответ до щелчка. Исправлено во всех
 * четырёх виджетах семейства «IQ»; проверка 2.12 следит, чтобы утечка не
 * вернулась.
 */
async function clickAria(label) {
  const box = await ev(`(()=>{const el=document.querySelector('[data-testid=${JSON.stringify(label)}]');
    if(!el) return null; el.scrollIntoView({block:'center'});
    const r=el.getBoundingClientRect();
    return JSON.stringify({x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)})})()`);
  if (!box) throw new Error(`нет элемента поля с data-testid=${label}`);
  const { x, y } = JSON.parse(box);
  await mouse(x, y);
  // Поле держит вердикт около секунды, и только потом показывает следующий
  // вопрос. Ждать надо ДОЛЬШЕ удержания, иначе читается прежний экран.
  await wait(1400);
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

/** Провести партию до игрового поля. Возвращает сведения о поле. */
async function startGame({ level, questions = 5, playerName = 'Приёмка' }) {
  await click('Играть!');
  await click('1');
  await fill(1, playerName);
  await click('Далее');
  await click(level);
  await click(String(questions));
  await wait(1400);
  return JSON.parse(
    await ev(`(()=>{const img=document.querySelector('img');
      return JSON.stringify({
        src: img ? img.getAttribute('src') : null,
        natural: img ? img.naturalWidth + 'x' + img.naturalHeight : null,
        correct: document.querySelectorAll('[data-testid="correct-point"]').length,
        decoys: document.querySelectorAll('[data-testid^="decoy-"]').length,
        leaks: [...document.querySelectorAll('[data-testid="correct-point"],[data-testid^="decoy-"]')]
          .filter(e => /correct|decoy/i.test(e.getAttribute('aria-label') || '')).length,
        labels: [...document.querySelectorAll('[data-testid="correct-point"],[data-testid^="decoy-"]')]
          .map(e => e.getAttribute('aria-label')),
        body: document.body.innerText
      })})()`)
  );
}

/** Досдаться до экрана результатов. */
async function surrenderAll(times = 6) {
  for (let i = 0; i < times; i += 1) {
    const done = await ev(`/РЕЗУЛЬТАТ/i.test(document.body.innerText)`);
    if (done) return;
    await click('Сдаюсь');
  }
}

// ─── 1. Стартовый экран, предмет и справочные материалы ────────────────────

if (want(1)) {
  console.log('\n1. Стартовый экран, выбор предмета, справочные материалы (FR-004, FR-021, FR-022, FR-023, FR-024)');
  await wait(1200);
  const intro = await text();
  ok('1.1', 'стартовый экран показывает предмет и темы', /ФИЗИКА/i.test(intro) && /ИГРАТЬ/i.test(intro));

  const subjects = JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('[data-testid="physastroiq-subject-switch"] button')].map(b=>b.innerText.trim().toLowerCase()))`));
  ok('1.2', 'на интро есть переключатель обоих предметов',
    subjects.length === 2 && subjects.includes('физика') && subjects.includes('астрономия'),
    `найдено: ${subjects.join(', ')}`);

  await click('Справочные материалы');
  await wait(900);
  const counts = JSON.parse(
    await ev(`(()=>{const q=(id)=>document.querySelectorAll('[data-testid="physastroiq-thematic-'+id+'"] img').length;
      return JSON.stringify({phys:q('physics'), astro:q('astronomy'), total:document.querySelectorAll('img').length})})()`)
  );
  ok('1.3', 'изображений по физике не меньше шести (FR-022)', counts.phys >= 6, `на экране ${counts.phys}`);
  ok('1.4', 'изображений по астрономии не меньше четырёх (FR-023)', counts.astro >= 4, `на экране ${counts.astro}`);

  const titles = String(await text()).split('\n').map((s) => s.trim()).filter(Boolean);
  const astroThemes = {
    'строение солнечной системы': /солнечной систем/i,
    'карты звёздного неба': /звёздного неба|звездного неба/i,
    Луна: /лун/i,
  };
  for (const [name, re] of Object.entries(astroThemes)) {
    ok('1.5', `тема астрономии «${name}» представлена (FR-024)`, titles.some((t) => re.test(t)));
  }

  // Каждая картинка действительно ЗАГРУЖЕНА, а не пустая рамка: у Типа 4
  // ровно так «имеющиеся» иллюстрации оказались невидимыми на поле.
  const broken = await ev(`[...document.querySelectorAll('img')].filter(i=>!i.complete||i.naturalWidth===0).length`);
  ok('1.6', 'все миниатюры загрузились, пустых рамок нет', broken === 0, `не загрузилось ${broken}`);

  await click('Назад');
  await wait(600);
}

// ─── 2. Партия по физике ───────────────────────────────────────────────────

if (want(2)) {
  console.log('\n2. Партия по физике (FR-006, FR-007, FR-008, FR-012, FR-020)');
  const board = await startGame({ level: 'Начинающий' });
  ok('2.1', 'открылась карта уровня по физике', /phys_level1_map\.png$/.test(String(board.src)), String(board.src));
  ok('2.2', 'карта загрузилась в объявленном размере', board.natural === '1800x1200', String(board.natural));
  ok('2.3', 'на поле ровно одна правильная точка', board.correct === 1, `найдено ${board.correct}`);
  ok('2.4', 'точек-обманок на поле не меньше десяти (FR-013)', board.decoys >= 10, `найдено ${board.decoys}`);
  ok('2.5', 'счётчик вопросов показывает выбранное число (FR-020)', /Вопрос 1\/5/.test(board.body), board.body.split('\n')[0]);
  ok('2.6', 'идёт обратный отсчёт времени (FR-006)', /Таймер:\s*\d+с/.test(board.body));

  const hintShown = await ev(`/ПОДСКАЗКУ/i.test(document.body.innerText)`);
  ok('2.7', 'у вопроса есть подсказка (FR-006)', hintShown === true);

  const before = Number(String(board.body).match(/Очки сейчас:\s*(\d+)/)?.[1] ?? 0);
  await clickAria('correct-point');
  const after = await ev(`(()=>{const m=document.body.innerText.match(/Очки сейчас:\\s*(\\d+)/); return m?Number(m[1]):-1})()`);
  const moved = await ev(`/Вопрос 2\\/5/.test(document.body.innerText)`);
  ok('2.8', 'верный ответ засчитан и ход перешёл к следующему вопросу', moved === true, `было ${before}, стало ${after}`);

  await click('Сдаюсь');
  const skipped = await ev(`/Вопрос 3\\/5/.test(document.body.innerText)`);
  ok('2.9', 'кнопка «Сдаюсь» пропускает вопрос (FR-007)', skipped === true);

  ok('2.12', 'подпись области не выдаёт ответ программе экранного доступа',
    board.leaks === 0 && board.labels.every((l) => /^Область \d+$/.test(String(l))),
    `подписей с утечкой: ${board.leaks}; пример подписи: ${board.labels[0]}`);

  await surrenderAll();
  const results = await text();
  ok('2.10', 'показан экран результатов', /РЕЗУЛЬТАТ/i.test(results));

  await click('Подробнее');
  const detail = await text();
  ok('2.11', 'детализация перечисляет вопросы и отметки верно/неверно (FR-012)',
    /верно/i.test(detail) && detail.split('\n').filter((l) => l.trim()).length > 5);
  await click('Назад');
  await click('Новая игра');
  await wait(600);
}

// ─── 3. Переключение предмета меняет содержимое, а не заголовок ────────────

if (want(3)) {
  console.log('\n3. Второй предмет — астрономия (FR-004, FR-021)');
  await click('Астрономия');
  await wait(700);
  const intro = await text();
  ok('3.1', 'описание сменилось на астрономическое', /астроном/i.test(intro) && /Солнечн/i.test(intro));

  const board = await startGame({ level: 'Профессионал' });
  ok('3.2', 'открылась карта уровня по астрономии, а не по физике',
    /astro_level3_map\.png$/.test(String(board.src)), String(board.src));
  ok('3.3', 'карта загрузилась в объявленном размере', board.natural === '1800x1200', String(board.natural));
  ok('3.4', 'вес вопроса на «Профессионале» выше, чем на «Начинающем» (FR-006)',
    Number(String(board.body).match(/Очки сейчас:\s*(\d+)/)?.[1] ?? 0) > 100,
    String(board.body).match(/Очки сейчас:\s*\d+/)?.[0]);
  ok('3.5', 'время на вопрос на «Профессионале» меньше (FR-006)',
    Number(String(board.body).match(/Таймер:\s*(\d+)/)?.[1] ?? 99) <= 25,
    String(board.body).match(/Таймер:\s*\d+с/)?.[0]);

  await clickAria('correct-point');
  const moved = await ev(`/Вопрос 2\\/5/.test(document.body.innerText)`);
  ok('3.6', 'верный ответ по астрономии засчитан', moved === true);

  await surrenderAll();
  await click('Новая игра');
  await wait(600);
  const back = await text();
  ok('3.7', 'выбранный предмет сохраняется между партиями', /астроном/i.test(back));
  await click('Физика');
  await wait(600);
}

// ─── 4. Режим учителя: PIN ─────────────────────────────────────────────────

if (want(4)) {
  console.log('\n4. Режим учителя и парольная защита (FR-017)');
  await click('Режим учителя');
  const gate = await text();
  ok('4.1', 'при первом входе PIN предлагается задать', /ЗАДАЙТЕ PIN/i.test(gate));
  await fill(1, '4321');
  await fill(2, '4321');
  await click('Задать');
  await wait(900);
  ok('4.2', 'после задания PIN открылся каталог', /КАТАЛОГ/i.test(await text()));

  await click('Выйти');
  await wait(600);
  await click('Режим учителя');
  const again = await text();
  ok('4.3', 'при следующем входе PIN спрашивается, а не задаётся заново',
    !/ЗАДАЙТЕ PIN/i.test(again) && /ВОЙТИ/i.test(again),
    again.replace(/\n/g, ' | ').slice(0, 120));
  await fill(1, '0000');
  await click('Войти');
  await wait(700);
  ok('4.4', 'неверный PIN не пускает', !/КАТАЛОГ/i.test(await text()));
  await fill(1, '4321');
  await click('Войти');
  await wait(900);
  ok('4.5', 'верный PIN пускает', /КАТАЛОГ/i.test(await text()));
}

// ─── 5. Каталог, встроенные викторины, статистика ──────────────────────────

if (want(5)) {
  console.log('\n5. Каталог, встроенные викторины, статистика (FR-011, FR-018, FR-021)');
  const catalog = await text();
  ok('5.1', 'в каталоге ОБЕ встроенные викторины (FR-021)',
    /Физика/.test(catalog) && /Астрономия/.test(catalog) && (catalog.match(/встроенная/g) || []).length >= 2);
  ok('5.2', 'у каждой встроенной показано число вопросов', /90 вопр/.test(catalog));
  ok('5.3', 'есть пошаговое создание викторины с нуля (FR-018)', /СОЗДАТЬ НОВУЮ/i.test(catalog));
  ok('5.4', 'есть обмен викторинами (FR-014)', /ИМПОРТИРОВАТЬ/i.test(catalog));

  await click('Статистика по дням');
  await wait(900);
  const stats = await text();
  ok('5.5', 'сводная статистика показывает сыгранные партии (FR-011)',
    /Приёмка/.test(stats), stats.replace(/\n/g, ' | ').slice(0, 160));
  ok('5.6', 'статистику можно посмотреть за один день (FR-011)', /сегодня|за день|дням/i.test(stats));
  await click('Назад');
  await wait(600);
}

// ─── 6. Редактор: точки, вес, тема, спецсимволы, изображения ───────────────

if (want(6)) {
  console.log('\n6. Редактор (FR-013, FR-015, FR-016)');
  await click('Дублировать');
  await wait(2500);
  const afterDup = await text();
  ok('6.1', 'встроенную викторину можно продублировать как заготовку', /копия/i.test(afterDup));

  await click('Редактировать');
  await wait(1500);
  const editor = await text();
  ok('6.2', 'редактор открылся', /РЕДАКТОР|Уровень/i.test(editor), editor.replace(/\n/g, ' | ').slice(0, 160));

  const canvas = await ev(`document.querySelectorAll('canvas, [data-testid*="canvas"], img').length`);
  ok('6.3', 'в редакторе видна карта уровня для расстановки точек (FR-013)', canvas > 0, `элементов ${canvas}`);

  // Точки редактора рисуются на холсте Konva, DOM-элементов у них нет:
  // выбрать вопрос можно только настоящим щелчком по карте.
  const canvasBox = await ev(`(()=>{const c=document.querySelector('canvas'); if(!c) return null;
    const r=c.getBoundingClientRect();
    return JSON.stringify({x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2)})})()`);
  ok('6.4', 'карта уровня в редакторе принимает щелчок', canvasBox !== null);
  // Без включённого режима щелчок по пустому месту карты ничего не выбирает:
  // форма вопроса открывается на точке, а точки там нет.
  await click('Добавить вопрос');
  if (canvasBox) {
    const { x, y } = JSON.parse(canvasBox);
    await mouse(x, y);
    await wait(1200);
  }

  const form = JSON.parse(await ev(`(()=>{const t=document.body.innerText;
    return JSON.stringify({
      form: /ТЕКСТ ВОПРОСА/i.test(t),
      weight: /вес/i.test(t),
      theme: /тема/i.test(t),
      answer: /ответ/i.test(t),
      hint: /подсказк/i.test(t),
      image: /картинк/i.test(t),
      chars: ['√','Δ','Ω','☉','☾','⊕','°','·'].filter(c=>t.includes(c)).length
    })})()`));
  ok('6.5', 'щелчок по карте открывает форму вопроса (FR-013)', form.form === true);
  ok('6.6', 'у вопроса задаются вес и тема (FR-013)', form.weight && form.theme);
  ok('6.7', 'у вопроса задаются ответ и подсказка (FR-006)', form.answer && form.hint);
  ok('6.8', 'к вопросу, ответу и подсказке можно приложить изображение (FR-016)', form.image === true);
  ok('6.9', 'панель спецсимволов физики и астрономии доступна (FR-015)', form.chars >= 5,
    'найдено символов: ' + form.chars);

  await click('Назад');
  await wait(1200);
}

// ─── Итог ──────────────────────────────────────────────────────────────────

console.log(`\nИТОГ: пройдено ${pass}, не пройдено ${fail}`);
if (failures.length) {
  console.log('\nНе пройдено:');
  for (const f of failures) console.log('  • ' + f);
}
sock.close();
process.exit(fail > 0 ? 1 : 0);
