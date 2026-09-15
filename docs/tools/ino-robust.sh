#!/bin/sh
# Раздел 10 программы испытаний «Инофона»: устойчивость и границы.
#
# ВЫНЕСЕН ОТДЕЛЬНО, потому что каждый пункт требует ПЕРЕЗАПУСКА приложения с
# заранее испорченными данными. Внутри одного прогона это не проверить: файлы
# читаются один раз при старте.
#
# ХРАНИЛИЩЕ ПОДМЕНЕНО через PROGRAMDATA — испытания не трогают данные педагога.
set -e
SP="/c/Users/89892/AppData/Local/Temp/claude/c--Users-89892-OneDrive--------------Projects/c1c315e8-15ef-4d23-914f-2f1ac3daa4b5/scratchpad"
DATA="$SP/shot-data/kiosk-inophone"
PORT=9679
PASS=0
FAIL=0

say() {
  if [ "$1" = "1" ]; then PASS=$((PASS+1)); printf 'ХОРОШО %s  %s\n' "$2" "$3";
  else FAIL=$((FAIL+1)); printf 'ПЛОХО  %s  %s\n' "$2" "$3"; fi
}

restart() {
  powershell -NoProfile -Command "Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force" 2>/dev/null || true
  sleep 3
  cd "$SP"
  env -u ELECTRON_RUN_AS_NODE PROGRAMDATA="$SP/shot-data" \
    "$SP/stage-inophone/node_modules/electron/dist/electron.exe" stage-inophone \
    --remote-debugging-port=$PORT > "$SP/shot-stand-$PORT.log" 2>&1 &
  sleep 11
}

# Текст, видимый на экране приложения
seen() {
  env -u ELECTRON_RUN_AS_NODE node "$SP/ino-probe.mjs" $PORT 2>/dev/null
}

# ─── 10.1 испорченные настройки ────────────────────────────────────────────
printf 'не настройки' > "$DATA/settings.json"
restart
OUT=$(seen)
case "$OUT" in
  *'Кто занимается'*) say 1 '10.1' 'битые настройки: приложение открылось на штатном экране' ;;
  *) say 0 '10.1' "битые настройки: на экране «$(printf '%s' "$OUT" | head -c 80)»" ;;
esac

# ─── 10.2 частично испорченная статистика ──────────────────────────────────
printf '{"p1":{"byScene":"мусор"},"p2":{"byScene":{"bedroom":{"lastSession":[1,2],"total":[1,2]}},"byLanguage":{}}}' > "$DATA/statistics.json"
restart
OUT=$(seen)
case "$OUT" in
  *'Кто занимается'*) say 1 '10.2' 'битая запись статистики не мешает запуску' ;;
  *) say 0 '10.2' "на экране «$(printf '%s' "$OUT" | head -c 80)»" ;;
esac

# ─── 10.3 испорченный список учеников ──────────────────────────────────────
printf '{ это не json' > "$DATA/profiles.json"
restart
OUT=$(seen)
case "$OUT" in
  *повреждён*|*'резервной копии'*) say 1 '10.3' 'битый список учеников: ЯВНАЯ ошибка, а не пустой список' ;;
  *) say 0 '10.3' "ожидалось сообщение о повреждении, видно «$(printf '%s' "$OUT" | head -c 120)»" ;;
esac
rm -f "$DATA/profiles.json" "$DATA/settings.json" "$DATA/statistics.json"

# ─── 10.4 пакет контента отсутствует ───────────────────────────────────────
mv "$SP/KIOSK/packages/inophone-library/index.json" "$SP/ino-index-hidden.json"
restart
OUT=$(seen)
mv "$SP/ino-index-hidden.json" "$SP/KIOSK/packages/inophone-library/index.json"
case "$OUT" in
  *'не найден'*|*'не подключён'*) say 1 '10.4' 'без пакета контента: внятное сообщение, а не белый экран' ;;
  *) say 0 '10.4' "видно «$(printf '%s' "$OUT" | head -c 120)»" ;;
esac

restart
printf '\nИТОГО раздел 10: пройдено %s, провалено %s\n' "$PASS" "$FAIL"
[ "$FAIL" = "0" ]
