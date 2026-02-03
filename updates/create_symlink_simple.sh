#!/bin/bash
################################################################################
# Создание symlink для @kiosk/shared вручную
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Создание symlink для @kiosk/shared                              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

PROJECT_ROOT="/opt/kiosk/kiosk-content-platform"
SHARED_PATH="$PROJECT_ROOT/packages/shared"
SERVER_PATH="$PROJECT_ROOT/packages/server"
SYMLINK_PATH="$SERVER_PATH/node_modules/@kiosk/shared"

echo -e "${BLUE}[1/5] Создание директории node_modules/@kiosk...${NC}"
mkdir -p "$SERVER_PATH/node_modules/@kiosk"
echo -e "${GREEN}✓${NC} Директория создана"
echo ""

echo -e "${BLUE}[2/5] Удаление старого symlink (если есть)...${NC}"
rm -rf "$SYMLINK_PATH" 2>/dev/null || true
echo -e "${GREEN}✓${NC} Готово"
echo ""

echo -e "${BLUE}[3/5] Создание symlink...${NC}"
ln -sf "$SHARED_PATH" "$SYMLINK_PATH"

if [ -L "$SYMLINK_PATH" ]; then
    echo -e "${GREEN}✓${NC} Symlink создан"
    echo "  $SYMLINK_PATH -> $(readlink -f $SYMLINK_PATH)"
else
    echo -e "${RED}✗${NC} Не удалось создать symlink"
    exit 1
fi
echo ""

echo -e "${BLUE}[4/5] Пересборка packages...${NC}"

# Собираем shared
echo "Сборка @kiosk/shared..."
cd "$SHARED_PATH"
npm run build
echo -e "${GREEN}✓${NC} @kiosk/shared собран"
echo ""

# Собираем server
echo "Сборка @kiosk/server..."
cd "$SERVER_PATH"
npm run build
echo -e "${GREEN}✓${NC} @kiosk/server собран"
echo ""

echo -e "${BLUE}[5/5] Тест и перезапуск...${NC}"

# Тест require
echo "Тест require('@kiosk/shared'):"
cd "$SERVER_PATH"
if node -e "const shared = require('@kiosk/shared'); console.log('✓ Модуль загружен'); console.log('  Exports:', Object.keys(shared).slice(0, 5).join(', ') + '...');" 2>/dev/null; then
    echo ""
else
    echo -e "${RED}✗${NC} Ошибка загрузки модуля"
    node -e "require('@kiosk/shared')" 2>&1 | head -5
    exit 1
fi

# Перезапуск
echo "Перезапуск License Server..."
systemctl restart kiosk-license-server
sleep 3

if systemctl is-active --quiet kiosk-license-server; then
    echo -e "${GREEN}✓${NC} License Server запущен"
    
    # Health check
    sleep 1
    if curl -s http://localhost:3001/health | jq -e '.status == "ok"' &>/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Health check OK"
    else
        echo -e "${YELLOW}⚠${NC}  Health check не ответил"
    fi
else
    echo -e "${RED}❌ License Server не запустился${NC}"
    echo ""
    echo "Последние 30 строк логов:"
    journalctl -u kiosk-license-server -n 30 --no-pager
    exit 1
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Symlink создан и сервер запущен!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}Тест API:${NC}"
echo ""

# Admin API
echo "Admin API:"
TOKEN=$(curl -s -X POST http://localhost:3001/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@kiosk.local","password":"Admin123!"}' | jq -r '.token' 2>/dev/null)

if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
    echo -e "${GREEN}  ✓${NC} Admin login OK"
else
    echo -e "${YELLOW}  ⚠${NC}  Admin login не работает"
fi

# Client API
echo "Client API:"
RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/license \
  -H "Content-Type: application/json" \
  -d '{"licenseKey":"EWZA-E5LJ-Z558-9LUQ"}' 2>/dev/null)

if echo "$RESPONSE" | jq -e '.success' &>/dev/null 2>&1; then
    echo -e "${GREEN}  ✓${NC} Client API работает"
else
    echo -e "${YELLOW}  ⚠${NC}  Client API не отвечает"
    echo "    (возможно роуты не добавлены в app.ts)"
fi

echo ""
echo -e "${YELLOW}Логи сервера:${NC}"
echo "  journalctl -u kiosk-license-server -f"
echo ""
