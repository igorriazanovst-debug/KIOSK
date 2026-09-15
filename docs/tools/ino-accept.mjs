// Прогон программы испытаний «Инофона» через CDP.
//
// ЧТО ЭТОТ ПРОГОН ДОКАЗЫВАЕТ И ЧЕГО НЕ ДОКАЗЫВАЕТ. Он проверяет ПОВЕДЕНИЕ:
// нажали — случилось ожидаемое. Он не проверяет пригодность контента, качество
// синтезированной речи и правильность башкирского словаря: приложение
// одинаково исправно произнесёт и верное слово, и неверное.
//
// ПРОВЕРЯЕТСЯ ПОВЕДЕНИЕ, А НЕ НАЛИЧИЕ ЭЛЕМЕНТОВ. «Кнопка есть» ничего не
// говорит: в Типе 3 кнопка была, а щелчок по ней не доходил, потому что
// элемент лежал ниже сгиба. Отсюда scrollIntoView перед каждым кликом и
// настоящий Input.dispatchMouseEvent вместо element.click().
//
// ИСКЛЮЧЕНИЯ НЕ ГЛОТАЮТСЯ: проглоченный SyntaxError в проверке Типа 2 дважды
// дал ложный вывод о дефекте, которого нет.
//
// Запуск: node ino-accept.mjs <порт> <раздел|all>

import http from 'node:http';
import ws from './KIOSK/packages/player/node_modules/ws/index.js';
const { WebSocket } = ws;

const PORT = Number(process.argv[2] || 9679);
const ONLY = process.argv[3] || 'all';

