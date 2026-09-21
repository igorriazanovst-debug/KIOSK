// packages/player/electron/common/deviceIdStore.js
//
// Идентификатор устройства — по умолчанию ОДИН НА КОМПЬЮТЕР, а не на приложение
// (исключение — сборки с perAppDeviceId, см. resolveDeviceIdDir ниже).
//
// Сервер считает занятые места лицензии по deviceId. Раньше идентификатор
// лежал в профиле приложения (userData), и это было одно и то же место у всех
// приложений KIOSK, потому что имя пакета у них совпадало. С тех пор как у
// каждого приложения своё имя пакета (server/src/utils/installIdentity.js),
// профили разные — и идентификатор в профиле означал бы отдельное место
// лицензии на каждую викторину, установленную в одном кабинете.
//
// Каталог выбран РОВНО ТОТ, где идентификатор лежал раньше: приложение,
// обновлённое поверх старой версии, находит прежний идентификатор и нового
// места не занимает.

const fs = require('node:fs');
const path = require('node:path');

const DEVICE_ID_FILE = 'device-id.txt';

function sharedDeviceIdDir(appDataDir) {
  return path.join(appDataDir, '@kiosk-platform', 'player');
}

// perApp — только строгий true из project.json сборки (см. server/src/utils/
// buildFlags.js). Нужен, когда каждому приложению выдаётся своя лицензия со
// своим лимитом мест: общий идентификатор закрепил бы компьютер за лицензией
// первого установленного приложения, и остальные не получили бы доступ к своему
// проекту. Сборки без флага работают как раньше — идентификатор общий.
// Внимание: приложение, пересобранное с флагом и установленное поверх старой
// версии, получит НОВЫЙ идентификатор и займёт новое место; старое освобождают
// вручную (DELETE /api/admin/devices/:id).
function resolveDeviceIdDir({ perApp, appDataDir, userDataDir }) {
  return perApp === true ? userDataDir : sharedDeviceIdDir(appDataDir);
}

function readStoredId(idFile) {
  try {
    if (fs.existsSync(idFile)) return fs.readFileSync(idFile, 'utf-8').trim();
  } catch (e) {
    console.error('[device-id] не удалось прочитать идентификатор:', e.message);
  }
  return '';
}

function readOrCreateDeviceId(dir, makeId) {
  const idFile = path.join(dir, DEVICE_ID_FILE);
  const stored = readStoredId(idFile);
  if (stored) return stored;
  const id = makeId();
  try {
    fs.mkdirSync(dir, { recursive: true });
    // 'wx' — создать, только если файла ещё нет. Два приложения, впервые
    // запущенные одновременно (автозапуск киосков при загрузке), иначе
    // записали бы каждое свой идентификатор: сервер увидел бы два устройства.
    fs.writeFileSync(idFile, id, { flag: 'wx' });
  } catch (e) {
    if (e.code === 'EEXIST') {
      const winner = readStoredId(idFile);
      if (winner) return winner;
      // Файл есть, но пуст (оборванная запись): занимаем его, иначе
      // идентификатор менялся бы при каждом запуске.
      try {
        fs.writeFileSync(idFile, id);
        return id;
      } catch (writeError) {
        console.error('[device-id] не удалось перезаписать пустой файл:', writeError.message);
      }
    }
    // Идентификатор всё равно возвращаем: без него плеер не активируется
    // вовсе. Цена — новый идентификатор при следующем запуске.
    console.error('[device-id] не удалось сохранить идентификатор:', e.message);
  }
  return id;
}

module.exports = { sharedDeviceIdDir, resolveDeviceIdDir, readOrCreateDeviceId };
