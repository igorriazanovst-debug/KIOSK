#!/bin/bash
################################################################################
# Глубокая диагностика проблемы с @kiosk/shared
################################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Диагностика @kiosk/shared                                        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

PROJECT_ROOT="/opt/kiosk/kiosk-content-platform"

echo -e "${BLUE}[1] Проверка структуры shared:${NC}"
echo ""
cd "$PROJECT_ROOT/packages/shared"
echo "package.json name:"
cat package.json | grep '"name"'
echo ""
echo "dist/ содержимое:"
ls -la dist/ 2>/dev/null || echo "dist/ не найдена!"
echo ""

echo -e "${BLUE}[2] Проверка node_modules в server:${NC}"
echo ""
cd "$PROJECT_ROOT/packages/server"
if [ -d "node_modules/@kiosk/shared" ]; then
    echo -e "${GREEN}✓${NC} node_modules/@kiosk/shared существует"
    ls -la node_modules/@kiosk/shared/
else
    echo -e "${RED}✗${NC} node_modules/@kiosk/shared НЕ НАЙДЕН"
fi
echo ""

echo -e "${BLUE}[3] Проверка symlink (monorepo):${NC}"
echo ""
if [ -L "node_modules/@kiosk/shared" ]; then
    echo -e "${GREEN}✓${NC} Это symlink"
    readlink -f node_modules/@kiosk/shared
else
    echo -e "${YELLOW}⚠${NC}  Это НЕ symlink"
fi
echo ""

echo -e "${BLUE}[4] Проверка LicenseController.js:${NC}"
echo ""
echo "Первые 10 строк:"
head -10 dist/controllers/LicenseController.js
echo ""

echo -e "${BLUE}[5] Попытка require('@kiosk/shared') из server:${NC}"
echo ""
cd "$PROJECT_ROOT/packages/server"
node -e "try { const shared = require('@kiosk/shared'); console.log('✓ @kiosk/shared загружен'); console.log('Exports:', Object.keys(shared)); } catch(e) { console.log('✗ Ошибка:', e.message); }"
echo ""

echo -e "${BLUE}[6] Проверка tsc-alias:${NC}"
echo ""
cd "$PROJECT_ROOT/packages/server"
cat tsconfig.json | grep -A5 "paths"
echo ""

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
