// Печать HTML в PDF через Electron.
//
// ПОЧЕМУ НЕ CHROME. Headless Chrome на этой машине молча не создавал файл и
// ничего не писал в вывод — ни ошибки, ни кода возврата. Разбираться, что
// именно ему мешает (запущенный профиль, политика, что-то ещё), дороже, чем
// взять Electron, который уже лежит в проекте: здесь весь процесс под
// контролем и любая неудача видна.
//
// Запуск:
//   electron.exe pdf-print <входной.html> <выходной.pdf>
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

// argv у главного процесса Electron: [electron.exe, каталог приложения, ...свои].
// slice(2) уже отбрасывает и то, и другое — второй срез тут был лишним и
// съедал первый настоящий аргумент
const [inputPath, outputPath] = process.argv.slice(2).filter((a) => !a.startsWith('--'));

if (!inputPath || !outputPath) {
  console.error('нужны два аргумента: входной .html и выходной .pdf');
  app.exit(2);
}

app.on('ready', async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 1600,
    webPreferences: { offscreen: true, sandbox: false },
  });

  try {
    await win.loadFile(inputPath);

    // Ждём, пока разложится вёрстка и декодируются вшитые картинки: печать
    // сразу после loadFile даёт страницы с пустыми местами вместо снимков
    await win.webContents.executeJavaScript(`
      new Promise((resolve) => {
        const imgs = [...document.images];
        const pending = imgs.filter((i) => !i.complete);
        if (pending.length === 0) return resolve(imgs.length);
        let left = pending.length;
        const done = () => { if (--left === 0) resolve(imgs.length); };
        pending.forEach((i) => { i.addEventListener('load', done); i.addEventListener('error', done); });
      })
    `);

    const data = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 },
      preferCSSPageSize: false,
    });

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, data);
    console.log(`готов: ${path.basename(outputPath)} — ${(data.length / 1024 / 1024).toFixed(1)} МБ`);
    app.exit(0);
  } catch (e) {
    console.error('печать не удалась:', e && e.message ? e.message : e);
    app.exit(1);
  }
});
