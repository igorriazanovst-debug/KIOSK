#!/bin/bash
# K2-F6: при удалении пакета убрать его sudoers-правило (создано postinst).
# Без ${...} - файл прогоняется через шаблонизатор electron-builder.
set -e
PKG="$(basename "$0" .postrm)"
if [ -n "$PKG" ] && [ "$PKG" != "postrm" ]; then
  rm -f "/etc/sudoers.d/$PKG"-uninstall
fi
exit 0
