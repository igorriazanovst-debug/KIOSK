#!/bin/bash
################################################################################
# Скрипт для проверки текущего состояния и исправления
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Проверка состояния базы данных                                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

cd /opt/kiosk/kiosk-content-platform/packages/server

# Экспортируем переменные из .env
export $(cat .env | grep -v '^#' | xargs)

# Парсим DATABASE_URL
DB_URL_CLEAN=$(echo "$DATABASE_URL" | sed 's/?.*//')
DB_URL_REGEX="postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+)"
if [[ $DB_URL_CLEAN =~ $DB_URL_REGEX ]]; then
    DB_USER="${BASH_REMATCH[1]}"
    DB_PASS="${BASH_REMATCH[2]}"
    DB_HOST="${BASH_REMATCH[3]}"
    DB_PORT="${BASH_REMATCH[4]}"
    DB_NAME="${BASH_REMATCH[5]}"
fi

echo -e "${BLUE}[1] Проверка schema.prisma...${NC}"
echo ""

if grep -q "model UserProfile" prisma/schema.prisma; then
    echo -e "${GREEN}✓${NC} UserProfile найден в schema"
else
    echo -e "${RED}✗${NC} UserProfile НЕ найден в schema"
fi

if grep -q "model Project {" prisma/schema.prisma; then
    echo -e "${GREEN}✓${NC} Project найден в schema"
else
    echo -e "${RED}✗${NC} Project НЕ найден в schema"
fi

if grep -q "model ProjectFile" prisma/schema.prisma; then
    echo -e "${GREEN}✓${NC} ProjectFile найден в schema"
else
    echo -e "${RED}✗${NC} ProjectFile НЕ найден в schema"
fi

if grep -q "storageLimit" prisma/schema.prisma; then
    echo -e "${GREEN}✓${NC} storageLimit найден в schema (в модели License)"
else
    echo -e "${RED}✗${NC} storageLimit НЕ найден в schema"
fi

echo ""
echo -e "${BLUE}[2] Проверка таблиц в базе данных...${NC}"
echo ""

PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << 'EOF'
-- Проверяем существующие таблицы
SELECT 
    tablename,
    CASE 
        WHEN tablename IN ('user_profiles', 'projects', 'project_files') THEN '✓ НОВАЯ'
        ELSE ''
    END as status
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Проверяем структуру таблицы licenses
\echo ''
\echo 'Колонки таблицы licenses:'
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'licenses'
ORDER BY ordinal_position;
EOF

echo ""
echo -e "${BLUE}[3] Статус миграций Prisma...${NC}"
echo ""
npx prisma migrate status

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}Диагностика завершена${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
