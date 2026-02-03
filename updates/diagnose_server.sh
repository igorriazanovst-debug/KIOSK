#!/bin/bash
################################################################################
# Диагностика проблемы запуска License Server
################################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Диагностика License Server                                       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${BLUE}[1] Последние 50 строк логов:${NC}"
echo ""
journalctl -u kiosk-license-server -n 50 --no-pager
echo ""

echo -e "${BLUE}[2] Проверка синтаксиса TypeScript:${NC}"
echo ""
cd /opt/kiosk/kiosk-content-platform/packages/server
npm run build 2>&1 | tail -30
echo ""

echo -e "${BLUE}[3] Проверка app.js:${NC}"
echo ""
if [ -f "dist/app.js" ]; then
    echo -e "${GREEN}✓${NC} dist/app.js существует"
    ls -lh dist/app.js
else
    echo -e "${RED}✗${NC} dist/app.js НЕ НАЙДЕН"
fi
echo ""

echo -e "${BLUE}[4] Попытка запуска вручную:${NC}"
echo ""
cd /opt/kiosk/kiosk-content-platform/packages/server
timeout 5 node dist/app.js 2>&1 || true
echo ""
