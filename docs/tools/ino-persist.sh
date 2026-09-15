#!/bin/sh
# Терпеливая дорисовка: гоняет генератор кругами, пока не останется ни одной
# недостающей картинки.
#
# ЗАЧЕМ КРУГАМИ. SYNTX пускает пачками: девять картинок подряд, потом страница
# перестаёт отвечать, и сколько ни перезагружай в ту же минуту — толку нет.
# Через несколько минут доступ возвращается сам. Один длинный прогон в такой
# картине бесполезен: он упирается в глухую стену и сыплет отказами.
#
# ПАУЗА МЕЖДУ КРУГАМИ РАСТЁТ, но до потолка: если сервис лёг надолго, долбить
# его раз в минуту бессмысленно, а сдаваться насовсем — терять уже сделанное.
set -e
SP="/c/Users/89892/AppData/Local/Temp/claude/c--Users-89892-OneDrive--------------Projects/c1c315e8-15ef-4d23-914f-2f1ac3daa4b5/scratchpad"
LIB="$SP/KIOSK/packages/inophone-library"
ART="$SP/ino-art"
LOG="$SP/ino-persist.log"
# Сколько всего нужно — БЕРЁТСЯ ИЗ ПАКЕТА, а не пишется числом. Зашитое число
# устарело в тот же вечер, когда в словарь добавили тему: цикл считал, что
# осталось одиннадцать, когда на деле было тридцать пять
# Путь передаётся ОТНОСИТЕЛЬНЫЙ, из каталога пакета. Абсолютный путь в стиле
# MSYS (/c/Users/…) Windows-сборка node не понимает: она подставляет C:\c\ и
# не находит файл
TOTAL=$(cd "$LIB" && node -e "console.log(JSON.parse(require('fs').readFileSync('index.json','utf8')).concepts.length)")
ROUNDS=40
PAUSE=60
MAXPAUSE=600

# ОДИН ЦИКЛ НА МАШИНУ, И ЭТО НЕ ФОРМАЛЬНОСТЬ. Два цикла дерутся за одну
# вкладку браузера: каждый видит индикатор загрузки, поставленный другим, и
# считает страницу занятой. Снаружи это неотличимо от отказа сервиса — я два
# часа искал ограничение на стороне SYNTX, пока причина была здесь.
LOCK="$SP/ino-persist.lock"
if [ -e "$LOCK" ]; then
  old_pid=$(cat "$LOCK" 2>/dev/null)
  if [ -n "$old_pid" ] && kill -0 "$old_pid" 2>/dev/null; then
    printf 'цикл уже работает (PID %s) — второй не запускаю
' "$old_pid"
    exit 0
  fi
  printf 'замок остался от умершего цикла, снимаю
'
fi
echo $$ > "$LOCK"
trap 'rm -f "$LOCK"' EXIT INT TERM

: > "$LOG"
round=1
while [ $round -le $ROUNDS ]; do
  have=$(ls "$ART"/*.jpg 2>/dev/null | wc -l | tr -d ' ')
  left=$((TOTAL - have))
  printf '[круг %s] нарисовано %s, осталось %s\n' "$round" "$have" "$left" >> "$LOG"
  if [ "$left" -le 0 ]; then
    printf 'ВСЁ НАРИСОВАНО\n' >> "$LOG"
    exit 0
  fi

  cd "$SP"
  env -u ELECTRON_RUN_AS_NODE node syntx-reload.mjs >/dev/null 2>&1 || true
  cd "$LIB"
  env -u ELECTRON_RUN_AS_NODE node tools/generate-illustrations.mjs 9444 "$ART" >> "$LOG" 2>&1 || true

  after=$(ls "$ART"/*.jpg 2>/dev/null | wc -l | tr -d ' ')
  if [ "$after" -gt "$have" ]; then
    # Круг был удачным — сервис пускает, следующий пробуем сразу
    PAUSE=60
  else
    PAUSE=$((PAUSE * 2))
    [ "$PAUSE" -gt "$MAXPAUSE" ] && PAUSE=$MAXPAUSE
  fi
  printf '[круг %s] стало %s, пауза %s с\n' "$round" "$after" "$PAUSE" >> "$LOG"
  sleep "$PAUSE"
  round=$((round + 1))
done
printf 'КРУГИ КОНЧИЛИСЬ, осталось %s\n' "$((TOTAL - $(ls "$ART"/*.jpg 2>/dev/null | wc -l | tr -d ' ')))" >> "$LOG"
