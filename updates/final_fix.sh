#!/bin/bash
################################################################################
# Финальное исправление: BigInt serialization + Client API routes
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Финальное исправление API                                        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

SERVER_PATH="/opt/kiosk/kiosk-content-platform/packages/server"
cd "$SERVER_PATH"

# Проблема 1: BigInt в AuthController
echo -e "${BLUE}[1/3] Исправление BigInt в AuthController...${NC}"

python3 << 'PYTHON_EOF'
import re

file_path = "/opt/kiosk/kiosk-content-platform/packages/server/src/controllers/AuthController.ts"

with open(file_path, 'r') as f:
    content = f.read()

# Ищем return res.json в функции loginWithLicense
# Заменяем license: { на license: { с конвертацией storageLimit

old_pattern = r'(return res\.json\(\{[^}]*license: \{[^}]*)(storageLimit: license\.storageLimit)'
new_replacement = r'\1storageLimit: Number(license.storageLimit)'

if re.search(old_pattern, content):
    content = re.sub(old_pattern, new_replacement, content)
    print("✓ Заменён storageLimit в AuthController")
else:
    print("⚠ Паттерн не найден, пробуем другой способ...")
    # Альтернативный подход - заменяем весь блок license
    if 'storageLimit: license.storageLimit' in content:
        content = content.replace(
            'storageLimit: license.storageLimit',
            'storageLimit: Number(license.storageLimit)'
        )
        print("✓ Заменён storageLimit (альтернативный метод)")

with open(file_path, 'w') as f:
    f.write(content)

print("✓ AuthController.ts обновлён")
PYTHON_EOF

echo ""

# Проблема 2: Client API routes не добавлены
echo -e "${BLUE}[2/3] Проверка и добавление Client API routes в app.ts...${NC}"

APP_FILE="src/app.ts"

# Проверяем добавлены ли роуты
if grep -q "authRoutes" "$APP_FILE"; then
    echo -e "${GREEN}✓${NC} Client API routes уже добавлены"
else
    echo -e "${YELLOW}⚠${NC}  Client API routes отсутствуют, добавляем..."
    
    python3 << 'PYTHON_EOF2'
file_path = "/opt/kiosk/kiosk-content-platform/packages/server/src/app.ts"

with open(file_path, 'r') as f:
    lines = f.readlines()

new_lines = []
imports_added = False
routes_added = False

for i, line in enumerate(lines):
    new_lines.append(line)
    
    # Добавляем импорты после import adminRoutes
    if 'import adminRoutes from' in line and not imports_added:
        new_lines.append('\n')
        new_lines.append('// Client API routes\n')
        new_lines.append("import authRoutes from './routes/auth.routes';\n")
        new_lines.append("import projectRoutes from './routes/project.routes';\n")
        imports_added = True
        print("✓ Импорты добавлены")
    
    # Добавляем роуты после app.use('/api/admin'
    if "app.use('/api/admin'" in line and not routes_added:
        new_lines.append('\n')
        new_lines.append('// Client API endpoints\n')
        new_lines.append("app.use('/api/auth', authRoutes);\n")
        new_lines.append("app.use('/api/projects', projectRoutes);\n")
        routes_added = True
        print("✓ Роуты добавлены")

with open(file_path, 'w') as f:
    f.writelines(new_lines)

if imports_added and routes_added:
    print("✓ app.ts обновлён")
else:
    print("⚠ Не все изменения применены")
    print(f"  Импорты: {imports_added}, Роуты: {routes_added}")
PYTHON_EOF2
fi

echo ""

# Компиляция и перезапуск
echo -e "${BLUE}[3/3] Компиляция и перезапуск...${NC}"

if npm run build; then
    echo ""
    echo -e "${GREEN}✓${NC} Компиляция успешна"
else
    echo ""
    echo -e "${RED}✗${NC} Ошибка компиляции"
    exit 1
fi

echo ""
echo "Перезапуск License Server..."
systemctl restart kiosk-license-server
sleep 3

if systemctl is-active --quiet kiosk-license-server; then
    echo -e "${GREEN}✓${NC} License Server перезапущен"
else
    echo -e "${RED}✗${NC} License Server не запустился"
    journalctl -u kiosk-license-server -n 20 --no-pager
    exit 1
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Исправления применены!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Полное тестирование API
echo -e "${YELLOW}Тестирование API:${NC}"
echo ""

# Admin API
echo "1. Admin API:"
ADMIN_TOKEN=$(curl -s -X POST http://localhost:3001/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@kiosk.local","password":"Admin123!"}' | jq -r '.token' 2>/dev/null)

if [ "$ADMIN_TOKEN" != "null" ] && [ -n "$ADMIN_TOKEN" ]; then
    echo -e "   ${GREEN}✓${NC} Admin login OK"
    
    # Получение лицензий
    LICENSES=$(curl -s http://localhost:3001/api/admin/licenses \
      -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null)
    
    if echo "$LICENSES" | jq -e '.success' &>/dev/null; then
        echo -e "   ${GREEN}✓${NC} Получение лицензий OK"
    else
        echo -e "   ${RED}✗${NC} Ошибка получения лицензий"
    fi
else
    echo -e "   ${RED}✗${NC} Admin login failed"
fi

echo ""
echo "2. Client API:"

# Client API - авторизация
CLIENT_RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/license \
  -H "Content-Type: application/json" \
  -d '{"licenseKey":"EWZA-E5LJ-Z558-9LUQ"}' 2>/dev/null)

if echo "$CLIENT_RESPONSE" | jq -e '.success' &>/dev/null 2>&1; then
    echo -e "   ${GREEN}✓${NC} Client login OK"
    
    CLIENT_TOKEN=$(echo "$CLIENT_RESPONSE" | jq -r '.token')
    
    # Создание проекта
    PROJECT=$(curl -s -X POST http://localhost:3001/api/projects \
      -H "Authorization: Bearer $CLIENT_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"name":"Test Project","projectData":{}}' 2>/dev/null)
    
    if echo "$PROJECT" | jq -e '.success' &>/dev/null; then
        echo -e "   ${GREEN}✓${NC} Создание проекта OK"
        PROJECT_ID=$(echo "$PROJECT" | jq -r '.project.id')
        echo -e "   ${BLUE}→${NC} Project ID: $PROJECT_ID"
    else
        echo -e "   ${YELLOW}⚠${NC}  Создание проекта не удалось"
    fi
else
    echo -e "   ${RED}✗${NC} Client API не работает"
    echo "$CLIENT_RESPONSE" | jq . 2>/dev/null || echo "$CLIENT_RESPONSE"
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Доступные эндпоинты:${NC}"
echo ""
echo "  Admin API:"
echo "    POST /api/admin/login"
echo "    GET  /api/admin/licenses"
echo ""
echo "  Client API:"
echo "    POST /api/auth/license       (вход по ключу)"
echo "    GET  /api/projects            (список проектов)"
echo "    POST /api/projects            (создать проект)"
echo "    POST /api/projects/:id/files  (загрузить файл)"
echo ""
