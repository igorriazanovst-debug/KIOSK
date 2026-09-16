#!/bin/sh
# Перезапуск стенда для съёмки с ЧИСТОГО состояния.
#
# Снимки для инструкции должны быть воспроизводимы: прогнал сценарий заново —
# получил те же экраны. Без сброса второй прогон падает на «такое имя уже
# есть», и это правильно — инструкция не должна собираться из случайного
# состояния, накопленного прошлыми запусками.
#
# ХРАНИЛИЩЕ ПОДМЕНЕНО через PROGRAMDATA: стенд пишет в scratchpad/shot-data и
# НЕ ТРОГАЕТ данные педагога в C:\ProgramData\kiosk-alphabet.
#
# Использование: ./restand.sh <стенд> <порт> <подкаталог> [каталог в %APPDATA%]
#   ./restand.sh stage-alphabet 9677 kiosk-alphabet
#   ./restand.sh stage-bioiq   9680 kiosk-bioiq kiosk-bioiq
set -e
SP="C:/Users/89892/AppData/Local/Temp/claude/c--Users-89892-OneDrive--------------Projects/c1c315e8-15ef-4d23-914f-2f1ac3daa4b5/scratchpad"
STAND="$1"
PORT="$2"
SUBDIR="$3"

# Четвёртый аргумент — каталог в %APPDATA%, который тоже надо снести.
#
# ЗАЧЕМ ОН НУЖЕН. Типы 2, 3 и 4 хранят данные в общем каталоге
# (%ProgramData%\kiosk-*), и подмена PROGRAMDATA ниже уводит стенд от данных
# педагога. Типы 7, 9 и 10 («РусIQ», «ХимIQ», «БиоIQ») берут
# app.getPath('appData'), то есть %APPDATA%, — на них подмена НЕ действует, и
# стенд пишет в настоящий каталог. Пока это так, чистить его надо явно, иначе
# второй прогон съёмки начнётся с накопленного состояния и снимки разъедутся.
APPDIR="$4"

powershell -NoProfile -Command "Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force" 2>/dev/null || true
sleep 2
rm -rf "$SP/shot-data/$SUBDIR"
mkdir -p "$SP/shot-data"
if [ -n "$APPDIR" ]; then
  rm -rf "$APPDATA/$APPDIR"
  echo "снесён каталог данных $APPDATA/$APPDIR"
fi

cd "$SP"
env -u ELECTRON_RUN_AS_NODE PROGRAMDATA="$SP/shot-data" \
  KIOSK/packages/player/node_modules/electron/dist/electron.exe "$STAND" \
  --remote-debugging-port="$PORT" > "$SP/shot-stand-$PORT.log" 2>&1 &

for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  sleep 2
  if curl -s --max-time 2 "http://127.0.0.1:$PORT/json/version" > /dev/null 2>&1; then
    echo "стенд $STAND поднят на порту $PORT, хранилище чистое"
    exit 0
  fi
done
echo "стенд не поднялся; журнал:"
tail -n 15 "$SP/shot-stand-$PORT.log"
exit 1