const list = await new Promise((res, rej) =>
  http
    .get({ host: '127.0.0.1', port: PORT, path: '/json/list' }, (r) => {
      let s = '';
      r.on('data', (c) => (s += c));
      r.on('end', () => res(JSON.parse(s)));
    })
    .on('error', rej)
);
const sock = new WebSocket(list.filter((x) => x.type === 'page')[0].webSocketDebuggerUrl, {
  perMessageDeflate: false,
});
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
const ev = async (expr) => {
  const res = await send('Runtime.evaluate', {
    expression: expr,
    returnByValue: true,
    awaitPromise: true,
  });
  const ex = res.result?.exceptionDetails;
  if (ex) throw new Error(ex.exception?.description || JSON.stringify(ex));
  return res.result?.result?.value;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const NL = 'String.fromCharCode(10)';
const t = (x) => `[data-testid="${x}"]`;

const click = async (sel) => {
  const box = await ev(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  if (!box) throw new Error(`нет видимого элемента ${sel}`);
  for (const type of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', {
      type,
      x: Math.round(box.x),
      y: Math.round(box.y),
      button: 'left',
      clickCount: 1,
    });
  }
  await wait(330);
};
const type_ = (sel, value) =>
  ev(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
const screen = () => ev(`document.querySelector('[data-scene]').dataset.scene`);
const angle = () => ev(`document.querySelector('[data-seat-angle]').dataset.seatAngle`);
const text = () => ev('document.body.innerText');

let pass = 0;
let fail = 0;
const failures = [];
const ok = (num, label, cond, extra = '') => {
  if (cond) pass += 1;
  else {
    fail += 1;
    failures.push(`${num} ${label}${extra ? ' — ' + extra : ''}`);
  }
  console.log(`${cond ? 'ХОРОШО' : 'ПЛОХО '} ${num}  ${label}${extra ? ' — ' + extra : ''}`);
};
const want = (sect) => ONLY === 'all' || ONLY === String(sect);

await send('Runtime.enable');
await wait(700);

/** Вернуться на экран выбора ученика откуда угодно */
async function toProfiles() {
  for (let i = 0; i < 6; i += 1) {
    const s = await screen();
    if (s === 'profiles') return;
    if (s === 'scene') await click(t('inophone-exit'));
    else await click(t('inophone-back'));
  }
}

async function ensurePupils(names) {
  await toProfiles();
  for (const n of names) {
    const have = await ev(
      `[...document.querySelectorAll('[data-testid^="inophone-profile-"]')].some(e => e.textContent === ${JSON.stringify(n)})`
    );
    if (!have) {
      await type_(t('inophone-new-profile'), n);
      await click(t('inophone-create-profile'));
    }
  }
}

async function openScene(sceneId) {
  await toProfiles();
  const first = await ev(`document.querySelector('[data-testid^="inophone-profile-"]').dataset.testid`);
  await click(t(first));
  await click(t(`inophone-scene-${sceneId}`));
}

// ─── 1. Учётные записи ─────────────────────────────────────────────────────
if (want(1)) {
  console.log('\n=== 1. Учётные записи ===');
  await toProfiles();
  await type_(t('inophone-new-profile'), 'Аня');
  await click(t('inophone-create-profile'));
  let names = await ev(`[...document.querySelectorAll('[data-testid^="inophone-profile-"]')].map(e => e.textContent)`);
  ok('1.1', 'ученик «Аня» добавлен', names.includes('Аня'), names.join(', '));

  await type_(t('inophone-new-profile'), 'Аня');
  await click(t('inophone-create-profile'));
  let err = await ev(`document.querySelector('[data-testid=inophone-error]')?.textContent ?? null`);
  ok('1.2', 'тёзка отвергнут с текстом', !!err, String(err));

  await type_(t('inophone-new-profile'), '   ');
  await click(t('inophone-create-profile'));
  err = await ev(`document.querySelector('[data-testid=inophone-error]')?.textContent ?? null`);
  ok('1.3', 'пустое имя отвергнуто', !!err, String(err));

  await type_(t('inophone-new-profile'), 'Борис');
  await click(t('inophone-create-profile'));
  names = await ev(`[...document.querySelectorAll('[data-testid^="inophone-profile-"]')].map(e => e.textContent)`);
  ok('1.5a', 'двое учеников в списке', names.length >= 2, names.join(', '));
}

// ─── 2. Языки ──────────────────────────────────────────────────────────────
if (want(2)) {
  console.log('\n=== 2. Языки интерфейса и изучения ===');
  await toProfiles();
  const first = await ev(`document.querySelector('[data-testid^="inophone-profile-"]').dataset.testid`);
  await click(t(first));
  await click(t('inophone-open-settings'));
  ok('2.0', 'настройки открылись', (await screen()) === 'settings');

  const ifaceCount = await ev(`document.querySelectorAll('[data-testid^="inophone-iface-"]').length`);
  ok('2.1', 'языков интерфейса шесть', ifaceCount === 6, String(ifaceCount));

  const native = await ev(
    `[...document.querySelectorAll('[data-testid^="inophone-iface-"]')].map(e => e.innerText.split(${NL})[0]).join(', ')`
  );
  ok(
    '2.2',
    'каждый язык подписан сам собой',
    ['English', 'Français', '中文', 'Башҡорт'].every((x) => native.includes(x)),
    native
  );

  await click(t('inophone-iface-en'));
  const studyCodes = await ev(
    `[...document.querySelectorAll('[data-testid^="inophone-study-"]')].map(e => e.dataset.testid.replace('inophone-study-','')).join(',')`
  );
  ok('2.3', 'язык интерфейса ушёл из изучаемых', !studyCodes.split(',').includes('en'), studyCodes);

  await click(t('inophone-iface-ru'));
  // Отмечаем три и пробуем четвёртый
  for (const c of ['en', 'fr', 'de']) {
    const on = await ev(
      `getComputedStyle(document.querySelector('[data-testid=inophone-study-${c}]')).backgroundColor === 'rgb(240, 168, 48)'`
    );
    if (!on) await click(t(`inophone-study-${c}`));
  }
  const three = await ev(`[...document.querySelectorAll('[data-testid^="inophone-study-"]')]
    .filter(e => getComputedStyle(e).backgroundColor === 'rgb(240, 168, 48)').length`);
  ok('2.4', 'отмечены три изучаемых языка', three === 3, String(three));

  await click(t('inophone-study-zh'));
  const stillThree = await ev(`[...document.querySelectorAll('[data-testid^="inophone-study-"]')]
    .filter(e => getComputedStyle(e).backgroundColor === 'rgb(240, 168, 48)').length`);
  ok('2.5', 'четвёртый язык не отмечается', stillThree === 3, String(stillThree));

  for (const c of ['fr', 'de']) await click(t(`inophone-study-${c}`));
  await click(t('inophone-study-en'));
  const atLeastOne = await ev(`[...document.querySelectorAll('[data-testid^="inophone-study-"]')]
    .filter(e => getComputedStyle(e).backgroundColor === 'rgb(240, 168, 48)').length`);
  ok('2.6', 'последний изучаемый не снимается', atLeastOne >= 1, String(atLeastOne));
  await click(t('inophone-settings-done'));
}

// ─── 3. Темы и сцены ───────────────────────────────────────────────────────
if (want(3)) {
  console.log('\n=== 3. Темы и сцены ===');
  await toProfiles();
  const first = await ev(`document.querySelector('[data-testid^="inophone-profile-"]').dataset.testid`);
  await click(t(first));
  const body = await text();
  // ВСЕ ПЯТЬ обязательных тем ТЗ строки 97, и названия СВЕРЯЮТСЯ ДОСЛОВНО.
  // «Дом» по смыслу та же «квартира», но на приёмке перечень читают построчно,
  // и объяснять расхождение пришлось бы голосом
  for (const [num, name] of [
    ['3.2a', 'Квартира'],
    ['3.2b', 'Город'],
    ['3.2c', 'Покупки'],
    ['3.2d', 'Человек'],
    ['3.2e', 'Путешествие'],
  ]) {
    ok(num, `тема «${name}» из перечня ТЗ есть`, body.includes(name));
  }
  const scenes = await ev(`document.querySelectorAll('[data-testid^="inophone-scene-"]').length`);
  ok('3.3', 'сцен не меньше 31', scenes >= 31, String(scenes));
  const counts = await ev(
    `[...document.querySelectorAll('[data-testid^="inophone-scene-"]')].every(e => /объектов: \\d+/.test(e.innerText))`
  );
  ok('3.4', 'у каждой сцены указано число объектов', counts);
}

// ─── 4. Обучение ───────────────────────────────────────────────────────────
if (want(4)) {
  console.log('\n=== 4. Режим «Обучение» ===');
  await openScene('bedroom');
  ok('4.0', 'открылась настройка занятия', (await screen()) === 'setup');
  await click(t('inophone-mode-learning'));
  await click(t('inophone-start'));
  ok('4.1a', 'сцена открылась', (await screen()) === 'scene');
  const labels = await ev(`document.querySelectorAll('[data-testid=inophone-stage] text').length`);
  ok('4.1b', 'все объекты подписаны', labels === 12, `подписей ${labels}`);

  // КАРТИНКИ ПРОВЕРЯЮТСЯ ПО ФАКТУ ЗАГРУЗКИ, а не по наличию тега <image>.
  // Дефект, который это ловит, дошёл до пользователя: подложка ссылалась на
  // рисунки относительным путём, в приложении не грузился ни один, и поле
  // было пустым. Тег при этом был на месте, а моя проверка рендера открывала
  // подложку через file://, где относительные ссылки работают — и потому
  // смотрела не тем путём, каким смотрит приложение
  const art = await ev(`(() => {
    const imgs = [...document.querySelectorAll('[data-testid=inophone-stage] image')];
    const loaded = imgs.filter(i => {
      const b = i.getBoundingClientRect();
      return b.width > 0 && b.height > 0;
    });
    return imgs.length + '/' + loaded.length;
  })()`);
  const naturalOk = await ev(`(() => new Promise(resolve => {
    const hrefs = [...document.querySelectorAll('[data-testid=inophone-stage] image')]
      .map(i => i.getAttribute('href')).filter(Boolean);
    Promise.all(hrefs.map(h => new Promise(r => {
      const im = new Image();
      im.onload = () => r(true);
      im.onerror = () => r(false);
      im.src = h;
      setTimeout(() => r(false), 4000);
    }))).then(rs => resolve(rs.filter(Boolean).length + '/' + rs.length));
  }))()`);
  const [good, total] = String(naturalOk).split('/').map(Number);
  ok('4.1c', 'рисунки предметов на сцене действительно грузятся', total > 12 && good === total, `${good} из ${total}`);

  await click(t('inophone-hotspot-bed'));
  const card = await ev(`(() => {
    const c = document.querySelector('[data-testid=inophone-card]');
    if (!c) return null;
    return [...c.querySelectorAll('[data-testid^="inophone-word-"]')].map(e => e.dataset.testid.replace('inophone-word-','')).join(',');
  })()`);
  ok('4.2', 'карточка объекта открылась', !!card, String(card));
  ok('4.6', 'в обучении нет счёта', !(await ev(`!!document.querySelector('[data-testid=inophone-score]')`)));
  await click(t('inophone-card-close'));
  await click(t('inophone-exit'));
}

// ─── 5. Тренировка ─────────────────────────────────────────────────────────
if (want(5)) {
  console.log('\n=== 5. Режим «Тренировка» ===');
  await openScene('bedroom');
  await click(t('inophone-mode-training'));
  await click(t('inophone-count-5'));
  await click(t('inophone-start'));
  const task = await ev(`document.querySelector('[data-testid=inophone-task-text]')?.textContent ?? null`);
  ok('5.1', 'задание показано', !!task, String(task));
  const noLabels = await ev(`document.querySelectorAll('[data-testid=inophone-stage] text').length`);
  ok('5.2', 'объекты НЕ подписаны', noLabels === 0, `подписей ${noLabels}`);

  // Отдельно от 4.1c: именно в тренировке отсутствие рисунков ничем не
  // маскируется, и поле выглядит пустым — так дефект и заметил пользователь
  const artTrain = await ev(`(() => new Promise(resolve => {
    const hrefs = [...document.querySelectorAll('[data-testid=inophone-stage] image')]
      .map(i => i.getAttribute('href')).filter(Boolean);
    Promise.all(hrefs.map(h => new Promise(r => {
      const im = new Image();
      im.onload = () => r(true);
      im.onerror = () => r(false);
      im.src = h;
      setTimeout(() => r(false), 4000);
    }))).then(rs => resolve(rs.filter(Boolean).length + '/' + rs.length));
  }))()`);
  const [g2, t2] = String(artTrain).split('/').map(Number);
  ok('5.2b', 'в тренировке рисунки предметов видны', t2 > 12 && g2 === t2, `${g2} из ${t2}`);

  // Заведомо неверный ответ: берём объект, отличный от загаданного
  const before = await ev(`document.querySelector('[data-testid=inophone-score]').innerText`);
  const wrong = await ev(`(() => {
    const txt = document.querySelector('[data-testid=inophone-task-text]').textContent.trim();
    const spots = [...document.querySelectorAll('[data-testid^="inophone-hotspot-"]')];
    const wanted = spots.find(s => (s.getAttribute('aria-label')||'') === txt);
    return spots.filter(s => s !== wanted)[0].dataset.testid;
  })()`);
  await click(t(wrong));
  await wait(400);
  const verdictOnWanted = await ev(`(() => {
    const lit = [...document.querySelectorAll('[data-testid^="inophone-hotspot-"]')]
      .filter(s => s.getAttribute('stroke') && s.getAttribute('stroke') !== 'transparent');
    return lit.length === 1 ? lit[0].dataset.testid : 'подсвечено ' + lit.length;
  })()`);
  ok('5.4a', 'подсвечен ровно один объект — загаданный', verdictOnWanted !== wrong && !String(verdictOnWanted).startsWith('подсвечено'), String(verdictOnWanted));
  await wait(900);
  const after = await ev(`document.querySelector('[data-testid=inophone-score]')?.innerText ?? ''`);
  ok('5.4b', 'ход перешёл к следующему вопросу', before !== after, `${before} -> ${after}`);

  for (let i = 0; i < 8; i += 1) {
    if ((await screen()) === 'results') break;
    const spots = await ev(`[...document.querySelectorAll('[data-testid^="inophone-hotspot-"]')].map(e => e.dataset.testid)`);
    await click(t(spots[i % spots.length]));
    await wait(1000);
  }
  ok('5.8', 'партия из 5 вопросов кончилась итогами', (await screen()) === 'results');
  await click(t('inophone-back'));
}

// ─── 6. Соревнование ───────────────────────────────────────────────────────
if (want(6)) {
  console.log('\n=== 6. Режим «Соревнование» ===');
  await ensurePupils(['Аня', 'Борис']);
  await openScene('kitchen');
  const blocked = await ev(`document.querySelector('[data-testid=inophone-mode-challenge]').disabled`);
  ok('6.1', 'при одном ученике соревнование погашено', blocked === true, String(blocked));

  const picks = await ev(`[...document.querySelectorAll('[data-testid^="inophone-pick-"]')].map(e => e.dataset.testid)`);
  for (const p of picks) {
    const active = await ev(`document.querySelector('[data-testid="${p}"]').innerText.includes('ходит')`);
    if (!active) {
      await click(t(p));
      break;
    }
  }
  await click(t('inophone-mode-challenge'));
  await click(t('inophone-count-5'));
  await click(t('inophone-start'));
  ok('6.2', 'соревнование началось', (await screen()) === 'scene');

  const a0 = await angle();
  const who0 = await ev(`document.querySelector('[data-testid=inophone-turn]').textContent`);
  const task0 = await ev(`document.querySelector('[data-testid=inophone-task-text]').textContent`);
  const spots = await ev(`[...document.querySelectorAll('[data-testid^="inophone-hotspot-"]')].map(e => e.dataset.testid)`);
  await click(t(spots[0]));
  await wait(1100);
  const a1 = await angle();
  const who1 = await ev(`document.querySelector('[data-testid=inophone-turn]').textContent`);
  const task1 = await ev(`document.querySelector('[data-testid=inophone-task-text]').textContent`);
  ok('6.3a', 'ход перешёл другому игроку', who0 !== who1, `${who0} -> ${who1}`);
  ok('6.3b', 'поле повернулось к нему', a0 !== a1, `${a0}° -> ${a1}°`);
  ok('6.5', 'двое сидят напротив (0° и 180°)', [a0, a1].sort().join(',') === '0,180', `${a0}, ${a1}`);
  ok('6.7', 'в одном круге задания не повторяются', task0 !== task1, `${task0} / ${task1}`);
  const stripInside = await ev(
    `!!document.querySelector('[data-seat-angle]').querySelector('[data-testid=inophone-strip]')`
  );
  ok('6.4', 'полоса со счётом внутри поворачиваемого поля', stripInside);

  for (let i = 0; i < 20; i += 1) {
    if ((await screen()) === 'results') break;
    const s2 = await ev(`[...document.querySelectorAll('[data-testid^="inophone-hotspot-"]')].map(e => e.dataset.testid)`);
    await click(t(s2[i % s2.length]));
    await wait(1000);
  }
  ok('6.8a', 'соревнование доиграно до итогов', (await screen()) === 'results');
  const rows = await ev(`document.querySelectorAll('[data-testid^="inophone-result-"]').length`);
  ok('6.8b', 'в итогах оба игрока', rows === 2, String(rows));
  const winners = await ev(`document.querySelector('[data-testid=inophone-winners]')?.textContent ?? null`);
  ok('6.8c', 'объявлен победитель либо ничья', !!winners, String(winners));
  await click(t('inophone-back'));
}

// ─── 7. Словарь ────────────────────────────────────────────────────────────
if (want(7)) {
  console.log('\n=== 7. Словарь ===');
  await toProfiles();
  const first = await ev(`document.querySelector('[data-testid^="inophone-profile-"]').dataset.testid`);
  await click(t(first));
  await click(t('inophone-open-dictionary'));
  ok('7.1', 'словарь открылся', (await screen()) === 'dictionary');
  const found = async (q) => {
    await type_(t('inophone-search'), q);
    await wait(260);
    return ev(`document.querySelector('[data-testid=inophone-found]').textContent`);
  };
  ok('7.2', '«ковер» находит «ковёр»', (await found('ковер')).includes('Найдено 1'));
  ok('7.3', 'регистр не мешает', (await found('КОВЁР')).includes('Найдено 1'));
  // Слова подобраны так, чтобы совпадение было РОВНО ОДНО. Первая версия
  // искала «Bett» и ждала одного попадания, а получала три: «Bett»,
  // «Kinderbett» и «Krankenbett» — поиск по подстроке работал правильно, а
  // неверным было ожидание теста
  ok('7.4', 'поиск по английскому', (await found('pillow')).includes('Найдено 1'));
  ok('7.5', 'поиск по французскому', (await found('fenêtre')).includes('Найдено 1'));
  ok('7.5b', 'поиск по китайскому', (await found('枕头')).includes('Найдено 1'));
  ok('7.6', 'отсутствующее слово даёт внятный ответ', (await found('щщщ')).includes('Ничего не нашлось'));
  await type_(t('inophone-search'), '');
  await click(t('inophone-back'));
}

// ─── 8. Результаты ─────────────────────────────────────────────────────────
if (want(8)) {
  console.log('\n=== 8. Результаты ===');
  await toProfiles();
  const first = await ev(`document.querySelector('[data-testid^="inophone-profile-"]').dataset.testid`);
  await click(t(first));
  await click(t('inophone-open-stats'));
  ok('8.0', 'результаты открылись', (await screen()) === 'statistics');
  const byLang = await ev(`document.querySelectorAll('[data-testid^="inophone-stat-lang-"]').length`);
  const byScene = await ev(`document.querySelectorAll('[data-testid^="inophone-stat-scene-"]').length`);
  ok('8.2a', 'есть сводка по языкам', byLang > 0, `строк ${byLang}`);
  ok('8.2b', 'есть сводка по сценам', byScene > 0, `строк ${byScene}`);
  const hasLastAndTotal = await ev(
    `/прошлый раз .* всего /s.test(document.querySelector('[data-testid^="inophone-stat-lang-"]').innerText.replace(/\\s+/g,' '))`
  );
  ok('8.4', '«прошлый раз» и «всего» показаны раздельно', hasLastAndTotal);
  await click(t('inophone-back'));
}

// ─── 9. Комплектность пакета ───────────────────────────────────────────────
if (want(9)) {
  console.log('\n=== 9. Комплектность пакета ===');
  await toProfiles();
  const first = await ev(`document.querySelector('[data-testid^="inophone-profile-"]').dataset.testid`);
  await click(t(first));
  await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('О пакете')).click()`);
  await wait(500);
  const body = await text();
  ok('9.2a', 'квоты ТЗ показаны с запасом', /запас \d+/.test(body));
  ok('9.2b', 'ни одна квота не «НЕ ХВАТАЕТ»', !body.includes('НЕ ХВАТАЕТ'));
  ok('9.3', 'недостающих файлов нет', /Не хватает файлов\s*0/.test(body.replace(/\n/g, ' ')));
  ok('9.5', 'раздела «Разметка сцен» нет — наложений нет', !body.includes('Разметка сцен'));
  const gaps = await ev(`(() => {
    const rows = document.body.innerText;
    const m = rows.match(/не записана озвучка, по языкам:([\\s\\S]{0,200})/i);
    return m ? m[1].replace(/\\s+/g, ' ').trim().slice(0, 120) : 'раздела нет';
  })()`);
  ok('9.4', 'озвучка есть на всех языках', !/[1-9]/.test(gaps), gaps);
}

console.log(`\nИТОГО: пройдено ${pass}, провалено ${fail}`);
if (fail > 0) {
  console.log('Провалено:');
  for (const f of failures) console.log('  ' + f);
}
sock.close();
process.exitCode = fail > 0 ? 1 : 0;
