#!/bin/bash
################################################################################
# Правильное исправление BigInt в AdminController.getLicenses
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Исправление AdminController.getLicenses (правильное)             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

SERVER_PATH="/opt/kiosk/kiosk-content-platform/packages/server"
cd "$SERVER_PATH"

ADMIN_CONTROLLER="src/controllers/AdminController.ts"

echo -e "${BLUE}[1/3] Backup...${NC}"
cp "$ADMIN_CONTROLLER" "${ADMIN_CONTROLLER}.backup.final"
echo -e "${GREEN}✓${NC} Backup создан"
echo ""

echo -e "${BLUE}[2/3] Замена функции getLicenses...${NC}"

python3 << 'PYTHON_SCRIPT'
file_path = "/opt/kiosk/kiosk-content-platform/packages/server/src/controllers/AdminController.ts"

with open(file_path, 'r') as f:
    content = f.read()

# Ищем и заменяем всю функцию getLicenses
# Находим начало функции
import re

# Паттерн: от "static async getLicenses" до следующей функции
pattern = r'(static async getLicenses\(req: Request, res: Response\) \{.*?)(res\.json\(\{[^}]*data: licenses,)'

def replacement(match):
    before_json = match.group(1)
    # Добавляем конвертацию BigInt перед res.json
    new_code = before_json + '''
    // Конвертируем BigInt в Number для JSON
    const licensesWithNumbers = licenses.map(license => ({
      ...license,
      storageLimit: license.storageLimit ? Number(license.storageLimit) : 524288000
    }));

    res.json({
      success: true,
      data: licensesWithNumbers,'''
    return new_code

# Применяем замену
new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)

if new_content != content:
    print("✓ Функция getLicenses обновлена")
    content = new_content
else:
    print("⚠ Паттерн не найден, пробуем другой способ...")
    
    # Альтернативный подход - простая замена строки
    if 'data: licenses,' in content:
        # Найдём место перед res.json и вставим конвертацию
        lines = content.split('\n')
        new_lines = []
        
        for i, line in enumerate(lines):
            new_lines.append(line)
            
            # Если нашли строку с prisma.license.count({ where })
            # и следующая строка это ]);
            if 'prisma.license.count({ where })' in line:
                # Проверяем следующие строки
                if i + 1 < len(lines) and ']);' in lines[i + 1]:
                    # После ]); добавляем конвертацию
                    new_lines.append('')
                    new_lines.append('    // Конвертируем BigInt в Number для JSON')
                    new_lines.append('    const licensesWithNumbers = licenses.map(license => ({')
                    new_lines.append('      ...license,')
                    new_lines.append('      storageLimit: license.storageLimit ? Number(license.storageLimit) : 524288000')
                    new_lines.append('    }));')
                    print("✓ Добавлена конвертация BigInt")
            
            # Заменяем data: licenses на data: licensesWithNumbers
            if 'data: licenses,' in line:
                new_lines[-1] = line.replace('data: licenses,', 'data: licensesWithNumbers,')
                print("✓ Заменён data: licenses на data: licensesWithNumbers")
        
        content = '\n'.join(new_lines)

with open(file_path, 'w') as f:
    f.write(content)

print("✓ Файл сохранён")
PYTHON_SCRIPT

echo ""

echo -e "${BLUE}[3/3] Компиляция и перезапуск...${NC}"

if npm run build 2>&1 | tail -5; then
    echo ""
    echo -e "${GREEN}✓${NC} Компиляция успешна"
else
    echo ""
    echo -e "${RED}✗${NC} Ошибка компиляции"
    exit 1
fi

echo ""
systemctl restart kiosk-license-server
sleep 3

if systemctl is-active --quiet kiosk-license-server; then
    echo -e "${GREEN}✓${NC} License Server перезапущен"
else
    echo -e "${RED}✗${NC} Не запустился"
    journalctl -u kiosk-license-server -n 20 --no-pager
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
        echo "Лицензии с storageLimit:"
        echo "$LICENSES" | jq '.data[] | {licenseKey, plan, storageLimit}'
    else
        echo -e "${RED}✗${NC} Ошибка:"
        echo "$LICENSES" | jq .
        echo ""
        echo "Проверяем логи:"
        journalctl -u kiosk-license-server -n 10 --no-pager | tail -5
    fi
else
    echo -e "${RED}✗${NC} Ошибка авторизации"
fi

echo ""
