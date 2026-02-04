#!/bin/bash
################################################################################
# Исправление BigInt serialization в AdminController
# Функция getLicenses
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Исправление Admin API - BigInt в getLicenses                     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

SERVER_PATH="/opt/kiosk/kiosk-content-platform/packages/server"
cd "$SERVER_PATH"

ADMIN_CONTROLLER="src/controllers/AdminController.ts"

echo -e "${BLUE}[1/3] Backup AdminController.ts...${NC}"
cp "$ADMIN_CONTROLLER" "${ADMIN_CONTROLLER}.backup.$(date +%Y%m%d_%H%M%S)"
echo -e "${GREEN}✓${NC} Backup создан"
echo ""

echo -e "${BLUE}[2/3] Исправление функции getLicenses...${NC}"

python3 << 'PYTHON_SCRIPT'
file_path = "/opt/kiosk/kiosk-content-platform/packages/server/src/controllers/AdminController.ts"

with open(file_path, 'r') as f:
    content = f.read()

# Ищем return res.json в getLicenses и добавляем конвертацию BigInt
# Паттерн: ищем где возвращаются licenses

if 'return res.json({' in content and 'licenses: licenses' in content:
    # Находим функцию getLicenses
    lines = content.split('\n')
    new_lines = []
    in_get_licenses = False
    conversion_added = False
    
    for i, line in enumerate(lines):
        new_lines.append(line)
        
        # Определяем что мы внутри getLicenses
        if 'static async getLicenses' in line:
            in_get_licenses = True
        
        # Если внутри getLicenses и нашли getPrismaClient().license.count
        # добавляем конвертацию перед return
        if in_get_licenses and 'getPrismaClient().license.count({ where })' in line:
            # Следующие несколько строк до return res.json
            # Ищем ];
            if i + 1 < len(lines) and ']);' in lines[i + 1]:
                # Добавляем конвертацию после получения licenses
                new_lines.append('')
                new_lines.append('      // Конвертируем BigInt в Number для JSON')
                new_lines.append('      const licensesWithNumbers = licenses.map(license => ({')
                new_lines.append('        ...license,')
                new_lines.append('        storageLimit: Number(license.storageLimit)')
                new_lines.append('      }));')
                conversion_added = True
        
        # Заменяем licenses: licenses на licenses: licensesWithNumbers
        if in_get_licenses and conversion_added and 'licenses: licenses' in line:
            new_lines[-1] = line.replace('licenses: licenses', 'licenses: licensesWithNumbers')
        
        # Выходим из функции
        if in_get_licenses and line.strip().startswith('static async ') and 'getLicenses' not in line:
            in_get_licenses = False
    
    if conversion_added:
        content = '\n'.join(new_lines)
        print("✓ Добавлена конвертация BigInt → Number")
    else:
        print("⚠ Паттерн не найден, пробуем альтернативный метод...")
        # Простая замена
        if 'licenses: licenses,' in content:
            # Добавляем конвертацию перед return res.json
            content = content.replace(
                'getPrismaClient().license.count({ where })\n      ]);',
                'getPrismaClient().license.count({ where })\n      ]);\n\n      // Конвертируем BigInt в Number для JSON\n      const licensesWithNumbers = licenses.map(license => ({\n        ...license,\n        storageLimit: Number(license.storageLimit)\n      }));'
            )
            content = content.replace(
                'licenses: licenses,',
                'licenses: licensesWithNumbers,'
            )
            print("✓ Применён альтернативный метод")
else:
    print("⚠ Структура файла не совпадает с ожидаемой")

with open(file_path, 'w') as f:
    f.write(content)

print("✓ AdminController.ts обновлён")
PYTHON_SCRIPT

echo ""

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
systemctl restart kiosk-license-server
sleep 2

if systemctl is-active --quiet kiosk-license-server; then
    echo -e "${GREEN}✓${NC} License Server перезапущен"
else
    echo -e "${RED}✗${NC} License Server не запустился"
    exit 1
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Исправление применено!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}Тест Admin API:${NC}"
echo ""

# Авторизация
TOKEN=$(curl -s -X POST http://localhost:3001/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@kiosk.local","password":"Admin123!"}' | jq -r '.token')

if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
    echo -e "${GREEN}✓${NC} Admin login OK"
    
    # Получение лицензий
    LICENSES=$(curl -s http://localhost:3001/api/admin/licenses \
      -H "Authorization: Bearer $TOKEN")
    
    if echo "$LICENSES" | jq -e '.success' &>/dev/null; then
        echo -e "${GREEN}✓${NC} GET /api/admin/licenses OK"
        echo ""
        echo "Первая лицензия:"
        echo "$LICENSES" | jq '.licenses[0] | {licenseKey, plan, storageLimit}'
    else
        echo -e "${RED}✗${NC} Ошибка получения лицензий"
        echo "$LICENSES" | jq .
    fi
else
    echo -e "${RED}✗${NC} Ошибка авторизации"
fi

echo ""
