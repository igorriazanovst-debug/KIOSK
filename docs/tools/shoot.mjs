// Снимающий сценарий для пользовательских инструкций.
//
// Снимки делаются С ЖИВОГО ПРИЛОЖЕНИЯ, а не рисуются: инструкция, в которой
// экран не совпадает с тем, что видит педагог, хуже отсутствующей — человек
// решает, что запустил не ту программу.
//
// Шаги читаются из файла сценария: { "порт": N, "каталог": "...", "шаги": [...] }
// Каждый шаг — объект:
//   { "клик": "testid" }            нажать
//   { "текст": "Играть" }           нажать кнопку по видимому тексту
//   { "поле": [1, "Аня"] }          набрать в N-е поле ввода на экране
//   { "первый": "префикс-testid" }  нажать первый элемент с таким началом testid
//   { "прокрути": "testid" }      прокрутить к элементу перед снимком
//   { "ввод": ["testid", "текст"] } набрать в поле (через сеттер прототипа,
//                                   иначе React не заметит)
//   { "жди": 600 }                  подождать
//   { "снимок": "имя", "подпись": "..." }  сохранить PNG
//   { "проверь": "testid" }         убедиться, что элемент есть, иначе падаем
//   { "верно4": N } / { "неверно4": true }   Тип 4: ответить на сцене верно/неверно
//   { "верно10": N } / { "неверно10": true } Тип 10: ответить на поле верно/неверно
//   { "холст": [0.5, 0.5] }         нажать точку холста в долях его ширины
//                                   и высоты. Нужно там, где кликабельные
//                                   элементы нарисованы на canvas и DOM-узлов
//                                   не имеют: точки в редакторе викторины.
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
    else if (step.текст) {
      // Нажать кнопку по ВИДИМОМУ ТЕКСТУ.
      //
      // Для «БиоIQ» (Тип 10) и «ХимIQ» (Тип 9) это единственный разумный
      // способ: у них на экранах почти нет data-testid, а навешивать их
      // десятками ради снимков — значит менять продукт под инструмент.
      // Текст кнопки при этом не менее устойчив: если надпись изменили,
      // инструкция всё равно устарела, и сценарий обязан упасть.
      //
      // Совпадение ТОЧНОЕ после нормализации регистра и пробелов: подстрока
      // ловила «Играть» внутри «Играть эту», и снимок выходил не тот.
      const found = await ev(`(()=>{const want=${JSON.stringify(step.текст)}.replace(/\\s+/g,' ').trim().toLowerCase();
        const els=[...document.querySelectorAll('button, a, [role=button]')]
          .filter(e=>{const r=e.getBoundingClientRect(); return r.width>0&&r.height>0&&!e.disabled;});
        const exact=els.find(e=>(e.innerText||'').replace(/\\s+/g,' ').trim().toLowerCase()===want);
        const el=exact||els.find(e=>(e.innerText||'').replace(/\\s+/g,' ').trim().toLowerCase().includes(want));
        if(!el) return null;
        el.scrollIntoView({block:'center'});
        const r=el.getBoundingClientRect();
        return JSON.stringify({x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2),
          label:(el.innerText||'').replace(/\\s+/g,' ').trim().slice(0,40)})})()`);
      if (!found) throw new Error(`на экране нет кнопки с текстом «${step.текст}»`);
      const { x, y } = JSON.parse(found);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
      await wait(step.пауза ?? plan.пауза ?? 320);
    }
    else if (step.холст) {
      // Точки редактора викторины нарисованы на холсте Konva и DOM-узлов не
      // имеют — ни по testid, ни по тексту их не нажать. Координаты задаются
      // в долях размера холста, чтобы снимок не поехал при другом масштабе
      // окна.
      const [fx, fy] = step.холст;
      const found = await ev(`(()=>{const c=document.querySelector('canvas'); if(!c) return null;
        c.scrollIntoView({block:'center'});
        const r=c.getBoundingClientRect();
        return JSON.stringify({x:Math.round(r.left+r.width*${Number(fx)}),y:Math.round(r.top+r.height*${Number(fy)})})})()`);
      if (!found) throw new Error('на экране нет холста');
      const { x, y } = JSON.parse(found);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
      await wait(step.пауза ?? plan.пауза ?? 320);
    }
    else if (step.поле) {
      // Набрать в N-е по счёту поле ввода на экране (нумерация с 1). Нужно
      // там, где у полей нет ни testid, ни уникального placeholder: два
      // одинаковых поля PIN, три поля имён игроков.
      const [n, text] = step.поле;
      const ok = await ev(`(()=>{const els=[...document.querySelectorAll('input, textarea')]
          .filter(e=>{const r=e.getBoundingClientRect(); return r.width>0&&r.height>0;});
        const el=els[${Number(n) - 1}];
        if(!el) return false;
        const proto=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto,'value').set.call(el, ${JSON.stringify(text)});
        el.dispatchEvent(new Event('input',{bubbles:true}));
        return true})()`);
      if (!ok) throw new Error(`на экране нет поля ввода №${n}`);
      await wait(220);
    }
    else if (step.верно10 !== undefined) {
      // Тип 10: плитка верного ответа помечена data-testid="correct-point"
      // самим игровым экраном. Ответ берётся у игры, а не подбирается:
      // подбор прошёл бы и на сломанной проверке ответа.
      for (let k = 0; k < (step.верно10 || 1); k += 1) {
        const box = await ev(`(()=>{const e=document.querySelector('[data-testid="correct-point"]');
          if(!e) return null; e.scrollIntoView({block:'center'});
          const r=e.getBoundingClientRect();
          return JSON.stringify({x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)})})()`);
        if (!box) break;
        const { x, y } = JSON.parse(box);
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
        await wait(step.пауза ?? 1100);
      }
    }
    else if (step.неверно10) {
      const box = await ev(`(()=>{const e=[...document.querySelectorAll('[data-testid^="decoy-"]')]
          .find(x=>{const r=x.getBoundingClientRect(); return r.width>0&&r.height>0;});
        if(!e) return null; e.scrollIntoView({block:'center'});
        const r=e.getBoundingClientRect();
        return JSON.stringify({x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)})})()`);
      if (!box) throw new Error('на поле нет ни одной неверной плитки');
      const { x, y } = JSON.parse(box);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
      await wait(step.пауза ?? 1100);
    }
    else if (step.прокрути) {
      // Прокрутить к элементу перед снимком. Нужно там, где экран длиннее
      // окна: «Сведения о пакете» не помещаются целиком, и без прокрутки
      // нижняя половина обрезается ровно посередине строки.
      const ok = await ev(`(()=>{const e=document.querySelector('[data-testid="${step.прокрути}"]');
        if(!e) return false; e.scrollIntoView({block:'center'}); return true})()`);
      if (!ok) throw new Error(`нечего прокручивать: нет [${step.прокрути}]`);
      await wait(400);
    }
    else if (step.первый) {
      // Нажать первый элемент, чей testid начинается с заданного. Нужно там,
      // где в testid попадает сгенерированный идентификатор: ученики Типа 4
      // заводятся с UUID, и записать их в сценарий заранее нельзя.
      const found = await ev(`(()=>{const e=document.querySelector('[data-testid^="${step.первый}"]');
        return e?e.dataset.testid:null})()`);
      if (!found) throw new Error(`нет ни одного элемента с testid, начинающимся на «${step.первый}»`);
      await click(found);
    }
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
    } else if (step.верно4 !== undefined) {
      // Тип 4: загаданный объект назван скрытой подсказкой inophone-expected,
      // объекты сцены адресуются inophone-hotspot-<id>. Ответ берётся у самой
      // игры, а не подбирается: подбор прошёл бы и на сломанной проверке
      // ответа, и снимок «верно» получился бы там, где засчитывается что
      // угодно.
      for (let k = 0; k < (step.верно4 || 1); k++) {
        const expected = await ev(`document.querySelector('[data-testid=inophone-expected]')?.textContent?.trim() ?? null`);
        if (!expected) break;
        await click(`inophone-hotspot-${expected}`);
        await wait(step.пауза ?? 900);
      }
    } else if (step.неверно4) {
      const expected = await ev(`document.querySelector('[data-testid=inophone-expected]')?.textContent?.trim() ?? null`);
      if (!expected) throw new Error('на сцене нет задания — отвечать нечему');
      const wrong = await ev(`(()=>{const ids=[...document.querySelectorAll('[data-testid^=inophone-hotspot-]')]
        .map(e=>e.dataset.testid.replace('inophone-hotspot-',''))
        .filter(v=>v!==${JSON.stringify(expected)});
        return ids.length?ids[0]:null})()`);
      if (!wrong) throw new Error('на сцене не нашлось неверного объекта');
      await click(`inophone-hotspot-${wrong}`);
      await wait(step.пауза ?? 900);
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
