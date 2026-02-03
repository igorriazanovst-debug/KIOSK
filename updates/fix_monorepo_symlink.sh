#!/bin/bash
################################################################################
# Исправление монорепо symlink для @kiosk/shared
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Исправление монорепо symlink                                     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

PROJECT_ROOT="/opt/kiosk/kiosk-content-platform"

echo -e "${BLUE}[1/4] Переустановка зависимостей в корне...${NC}"
cd "$PROJECT_ROOT"

# Очистка node_modules в server
echo "Удаление node_modules в server..."
rm -rf packages/server/node_modules/@kiosk 2>/dev/null || true

# Переустановка зависимостей из корня (это создаст symlink)
echo "Установка зависимостей..."
npm install

echo -e "${GREEN}✓${NC} Зависимости установлены"
echo ""

echo -e "${BLUE}[2/4] Проверка symlink...${NC}"
if [ -L "packages/server/node_modules/@kiosk/shared" ]; then
    echo -e "${GREEN}✓${NC} Symlink создан"
    readlink -f packages/server/node_modules/@kiosk/shared
else
    echo -e "${YELLOW}⚠${NC}  Symlink не создан автоматически"
    echo "Создаём вручную..."
    
    mkdir -p packages/server/node_modules/@kiosk
    ln -sf "$PROJECT_ROOT/packages/shared" "$PROJECT_ROOT/packages/server/node_modules/@kiosk/shared"
    
    if [ -L "packages/server/node_modules/@kiosk/shared" ]; then
        echo -e "${GREEN}✓${NC} Symlink создан вручную"
    else
        echo -e "${RED}✗${NC} Не удалось создать symlink"
        exit 1
    fi
fi
echo ""

echo -e "${BLUE}[3/4] Пересборка packages...${NC}"

# Собираем shared
echo "Сборка @kiosk/shared..."
cd "$PROJECT_ROOT/packages/shared"
npm run build
echo -e "${GREEN}✓${NC} @kiosk/shared собран"
echo ""

# Собираем server
echo "Сборка @kiosk/server..."
cd "$PROJECT_ROOT/packages/server"
npm run build
echo -e "${GREEN}✓${NC} @kiosk/server собран"
echo ""

echo -e "${BLUE}[4/4] Проверка и перезапуск...${NC}"

# Тест require
echo "Тест require('@kiosk/shared'):"
cd "$PROJECT_ROOT/packages/server"
if node -e "require('@kiosk/shared'); console.log('✓ OK')" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} @kiosk/shared загружается"
else
    echo -e "${RED}✗${NC} Всё ещё не работает"
    exit 1
fi
echo ""

# Перезапуск
echo "Перезапуск License Server..."
systemctl restart kiosk-license-server
sleep 3

if systemctl is-active --quiet kiosk-license-server; then
    echo -e "${GREEN}✓${NC} License Server запущен"
    
    # Health check
    if curl -s http://localhost:3001/health | jq -e '.status == "ok"' &>/dev/null; then
        echo -e "${GREEN}✓${NC} Health check OK"
    else
        echo -e "${RED}✗${NC} Health check failed"
    fi
else
    echo -e "${RED}❌ License Server не запустился${NC}"
    echo ""
    echo "Последние логи:"
    journalctl -u kiosk-license-server -n 20 --no-pager
    exit 1
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Исправление завершено успешно!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}Проверка API:${NC}"
echo ""

# Тест Client API
echo "Тест авторизации клиента:"
RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/license \
  -H "Content-Type: application/json" \
  -d '{"licenseKey":"EWZA-E5LJ-Z558-9LUQ"}' 2>/dev/null)

if echo "$RESPONSE" | jq -e '.success' &>/dev/null; then
    echo -e "${GREEN}✓${NC} Client API работает"
    TOKEN=$(echo "$RESPONSE" | jq -r '.token')
    echo "  Token: ${TOKEN:0:30}..."
else
    echo -e "${YELLOW}⚠${NC}  Client API не отвечает (возможно роуты не добавлены)"
fi

echo ""
