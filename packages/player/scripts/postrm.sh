#!/bin/bash
# K2-F6: при удалении пакета убрать его sudoers-правило (создано postinst).
# V-123: при remove (не upgrade) убрать и файл автозапуска этого пакета из
# autostart всех пользователей — иначе в автозагрузке ОС остаётся битая
# ссылка на удалённое приложение. Имя файла автозапуска = sanitize(appId),
# appId = package.json name; пакеты итог-сборок именуются уже-валидным
# ASCII-именем, совпадающим с именем пакета, поэтому путь предсказуем.
# Без ${...} - файл прогоняется через шаблонизатор electron-builder.
set -e
PKG="$(basename "$0" .postrm)"
if [ -n "$PKG" ] && [ "$PKG" != "postrm" ]; then
  rm -f "/etc/sudoers.d/$PKG"-uninstall
  if [ "$1" = "remove" ]; then
    for home_dir in /root /home/*; do
      [ -d "$home_dir/.config/autostart" ] && rm -f "$home_dir/.config/autostart/$PKG.desktop"
    done
  fi
fi
exit 0
