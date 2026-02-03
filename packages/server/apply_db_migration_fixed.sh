#!/bin/bash
################################################################################
# Скрипт для расширения базы данных License Server
# Фаза 1: Backend API для Online Editor
# FIXED: Правильный парсинг DATABASE_URL с параметрами
################################################################################

set -e  # Остановка при ошибке

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Путь к проекту
PROJECT_ROOT="/opt/kiosk/kiosk-content-platform"
SERVER_PATH="$PROJECT_ROOT/packages/server"
BACKUP_DIR="$SERVER_PATH/backups"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Расширение базы данных для Online Editor v1.0                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Проверка что мы на сервере
if [ ! -d "$SERVER_PATH" ]; then
    echo -e "${RED}❌ Ошибка: Директория $SERVER_PATH не найдена${NC}"
    echo -e "${YELLOW}   Проверьте что вы на правильном сервере${NC}"
    exit 1
fi

cd "$SERVER_PATH"
echo -e "${GREEN}✓${NC} Рабочая директория: $SERVER_PATH"
echo ""

# Шаг 1: Создание бэкапа базы данных
echo -e "${BLUE}[1/6] Создание бэкапа базы данных...${NC}"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/db_backup_$(date +%Y%m%d_%H%M%S).sql"

# Получаем DATABASE_URL из .env
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ Файл .env не найден${NC}"
    exit 1
fi

# Экспортируем переменные из .env
export $(cat .env | grep -v '^#' | xargs)

# Парсим DATABASE_URL для получения параметров подключения
# Формат: postgresql://user:password@host:port/database?params
# Убираем параметры после ?
DB_URL_CLEAN=$(echo "$DATABASE_URL" | sed 's/?.*//')

DB_URL_REGEX="postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+)"
if [[ $DB_URL_CLEAN =~ $DB_URL_REGEX ]]; then
    DB_USER="${BASH_REMATCH[1]}"
    DB_PASS="${BASH_REMATCH[2]}"
    DB_HOST="${BASH_REMATCH[3]}"
    DB_PORT="${BASH_REMATCH[4]}"
    DB_NAME="${BASH_REMATCH[5]}"
else
    echo -e "${RED}❌ Не удалось распарсить DATABASE_URL${NC}"
    echo -e "${YELLOW}   DATABASE_URL: $DATABASE_URL${NC}"
    exit 1
fi

echo -e "${YELLOW}   База данных: ${DB_NAME}${NC}"
echo -e "${YELLOW}   Хост: ${DB_HOST}:${DB_PORT}${NC}"
echo -e "${YELLOW}   Пользователь: ${DB_USER}${NC}"
echo ""

# Создаём дамп
PGPASSWORD="$DB_PASS" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE"
echo -e "${GREEN}✓${NC} Бэкап создан: $BACKUP_FILE"
echo ""

# Шаг 2: Резервная копия текущей schema.prisma
echo -e "${BLUE}[2/6] Создание резервной копии schema.prisma...${NC}"
SCHEMA_BACKUP="prisma/schema.prisma.backup.$(date +%Y%m%d_%H%M%S)"
cp prisma/schema.prisma "$SCHEMA_BACKUP"
echo -e "${GREEN}✓${NC} Резервная копия: $SCHEMA_BACKUP"
echo ""

# Шаг 3: Проверка что новая schema на месте
echo -e "${BLUE}[3/6] Проверка schema.prisma...${NC}"

# Проверяем что в schema есть новые модели
if grep -q "model UserProfile" prisma/schema.prisma && \
   grep -q "model Project" prisma/schema.prisma && \
   grep -q "model ProjectFile" prisma/schema.prisma; then
    echo -e "${GREEN}✓${NC} Schema содержит новые модели (UserProfile, Project, ProjectFile)"
else
    echo -e "${RED}❌ Ошибка: Schema не содержит новые модели${NC}"
    echo -e "${YELLOW}   Убедитесь что вы скопировали schema_full_updated.prisma в prisma/schema.prisma${NC}"
    echo ""
    read -p "Нажмите Enter для продолжения после обновления schema, или Ctrl+C для отмены..."
fi
echo ""

# Шаг 4: Создание и применение миграции
echo -e "${BLUE}[4/6] Создание миграции...${NC}"
echo -e "${YELLOW}   Это может занять некоторое время...${NC}"
echo ""

npx prisma migrate dev --name add_online_editor_tables

echo ""
echo -e "${GREEN}✓${NC} Миграция создана и применена"
echo ""

# Шаг 5: Обновление лимитов хранилища
echo -e "${BLUE}[5/6] Обновление лимитов хранилища для существующих лицензий...${NC}"
echo ""

# Подключаемся к БД и выполняем UPDATE
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << EOF
-- Update storage limits based on plan
UPDATE licenses
SET "storageLimit" = CASE
  WHEN plan = 'BASIC' THEN 524288000    -- 500 MB
  WHEN plan = 'PRO'   THEN 1572864000   -- 1500 MB  
  WHEN plan = 'MAX'   THEN 3145728000   -- 3000 MB
  ELSE 524288000                         -- Default to BASIC
END;

-- Show results
SELECT 
  plan,
  COUNT(*) as count,
  "storageLimit",
  ROUND("storageLimit" / 1048576.0, 2) as storage_mb
FROM licenses
GROUP BY plan, "storageLimit"
ORDER BY plan;
EOF

echo ""
echo -e "${GREEN}✓${NC} Лимиты хранилища обновлены"
echo ""

# Шаг 6: Регенерация Prisma Client
echo -e "${BLUE}[6/6] Регенерация Prisma Client...${NC}"
npx prisma generate
echo -e "${GREEN}✓${NC} Prisma Client обновлён"
echo ""

# Проверка результатов
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ База данных успешно расширена!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}Добавлены таблицы:${NC}"
echo "  • user_profiles    - Профили пользователей"
echo "  • projects         - Проекты киоск-контента"
echo "  • project_files    - Медиа-файлы проектов"
echo ""
echo -e "${GREEN}Обновлены модели:${NC}"
echo "  • User         → добавлена связь с UserProfile и Project"
echo "  • License      → добавлены storageLimit и связь с Project"
echo "  • Organization → добавлена связь с Project"
echo ""
echo -e "${GREEN}Лимиты хранилища:${NC}"
echo "  • BASIC: 500 MB"
echo "  • PRO:   1500 MB"
echo "  • MAX:   3000 MB"
echo ""
echo -e "${YELLOW}Следующие шаги:${NC}"
echo "  1. Пересобрать server:"
echo "     cd $SERVER_PATH && npm run build"
echo ""
echo "  2. Перезапустить сервис:"
echo "     systemctl restart kiosk-license-server"
echo ""
echo "  3. Проверить работоспособность:"
echo "     systemctl status kiosk-license-server"
echo "     curl http://localhost:3001/health"
echo ""
echo -e "${BLUE}Бэкап базы данных:${NC} $BACKUP_FILE"
echo -e "${BLUE}Бэкап schema.prisma:${NC} $SCHEMA_BACKUP"
echo ""
