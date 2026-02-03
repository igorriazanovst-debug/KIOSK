#!/bin/bash
################################################################################
# Полная автоматическая миграция БД для Online Editor
# Скачивает schema, применяет миграцию, обновляет лимиты
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Автоматическая миграция БД для Online Editor v1.0               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

SERVER_PATH="/opt/kiosk/kiosk-content-platform/packages/server"
cd "$SERVER_PATH"

# Проверка что файл schema_full_updated.prisma существует
if [ ! -f "schema_full_updated.prisma" ]; then
    echo -e "${RED}❌ Файл schema_full_updated.prisma не найден${NC}"
    echo -e "${YELLOW}   Скопируйте его в директорию: $SERVER_PATH${NC}"
    exit 1
fi

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

# Шаг 1: Бэкап БД
echo -e "${BLUE}[1/5] Создание бэкапа...${NC}"
mkdir -p backups
BACKUP_FILE="backups/db_backup_$(date +%Y%m%d_%H%M%S).sql"
PGPASSWORD="$DB_PASS" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE"
echo -e "${GREEN}✓${NC} Бэкап: $BACKUP_FILE"
echo ""

# Шаг 2: Бэкап старой schema
echo -e "${BLUE}[2/5] Бэкап schema.prisma...${NC}"
cp prisma/schema.prisma "prisma/schema.prisma.backup.$(date +%Y%m%d_%H%M%S)"
echo -e "${GREEN}✓${NC} Резервная копия создана"
echo ""

# Шаг 3: Замена schema
echo -e "${BLUE}[3/5] Замена schema.prisma...${NC}"
cp schema_full_updated.prisma prisma/schema.prisma
echo -e "${GREEN}✓${NC} Schema обновлена"
echo ""

# Шаг 4: Применение миграции
echo -e "${BLUE}[4/5] Применение миграции...${NC}"
echo -e "${YELLOW}   Это займёт 30-60 секунд...${NC}"
echo ""
npx prisma migrate dev --name add_online_editor_tables
echo ""
echo -e "${GREEN}✓${NC} Миграция применена"
echo ""

# Шаг 5: Обновление лимитов хранилища
echo -e "${BLUE}[5/5] Обновление лимитов хранилища...${NC}"
echo ""
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << 'EOF'
UPDATE licenses
SET "storageLimit" = CASE
  WHEN plan = 'BASIC' THEN 524288000
  WHEN plan = 'PRO'   THEN 1572864000
  WHEN plan = 'MAX'   THEN 3145728000
  ELSE 524288000
END;

SELECT 
  plan,
  COUNT(*) as count,
  ROUND("storageLimit" / 1048576.0, 2) as storage_mb
FROM licenses
GROUP BY plan, "storageLimit"
ORDER BY plan;
EOF
echo ""
echo -e "${GREEN}✓${NC} Лимиты обновлены"
echo ""

# Финальная проверка
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Миграция завершена успешно!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}Проверка результатов:${NC}"
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << 'EOF'
SELECT 
    tablename,
    CASE 
        WHEN tablename IN ('user_profiles', 'projects', 'project_files') THEN '✓ НОВАЯ'
        ELSE ''
    END as status
FROM pg_tables 
WHERE schemaname = 'public' AND tablename IN ('user_profiles', 'projects', 'project_files', 'licenses')
ORDER BY tablename;
EOF

echo ""
echo -e "${YELLOW}Следующие шаги:${NC}"
echo "  1. npm run build"
echo "  2. systemctl restart kiosk-license-server"
echo "  3. systemctl status kiosk-license-server"
echo ""
