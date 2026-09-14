// packages/player/tools/build-app.mjs
// Сборка ОТДЕЛЬНОГО приложения-виджета: «Я знаю много слов», «АзбукоСлов»,
// «Инофон».
//
// ЗАЧЕМ ЭТО ВООБЩЕ ПОЯВИЛОСЬ. Установщики Типов 2 и 3 собирались вручную:
// правился `electron/project.json`, подменялось имя продукта, запускался
// electron-builder. По репозиторию воспроизвести переданный заказчику
// установщик было НЕЛЬЗЯ. Обнаружилось это тем, что у коллеги не запустился
// Тип 3, и первым же вопросом стало «а что именно ему дали» — ответа не было.
//
// ПРОЕКТ, ВШИТЫЙ В СБОРКУ, НЕ ССЫЛАЕТСЯ НА СЕРВЕР. Ни `serverUrl`, ни
// `licenseKeyHash`: с ними главный процесс открывает окно активации и требует
// входа в центральный сервер (см. initPlayerAuth в main.js). На чужой машине
// без лицензии это выглядит ровно как «приложение не запускается».
//
// КАЖДОЕ ПРИЛОЖЕНИЕ ВЕЗЁТ ТОЛЬКО СВОЙ КОНТЕНТ. Пакеты чужих виджетов весят
// десятки мегабайт и никому в этой сборке не нужны; их отсутствие главный
// процесс переживает, записывая предупреждение в журнал.
//
// Запуск: node tools/build-app.mjs <words|alphabet|inophone> [--dir]
//   --dir — собрать распакованный каталог без установщика (быстрее, для проверки)

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLAYER = path.join(HERE, '..');

/**
 * Что собирается. Свойства виджета здесь ЗАДАНЫ ЯВНО, а не берутся из
 * умолчаний пакета: установщик — это поставка, и то, каким приложение
 * откроется у педагога, должно быть видно в репозитории, а не выводиться.
 */
const APPS = {
  words: {
    productName: 'Я знаю много слов',
    appId: 'ru.kiosk.words',
    dirName: 'words',
    library: 'words-library',
    widget: {
      type: 'words',
      properties: { title: 'Я знаю много слов', questionCount: 10, defaultPlayerCount: 1, volume: 70 },
    },
    background: '#2b6cb0',
  },
  alphabet: {
    productName: 'АзбукоСлов',
    appId: 'ru.kiosk.alphabet',
    dirName: 'alphabet',
    library: 'alphabet-library',
    widget: {
      type: 'alphabet',
      properties: {
        title: 'АзбукоСлов',
        enabledSetIds: [],
        defaultStage: 'letterShow',
        questionCount: 10,
        defaultPlayerCount: 1,
        volume: 70,
      },
    },
    background: '#63b8e8',
  },
  inophone: {
    productName: 'Инофон',
    appId: 'ru.kiosk.inophone',
    dirName: 'inophone',
    library: 'inophone-library',
    widget: {
      type: 'inophone',
      properties: {
        title: 'Инофон',
        interfaceLanguage: 'ru',
        studyLanguages: ['en'],
        defaultMode: 'learning',
        questionCount: 10,
        defaultPlayerCount: 1,
        volume: 70,
      },
    },
    background: '#1d2b3a',
  },
};

const name = process.argv[2];
const dirOnly = process.argv.includes('--dir');
const app = APPS[name];
if (!app) {
  console.error(`Запуск: node tools/build-app.mjs <${Object.keys(APPS).join('|')}> [--dir]`);
  process.exit(1);
}

const libraryDir = path.resolve(PLAYER, '..', app.library);
if (!fs.existsSync(path.join(libraryDir, 'index.json'))) {
  console.error(`Нет собранного пакета контента: ${libraryDir}/index.json`);
  process.exit(1);
}

// Холст — 1920×1080. Реального размера окна он не задаёт (standalone-виджет
// занимает весь экран, см. isStandaloneAppProject), но остаётся в проекте как
// исходный расчётный размер
const project = {
  id: crypto.randomUUID(),
  name: app.productName,
  version: '1.0',
  canvas: { width: 1920, height: 1080, backgroundColor: app.background },
  widgets: [
    {
      id: crypto.randomUUID(),
      type: app.widget.type,
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
      rotation: 0,
      zIndex: 1,
      properties: app.widget.properties,
    },
  ],
};

const projectFile = path.join(PLAYER, 'electron', 'project.json');
const backup = fs.readFileSync(projectFile, 'utf8');

const config = {
  appId: app.appId,
  productName: app.productName,
  directories: { output: path.join('dist-electron', app.dirName), buildResources: 'assets' },
  files: ['dist/**/*', 'electron/**/*', 'package.json', '!electron/*.bak*', '!electron/*.backup*', '!**/*.bak*'],
  extraResources: [
    { from: 'electron/project.json', to: 'project.json' },
    { from: `../${app.library}`, to: app.library, filter: ['**/*', '!README.md', '!tools/**', '!package.json'] },
  ],
  win: { target: [{ target: dirOnly ? 'dir' : 'nsis', arch: ['x64'] }], sign: null, icon: 'assets/icon.ico' },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    runAfterFinish: false,
    shortcutName: app.productName,
    artifactName: '${productName}-Setup-${version}.${ext}',
  },
};

const configFile = path.join(os.tmpdir(), `kiosk-builder-${app.dirName}-${process.pid}.json`);
fs.writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf8');

try {
  fs.writeFileSync(projectFile, JSON.stringify(project, null, 2) + '\n', 'utf8');
  console.log(`${app.productName}: проект вшит, виджет «${app.widget.type}», сервер не указан`);

  execFileSync('npx', ['electron-builder', '--win', '--config', configFile], {
    cwd: PLAYER,
    stdio: 'inherit',
    shell: true,
    // ELECTRON_RUN_AS_NODE ломает запуск electron из сборщика: тот стартует как
    // обычный Node и падает на «bad option: --no-sandbox»
    env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
  });
} finally {
  // Проект возвращается НА МЕСТО в любом случае: иначе следующая сборка или
  // запуск из исходников подхватят чужой виджет, и понять это будет непросто
  fs.writeFileSync(projectFile, backup, 'utf8');
  fs.rmSync(configFile, { force: true });
}

const outDir = path.join(PLAYER, 'dist-electron', app.dirName);
const made = fs.existsSync(outDir) ? fs.readdirSync(outDir).filter((f) => f.endsWith('.exe')) : [];
console.log(`готово: ${outDir}`);
for (const f of made) {
  const size = fs.statSync(path.join(outDir, f)).size / 1024 / 1024;
  console.log(`  ${f} — ${size.toFixed(0)} МБ`);
}
