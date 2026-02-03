#!/bin/bash
################################################################################
# Пересборка shared пакета и server
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Пересборка @kiosk/shared и server                               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

PROJECT_ROOT="/opt/kiosk/kiosk-content-platform"

echo -e "${BLUE}[1/3] Сборка @kiosk/shared...${NC}"
cd "$PROJECT_ROOT/packages/shared"

if npm run build; then
    echo ""
    echo -e "${GREEN}✓${NC} @kiosk/shared собран"
    echo ""
    echo "Проверка dist:"
    ls -la dist/ | head -10
else
    echo ""
    echo -e "${RED}❌ Ошибка сборки @kiosk/shared${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}[2/3] Сборка @kiosk/server...${NC}"
cd "$PROJECT_ROOT/packages/server"

if npm run build; then
    echo ""
    echo -e "${GREEN}✓${NC} @kiosk/server собран"
else
    echo ""
    echo -e "${RED}❌ Ошибка сборки @kiosk/server${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}[3/3] Перезапуск License Server...${NC}"
systemctl restart kiosk-license-server
sleep 3

if systemctl is-active --quiet kiosk-license-server; then
    echo -e "${GREEN}✓${NC} License Server запущен"
    echo ""
    
    # Health check
    if curl -s http://localhost:3001/health | jq -e '.status' &>/dev/null; then
        echo -e "${GREEN}✓${NC} Health check OK"
    else
        echo -e "${RED}✗${NC} Health check failed"
    fi
else
    echo -e "${RED}❌ License Server не запустился${NC}"
    echo ""
    echo "Логи:"
    journalctl -u kiosk-license-server -n 20 --no-pager
    exit 1
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Пересборка завершена успешно!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}Статус сервисов:${NC}"
systemctl status kiosk-license-server --no-pager | head -10
echo ""
