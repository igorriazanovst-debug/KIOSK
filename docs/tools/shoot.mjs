// Снимающий сценарий для пользовательских инструкций.
//
// Снимки делаются С ЖИВОГО ПРИЛОЖЕНИЯ, а не рисуются: инструкция, в которой
// экран не совпадает с тем, что видит педагог, хуже отсутствующей — человек
// решает, что запустил не ту программу.
//
// Шаги читаются из файла сценария: { "порт": N, "каталог": "...", "шаги": [...] }
// Каждый шаг — объект:
//   { "клик": "testid" }            нажать
//   { "ввод": ["testid", "текст"] } набрать в поле (через сеттер прототипа,
//                                   иначе React не заметит)
//   { "жди": 600 }                  подождать
//   { "снимок": "имя", "подпись": "..." }  сохранить PNG
//   { "проверь": "testid" }         убедиться, что элемент есть, иначе падаем
//
// Сценарий ПАДАЕТ на первой же неудаче. Молча пропущенный шаг дал бы снимок
// не того экрана, а подпись осталась бы прежней — именно так инструкции и
// начинают врать.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
// Путь к ws — ОТ САМОГО ФАЙЛА, а не от каталога запуска. Пока скрипт лежал
// в рабочем каталоге, относительный путь совпадал случайно; после переноса в
// репозиторий он перестал разрешаться, и инструмент не запускался со своего
// же места — ровно то, чего требовал README.
import ws from '../../packages/player/node_modules/ws/index.js';
const { WebSocket } = ws;

const plan = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const outDir = path.resolve(plan.каталог);
// Пакет контента нужен только Типу 2: перевести написанное на экране слово в
// идентификатор карточки
const словарь = plan.словарь
  ? new Map(JSON.parse(fs.readFileSync(plan.словарь, 'utf8')).words.map((w) => [w.name, w.id]))
  : null;
fs.mkdirSync(outDir, { recursive: true });

const list = await new Promise((res, rej) =>
  http.get({ host: '127.0.0.1', port: plan.порт, path: '/json/list' }, (r) => {
    let s = ''; r.on('data', (c) => (s += c)); r.on('end', () => res(JSON.parse(s)));
  }).on('error', rej));
