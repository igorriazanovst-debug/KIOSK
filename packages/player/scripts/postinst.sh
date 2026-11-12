#!/bin/bash
# K2-F6: passwordless-правило ТОЛЬКО для удаления этого пакета (dpkg/apt),
# чтобы подписанное удалённое удаление (device:uninstall) не требовало
# ручного пароля на киоске. Имя пакета берём из пути postinst
# (/var/lib/dpkg/info/<пакет>.postinst) - никаких шаблонов при сборке.
set -e
PKG="$(basename "$0" .postinst)"
if [ -n "$PKG" ] && [ "$PKG" != "postinst" ]; then
  SUDOERS_FILE=/etc/sudoers.d/${PKG}-uninstall
  cat > "$SUDOERS_FILE" <<RULE
# Managed by ${PKG} (KIOSK): allows only removal of this package, no password
ALL=(root) NOPASSWD: /usr/bin/dpkg -r ${PKG}, /usr/bin/apt-get remove -y ${PKG}
RULE
  chmod 0440 "$SUDOERS_FILE"
  chown root:root "$SUDOERS_FILE" 2>/dev/null || true
fi
exit 0
