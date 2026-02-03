#!/bin/bash
################################################################################
# Диагностика проблемы в AdminController getLicenses
################################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Диагностика AdminController                                      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

SERVER_PATH="/opt/kiosk/kiosk-content-platform/packages/server"

echo -e "${BLUE}[1] Логи License Server:${NC}"
echo ""
journalctl -u kiosk-license-server -n 30 --no-pager | grep -A5 -B5 "getLicenses\|licenses error"
echo ""

echo -e "${BLUE}[2] Проверка функции getLicenses в исходнике:${NC}"
echo ""
cd "$SERVER_PATH"
echo "Поиск 'storageLimit' в AdminController.ts:"
grep -n "storageLimit" src/controllers/AdminController.ts | head -10
echo ""

echo -e "${BLUE}[3] Проверка скомпилированного файла:${NC}"
echo ""
echo "Поиск 'storageLimit' в AdminController.js:"
grep -n "storageLimit" dist/controllers/AdminController.js | head -10
echo ""

echo -e "${BLUE}[4] Фрагмент функции getLicenses (TypeScript):${NC}"
echo ""
sed -n '/static async getLicenses/,/static async [a-zA-Z]/p' src/controllers/AdminController.ts | head -50
echo ""
