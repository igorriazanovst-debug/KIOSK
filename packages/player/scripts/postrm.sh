#!/bin/bash
# K2-F6: при удалении пакета убрать его sudoers-правило (файл правил создан
# postinst этого же пакета).
set -e
PKG="$(basename "$0" .postrm)"
if [ -n "$PKG" ] && [ "$PKG" != "postrm" ]; then
  rm -f /etc/sudoers.d/${PKG}-uninstall
fi
exit 0
