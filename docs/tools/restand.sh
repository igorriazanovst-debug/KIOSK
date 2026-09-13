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
# Использование: ./restand.sh <stage-alphabet|stage-words> <порт> <подкаталог>
set -e
SP="C:/Users/89892/AppData/Local/Temp/claude/c--Users-89892-OneDrive--------------Projects/c1c315e8-15ef-4d23-914f-2f1ac3daa4b5/scratchpad"
STAND="$1"
PORT="$2"
SUBDIR="$3"

powershell -NoProfile -Command "Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force" 2>/dev/null || true
sleep 2
rm -rf "$SP/shot-data/$SUBDIR"
mkdir -p "$SP/shot-data"

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
