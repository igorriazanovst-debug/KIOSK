#!/bin/bash
################################################################################
# Скрипт для расширения базы данных License Server
# Фаза 1: Backend API для Online Editor
# 
# Что делает:
# 1. Создаёт бэкап текущей базы данных
# 2. Заменяет schema.prisma на обновлённую версию
# 3. Создаёт и применяет миграции
# 4. Обновляет лимиты хранилища для существующих лицензий
# 5. Регенерирует Prisma Client
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
# Формат: postgresql://user:password@host:port/database
DB_URL_REGEX="postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+)"
if [[ $DATABASE_URL =~ $DB_URL_REGEX ]]; then
    DB_USER="${BASH_REMATCH[1]}"
    DB_PASS="${BASH_REMATCH[2]}"
    DB_HOST="${BASH_REMATCH[3]}"
    DB_PORT="${BASH_REMATCH[4]}"
    DB_NAME="${BASH_REMATCH[5]}"
else
    echo -e "${RED}❌ Не удалось распарсить DATABASE_URL${NC}"
    exit 1
fi

echo -e "${YELLOW}   Создание дампа базы: $DB_NAME${NC}"
PGPASSWORD="$DB_PASS" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE"
echo -e "${GREEN}✓${NC} Бэкап создан: $BACKUP_FILE"
echo ""

# Шаг 2: Резервная копия текущей schema.prisma
echo -e "${BLUE}[2/6] Создание резервной копии schema.prisma...${NC}"
cp prisma/schema.prisma "prisma/schema.prisma.backup.$(date +%Y%m%d_%H%M%S)"
echo -e "${GREEN}✓${NC} Резервная копия создана"
echo ""

# Шаг 3: Замена schema.prisma
echo -e "${BLUE}[3/6] Обновление schema.prisma...${NC}"
echo -e "${YELLOW}   ⚠️  Внимание: Скопируйте содержимое файла schema_full_updated.prisma${NC}"
echo -e "${YELLOW}      в prisma/schema.prisma вручную ПЕРЕД продолжением${NC}"
echo ""
read -p "Нажмите Enter когда schema.prisma будет обновлена, или Ctrl+C для отмены..."
echo ""

# Шаг 4: Создание и применение миграции
echo -e "${BLUE}[4/6] Создание миграции...${NC}"
npx prisma migrate dev --name add_online_editor_tables
echo -e "${GREEN}✓${NC} Миграция создана и применена"
echo ""

# Шаг 5: Обновление лимитов хранилища
echo -e "${BLUE}[5/6] Обновление лимитов хранилища для существующих лицензий...${NC}"
echo ""
echo -e "${YELLOW}   Выполнение SQL-запросов:${NC}"
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
\echo '\n✓ Лимиты хранилища обновлены:'
\echo ''
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
echo -e "${YELLOW}Следующий шаг:${NC}"
echo "  1. Пересобрать server: cd $SERVER_PATH && npm run build"
echo "  2. Перезапустить сервис: systemctl restart kiosk-license-server"
echo ""
echo -e "${BLUE}Бэкап базы данных:${NC} $BACKUP_FILE"
echo ""
