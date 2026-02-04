#!/bin/bash
################################################################################
# Финальная проверка результатов миграции
################################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Проверка результатов миграции БД                                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

cd /opt/kiosk/kiosk-content-platform/packages/server

# Экспортируем переменные
export $(cat .env | grep -v '^#' | xargs)
DB_URL_CLEAN=$(echo "$DATABASE_URL" | sed 's/?.*//')
DB_URL_REGEX="postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+)"
if [[ $DB_URL_CLEAN =~ $DB_URL_REGEX ]]; then
    DB_USER="${BASH_REMATCH[1]}"
    DB_PASS="${BASH_REMATCH[2]}"
    DB_HOST="${BASH_REMATCH[3]}"
    DB_PORT="${BASH_REMATCH[4]}"
    DB_NAME="${BASH_REMATCH[5]}"
fi

echo -e "${BLUE}[1] Новые таблицы в БД:${NC}"
echo ""
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << 'EOF'
SELECT 
    tablename,
    CASE 
        WHEN tablename IN ('user_profiles', 'projects', 'project_files') THEN '✓ НОВАЯ'
        ELSE ''
    END as status
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
EOF

echo ""
echo -e "${BLUE}[2] Структура таблицы licenses (проверка storageLimit):${NC}"
echo ""
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << 'EOF'
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'licenses'
ORDER BY ordinal_position;
EOF

echo ""
echo -e "${BLUE}[3] Лимиты хранилища для лицензий:${NC}"
echo ""
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << 'EOF'
SELECT 
  "licenseKey",
  plan,
  ROUND("storageLimit" / 1048576.0, 2) as storage_mb
FROM licenses
ORDER BY plan;
EOF

echo ""
echo -e "${BLUE}[4] Структура таблицы projects:${NC}"
echo ""
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << 'EOF'
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'projects'
ORDER BY ordinal_position;
EOF

echo ""
echo -e "${BLUE}[5] Структура таблицы project_files:${NC}"
echo ""
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << 'EOF'
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'project_files'
ORDER BY ordinal_position;
EOF

echo ""
echo -e "${BLUE}[6] Тест API - Получение списка лицензий (проверка storageLimit в API):${NC}"
echo ""

# Авторизация
echo -e "${YELLOW}Авторизация...${NC}"
TOKEN=$(curl -s -X POST http://localhost:3001/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@kiosk.local","password":"Admin123!"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ Не удалось получить токен${NC}"
else
    echo -e "${GREEN}✓${NC} Токен получен"
    echo ""
    echo -e "${YELLOW}Запрос списка лицензий...${NC}"
    curl -s http://localhost:3001/api/admin/licenses \
      -H "Authorization: Bearer $TOKEN" | jq '.licenses[] | {licenseKey, plan, storageLimit}'
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Проверка завершена!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
