#!/bin/bash
################################################################################
# Исправление проблемы BigInt serialization в AdminController
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Исправление BigInt serialization                                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

SERVER_PATH="/opt/kiosk/kiosk-content-platform/packages/server"
cd "$SERVER_PATH"

ADMIN_CONTROLLER="src/controllers/AdminController.ts"

echo -e "${BLUE}[1/2] Создание backup AdminController.ts...${NC}"
cp "$ADMIN_CONTROLLER" "${ADMIN_CONTROLLER}.backup.bigint"
echo -e "${GREEN}✓${NC} Backup создан"
echo ""

echo -e "${BLUE}[2/2] Исправление AdminController.ts...${NC}"

# Используем Python для точечного исправления
python3 << 'PYTHON_SCRIPT'
import re

file_path = "/opt/kiosk/kiosk-content-platform/packages/server/src/controllers/AdminController.ts"

with open(file_path, 'r') as f:
    content = f.read()

# Находим функцию getLicenses и исправляем её
# Ищем секцию где возвращаются лицензии

# Паттерн для поиска return res.json с licenses
pattern = r'(return res\.json\(\s*\{\s*success: true,\s*licenses:)'

if re.search(pattern, content):
    # Заменяем весь блок getLicenses
    # Найдём начало функции
    start_marker = "static async getLicenses(req: Request, res: Response)"
    end_marker = "static async createLicense"  # следующая функция
    
    start_idx = content.find(start_marker)
    end_idx = content.find(end_marker, start_idx)
    
    if start_idx != -1 and end_idx != -1:
        # Вырезаем функцию getLicenses
        before = content[:start_idx]
        after = content[end_idx:]
        
        # Новая версия функции с конвертацией BigInt
        new_function = '''static async getLicenses(req: Request, res: Response) {
    try {
      const { page = 1, limit = 50, search, status, plan } = req.query;

      const where: any = {};

      if (search) {
        where.OR = [
          { licenseKey: { contains: search as string, mode: 'insensitive' } },
          { organization: { name: { contains: search as string, mode: 'insensitive' } } }
        ];
      }

      if (status) {
        where.status = status as LicenseStatus;
      }

      if (plan) {
        where.plan = plan as Plan;
      }

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);

      const [licenses, total] = await Promise.all([
        getPrismaClient().license.findMany({
          where,
          include: {
            organization: true,
            _count: {
              select: {
                devices: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: (pageNum - 1) * limitNum,
          take: limitNum
        }),
        getPrismaClient().license.count({ where })
      ]);

      // Конвертируем BigInt в Number для JSON
      const licensesWithNumbers = licenses.map(license => ({
        ...license,
        storageLimit: Number(license.storageLimit)
      }));

      return res.json({
        success: true,
        licenses: licensesWithNumbers,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      });
    } catch (error) {
      console.error('Get licenses error:', error);
      return res.status(500).json({
        error: 'Failed to get licenses',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  '''
        
        # Собираем обратно
        content = before + new_function + after
        
        print("✓ Функция getLicenses обновлена (BigInt → Number)")
    else:
        print("⚠ Не удалось найти границы функции getLicenses")
        print("  Начало найдено:", start_idx != -1)
        print("  Конец найден:", end_idx != -1)
else:
    print("⚠ Паттерн return res.json не найден")

# Сохраняем
with open(file_path, 'w') as f:
    f.write(content)

print("✓ Файл сохранён")
PYTHON_SCRIPT

echo -e "${GREEN}✓${NC} AdminController.ts исправлен"
echo ""

echo -e "${BLUE}[3/3] Компиляция...${NC}"
if npm run build; then
    echo ""
    echo -e "${GREEN}✓${NC} Компиляция успешна"
else
    echo ""
    echo -e "${RED}❌ Ошибка компиляции${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}[4/4] Перезапуск сервера...${NC}"
systemctl restart kiosk-license-server
sleep 2

if systemctl is-active --quiet kiosk-license-server; then
    echo -e "${GREEN}✓${NC} License Server перезапущен"
else
    echo -e "${RED}❌ Ошибка перезапуска${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Исправление применено!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}Тест Admin API:${NC}"
echo ""

# Тест авторизации
TOKEN=$(curl -s -X POST http://localhost:3001/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@kiosk.local","password":"Admin123!"}' | jq -r '.token')

if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
    echo -e "${GREEN}✓${NC} Авторизация успешна"
    
    # Тест получения лицензий
    LICENSES=$(curl -s http://localhost:3001/api/admin/licenses \
      -H "Authorization: Bearer $TOKEN")
    
    if echo "$LICENSES" | jq -e '.success' &>/dev/null; then
        echo -e "${GREEN}✓${NC} Список лицензий получен"
        echo ""
        echo "Лицензии:"
        echo "$LICENSES" | jq '.licenses[] | {licenseKey, plan, storageLimit}'
    else
        echo -e "${RED}✗${NC} Ошибка получения лицензий"
    fi
else
    echo -e "${RED}✗${NC} Ошибка авторизации"
fi

echo ""
