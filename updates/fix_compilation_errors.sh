#!/bin/bash
################################################################################
# Скрипт исправления ошибок компиляции
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Исправление ошибок компиляции                                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

SERVER_PATH="/opt/kiosk/kiosk-content-platform/packages/server"
cd "$SERVER_PATH"

# Проблема 1: Удаление дубликатов импортов в app.ts
echo -e "${BLUE}[1/2] Исправление дубликатов в app.ts...${NC}"

APP_FILE="src/app.ts"

# Создаём backup
cp "$APP_FILE" "${APP_FILE}.backup.fix"

# Удаляем дубликаты (оставляем только первое вхождение)
python3 << 'PYTHON_SCRIPT'
import re

app_file = "/opt/kiosk/kiosk-content-platform/packages/server/src/app.ts"

with open(app_file, 'r') as f:
    content = f.read()

lines = content.split('\n')
seen_imports = set()
new_lines = []

for line in lines:
    # Проверяем импорты authRoutes и projectRoutes
    if 'import authRoutes from' in line or 'import projectRoutes from' in line:
        if line not in seen_imports:
            seen_imports.add(line)
            new_lines.append(line)
        else:
            # Это дубликат, пропускаем
            print(f"Удаляем дубликат: {line.strip()}")
    else:
        new_lines.append(line)

# Сохраняем
with open(app_file, 'w') as f:
    f.write('\n'.join(new_lines))

print("✓ Дубликаты удалены")
PYTHON_SCRIPT

echo -e "${GREEN}✓${NC} Дубликаты импортов удалены"
echo ""

# Проблема 2: Создание недостающей функции createAuditLog
echo -e "${BLUE}[2/2] Добавление функции createAuditLog в AuditService...${NC}"

AUDIT_SERVICE="src/services/AuditService.ts"

# Проверяем есть ли уже функция
if grep -q "export.*createAuditLog" "$AUDIT_SERVICE"; then
    echo -e "${GREEN}✓${NC} createAuditLog уже существует"
else
    # Добавляем функцию в конец файла
    cat >> "$AUDIT_SERVICE" << 'EOF'

/**
 * Создать запись в audit log
 * Упрощённая версия для Client API
 */
export async function createAuditLog(params: {
  action: string;
  userId?: string;
  deviceId?: string;
  licenseId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
}) {
  const prisma = getPrismaClient();
  
  return prisma.auditLog.create({
    data: {
      action: params.action,
      userId: params.userId || null,
      deviceId: params.deviceId || null,
      licenseId: params.licenseId || null,
      details: params.details || null,
      ipAddress: params.ipAddress || null,
      userAgent: params.userAgent || null
    }
  });
}
EOF
    echo -e "${GREEN}✓${NC} Функция createAuditLog добавлена"
fi

echo ""

# Проверка компиляции
echo -e "${BLUE}[3/3] Проверка компиляции...${NC}"
echo ""

if npm run build; then
    echo ""
    echo -e "${GREEN}✓${NC} Компиляция успешна!"
else
    echo ""
    echo -e "${RED}❌ Всё ещё есть ошибки${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Исправления применены!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}Следующий шаг:${NC}"
echo "  systemctl restart kiosk-license-server"
echo ""