const sock = new WebSocket(list.find((x) => x.type === 'page').webSocketDebuggerUrl, { perMessageDeflate: false });
await new Promise((r, j) => { sock.on('open', r); sock.on('error', j); });
let id = 0; const pending = new Map();
sock.on('message', (raw) => { const m = JSON.parse(raw.toString()); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); sock.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => {
  const m = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (m.result?.exceptionDetails) {
    const d = m.result.exceptionDetails;
    throw new Error('выражение упало: ' + (d.exception?.description || d.text));
  }
  return m.result?.result?.value;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function click(testId) {
  // ПРОКРУТКА ПЕРЕД НАЖАТИЕМ ОБЯЗАТЕЛЬНА. Список тем вырос до шестнадцати и не
  // помещается на экран; клик по координатам элемента, который ниже видимой
  // области, попадает мимо — молча, без ошибки. Проверка «нажалось» при этом
  // лжёт: элемент есть, координаты есть, а нажался кто-то другой.
  await ev(`document.querySelector('[data-testid="${testId}"]')?.scrollIntoView({block:'center'})`);
  await wait(250);
  const box = await ev(`(()=>{const e=document.querySelector('[data-testid="${testId}"]');
    if(!e)return null;const r=e.getBoundingClientRect();
    if(!r.width||!r.height)return null;
    if(r.top<0||r.bottom>window.innerHeight)return null;
    return JSON.stringify({x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)})})()`);
  if (!box) throw new Error(`нет кликабельного [${testId}] — не виден даже после прокрутки`);
  const { x, y } = JSON.parse(box);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  await wait(plan.пауза ?? 320);
}

const captured = [];
for (const [i, step] of plan.шаги.entries()) {
  const label = JSON.stringify(step).slice(0, 90);
  try {
    if (step.клик) await click(step.клик);
    else if (step.ввод) {
      const [testId, text] = step.ввод;
      await ev(`(()=>{const el=document.querySelector('[data-testid="${testId}"]');
        if(!el) throw new Error('нет поля ${testId}');
        const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
        set.call(el, ${JSON.stringify(text)}); el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
      await wait(200);
    } else if (step.жди) await wait(step.жди);
    else if (step.верно !== undefined) {
      // Ответить правильно столько раз, сколько сказано. Нужный вариант берём
      // у самой игры (play-expected), а не угадываем: инструкция снимается с
      // настоящего прохождения
      for (let k = 0; k < (step.верно || 1); k++) {
        const onPlay = await ev(`!!document.querySelector('[data-testid=play-expected]')`);
        if (!onPlay) break;
        const expected = await ev(`document.querySelector('[data-testid=play-expected]')?.innerText ?? null`);
        if (!expected) throw new Error('игра не сообщает верный вариант');
        await click(`play-option-${expected.trim()}`);
        await wait(step.пауза ?? 850);
      }
    } else if (step.верно2 !== undefined) {
      // Тип 2: загаданное слово написано на экране («Найди: …»), а карточки
      // адресуются идентификатором. Перевод имени в идентификатор берём из
      // ТОГО ЖЕ пакета контента, которым играет приложение
      if (!словарь) throw new Error('для шага «верно2» в сценарии нужен «словарь»');
      for (let k = 0; k < (step.верно2 || 1); k++) {
        const asked = await ev(`document.querySelector('[data-testid=spoken-word]')?.innerText ?? null`);
        if (!asked) break;
        const name = asked.replace(/^Найди:/, '').split(String.fromCharCode(10))[0].trim();
        const wordId = словарь.get(name);
        if (!wordId) throw new Error(`слово «${name}» не найдено в пакете`);
        await click(`option-${wordId}`);
        await wait(step.пауза ?? 900);
      }
    } else if (step.неверно2) {
      if (!словарь) throw new Error('для шага «неверно2» в сценарии нужен «словарь»');
      const asked = await ev(`document.querySelector('[data-testid=spoken-word]')?.innerText ?? null`);
      const name = String(asked).replace(/^Найди:/, '').split(String.fromCharCode(10))[0].trim();
      const right = словарь.get(name);
      const wrong = await ev(`(()=>{const opts=[...document.querySelectorAll('[data-testid^=option-]')]
        .map(e=>e.dataset.testid.replace('option-','')).filter(v=>v!==${JSON.stringify(right)});
        return opts.length?opts[0]:null})()`);
      if (!wrong) throw new Error('не нашлось неверной карточки');
      await click(`option-${wrong}`);
      await wait(400);
    } else if (step.неверно) {
      const wrong = await ev(`(()=>{const exp=document.querySelector('[data-testid=play-expected]')?.innerText?.trim();
        const opts=[...document.querySelectorAll('[data-testid^=play-option-]')]
          .map(e=>e.dataset.testid.replace('play-option-',''))
          .filter(v=>v!==exp);
        return opts.length?opts[0]:null})()`);
      if (!wrong) throw new Error('не нашлось неверного варианта');
      await click(`play-option-${wrong}`);
      await wait(350);
    }
    else if (step.проверь) {
      const ok = await ev(`!!document.querySelector('[data-testid="${step.проверь}"]')`);
      if (!ok) throw new Error(`ожидался элемент [${step.проверь}], его нет`);
    } else if (step.снимок) {
      // Кадрируем по СОДЕРЖИМОМУ, а не снимаем окно целиком. Две причины:
      // вокруг карточки много пустого фона, а в подвале стоит технический
      // путь к каталогу данных — на стенде он временный и в инструкции
      // только запутает. Подрисовки здесь нет: кадр обрезан, содержимое
      // ровно то, что показало приложение.
      const skip = plan.неснимать ?? ['alphabet-storage-note'];
      const box = await ev(`(()=>{const skip=${JSON.stringify(skip)};
        // Контейнеры во весь экран (корень рантайма, обёртка сцены) исключаем
        // по площади: иначе рамка растягивается на всё окно и кадрирование
        // теряет смысл. Порог 85 % площади окна — именно такие обёртки
        const area=window.innerWidth*window.innerHeight;
        const els=[...document.querySelectorAll('[data-testid]')]
          .filter(e=>!skip.includes(e.dataset.testid))
          .filter(e=>{const r=e.getBoundingClientRect();
            return r.width>0&&r.height>0&&(r.width*r.height)<area*0.85;});
        if(!els.length) return null;
        let l=1e9,t=1e9,r2=-1e9,b=-1e9;
        for(const e of els){const r=e.getBoundingClientRect();
          l=Math.min(l,r.left);t=Math.min(t,r.top);r2=Math.max(r2,r.right);b=Math.max(b,r.bottom);}
        const m=16;
        l=Math.max(0,Math.floor(l-m));t=Math.max(0,Math.floor(t-m));
        r2=Math.min(window.innerWidth,Math.ceil(r2+m));b=Math.min(window.innerHeight,Math.ceil(b+m));
        return JSON.stringify({x:l,y:t,width:r2-l,height:b-t,scale:1})})()`);
      const clip = step.целиком || !box ? undefined : JSON.parse(box);
      // Служебную строку прячем НА ВРЕМЯ СНИМКА. Исключить её из рамки мало:
      // она лежит внутри кадра, между карточкой и рассадкой. На стенде в ней
      // стоит временный каталог, и в инструкции он только запутает. Это
      // сокрытие технической строки, а не подмена содержимого; в самом
      // документе оговорено, что строка скрыта и где смотреть настоящий путь
      await ev(`(()=>{for(const t of ${JSON.stringify(skip)}){
        const e=document.querySelector('[data-testid="'+t+'"]'); if(e) e.style.visibility='hidden';}})()`);
      const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, ...(clip ? { clip } : {}) });
      await ev(`(()=>{for(const t of ${JSON.stringify(skip)}){
        const e=document.querySelector('[data-testid="'+t+'"]'); if(e) e.style.visibility='';}})()`);
      const data = shot.result?.data;
      if (!data) throw new Error('снимок не получен');
      const file = path.join(outDir, `${step.снимок}.png`);
      fs.writeFileSync(file, Buffer.from(data, 'base64'));
      captured.push({ имя: step.снимок, подпись: step.подпись ?? '', байт: fs.statSync(file).size });
      console.log(`снято: ${step.снимок}.png (${(fs.statSync(file).size / 1024).toFixed(0)} КБ)`);
    } else throw new Error('непонятный шаг');
  } catch (e) {
    const scene = await ev(`document.body.innerText`).catch(() => '(не прочитан)');
    throw new Error(`шаг ${i + 1} ${label} — ${e.message}\nЧто на экране:\n${String(scene).slice(0, 400)}`);
  }
}
fs.writeFileSync(path.join(outDir, 'снимки.json'), JSON.stringify(captured, null, 1));
console.log(`\nвсего снимков: ${captured.length} → ${outDir}`);
sock.close();
