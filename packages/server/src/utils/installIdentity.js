import { sanitizePackageName } from './packageName.js';

// ЗАЧЕМ. Папку установки Windows-установщик берёт из названия приложения, но
// только если оно набрано латиницей; кириллическое («БиоIQ», «ФизАстроIQ»)
// electron-builder отбрасывает и подставляет имя пакета. Пока имя пакета было
// одно на всех — «@kiosk-platform/player», — все приложения KIOSK ставились в
// одну папку «@kiosk-platformplayer» и затирали друг друга: на компьютере
// школы работало только последнее установленное.
//
// От имени пакета зависит и каталог профиля приложения (%APPDATA%\<имя>).
// Поэтому идентификатор устройства плеер хранит НЕ в профиле, а в общем
// каталоге (player/electron/common/deviceIdStore.js): иначе каждое приложение
// занимало бы отдельное место лицензии.
//
// Каталоги данных виджетов называются «kiosk-<виджет>» и лежат там же, в
// %APPDATA%. Имя пакета не должно с ними совпасть: профиль приложения и
// викторины педагога оказались бы в одной папке.
const WIDGET_DATA_DIR_RE = /^kiosk-[a-z0-9]+$/;
// Имена устройств Windows: каталог с таким именем (в том числе «con.что-угодно»)
// создать нельзя, установка упала бы без внятной причины.
const WINDOWS_RESERVED_RE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/;
const SAFE_PREFIX = 'app-';
// appId приходит из тела запроса. Имя каталога входит в каждый путь внутри
// установленного приложения, поэтому длину держим далеко от MAX_PATH.
const MAX_NAME_LENGTH = 60;

export function withWindowsInstallIdentity(packageJson, appId, platform) {
  if (platform !== 'win') return packageJson;
  const base = sanitizePackageName(appId);
  const needsPrefix = WIDGET_DATA_DIR_RE.test(base) || WINDOWS_RESERVED_RE.test(base);
  const name = ((needsPrefix ? SAFE_PREFIX : '') + base)
    .slice(0, MAX_NAME_LENGTH)
    .replace(/[^a-z0-9]+$/, '');
  return { ...packageJson, name };
}
