#!/bin/bash

echo "🔍 Media Server Diagnostic & Fix"
echo "=================================="
echo ""

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

cd /opt/kiosk/kiosk-content-platform/packages/server

echo "1. Проверка файлов в data/media/"
echo "--------------------------------"
echo ""

if [ -d "data/media" ]; then
    FILE_COUNT=$(ls -1 data/media/ 2>/dev/null | wc -l)
    echo -e "${GREEN}✓${NC} Папка data/media существует"
    echo "  Файлов: $FILE_COUNT"
    echo ""
    echo "Первые 5 файлов:"
    ls -lh data/media/ | head -6
    echo ""
    
    # Проверяем конкретный файл
    TEST_FILE="data/media/d7bed63f-0c8a-469d-9286-caeb359bf1ff.jpg"
    if [ -f "$TEST_FILE" ]; then
        echo -e "${GREEN}✓${NC} Тестовый файл существует: $TEST_FILE"
        ls -lh "$TEST_FILE"
    else
        echo -e "${RED}✗${NC} Тестовый файл НЕ найден: $TEST_FILE"
        echo "  Возможно загружены другие файлы"
    fi
else
    echo -e "${RED}✗${NC} Папка data/media НЕ существует!"
    echo "  Создаём..."
    mkdir -p data/media
    chmod 755 data/media
fi

echo ""
echo "2. Проверка прав доступа"
echo "------------------------"
echo ""

OWNER=$(stat -c '%U:%G' data/media)
PERMS=$(stat -c '%a' data/media)

echo "Владелец: $OWNER"
echo "Права: $PERMS"

if [ "$PERMS" != "755" ] && [ "$PERMS" != "777" ]; then
    echo -e "${YELLOW}⚠${NC} Права могут быть недостаточными"
    echo "  Исправляем..."
    chmod -R 755 data/media
    echo -e "${GREEN}✓${NC} Права исправлены на 755"
fi

echo ""
echo "3. Проверка настройки Express"
echo "-----------------------------"
echo ""

if grep -q "express.static.*MEDIA_PATH" src/index.js; then
    echo -e "${GREEN}✓${NC} Найдена строка: app.use('/media', express.static(MEDIA_PATH))"
    grep -n "express.static.*MEDIA" src/index.js
else
    echo -e "${RED}✗${NC} НЕ найдена настройка статических файлов!"
    echo ""
    echo "Проверяем что есть в index.js:"
    grep -n "app.use" src/index.js | head -10
fi

echo ""
echo "4. Проверка переменной MEDIA_PATH"
echo "----------------------------------"
echo ""

MEDIA_PATH_LINE=$(grep "MEDIA_PATH.*=" src/index.js | head -1)
echo "Строка определения: $MEDIA_PATH_LINE"

# Проверяем .env
if [ -f ".env" ]; then
    if grep -q "MEDIA_PATH" .env; then
        echo ""
        echo "В .env:"
        grep "MEDIA_PATH" .env
    else
        echo ""
        echo -e "${YELLOW}⚠${NC} MEDIA_PATH не задан в .env, используется значение по умолчанию"
    fi
fi

echo ""
echo "5. Тест доступа к файлу"
echo "-----------------------"
echo ""

# Пробуем получить доступ через curl
echo "Проверяем: http://localhost:3001/media/d7bed63f-0c8a-469d-9286-caeb359bf1ff.jpg"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/media/d7bed63f-0c8a-469d-9286-caeb359bf1ff.jpg)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓${NC} HTTP 200 OK - файл доступен!"
elif [ "$HTTP_CODE" = "404" ]; then
    echo -e "${RED}✗${NC} HTTP 404 - файл не найден"
    echo "  Проблема: сервер не находит файл"
elif [ "$HTTP_CODE" = "000" ]; then
    echo -e "${RED}✗${NC} Сервер не отвечает"
    echo "  Проверьте что сервер запущен: systemctl status kiosk-server"
else
    echo -e "${YELLOW}⚠${NC} HTTP $HTTP_CODE"
fi

echo ""
echo "6. Проверка логов сервера"
echo "-------------------------"
echo ""

echo "Последние 10 строк логов:"
journalctl -u kiosk-server -n 10 --no-pager

echo ""
echo "========================================"
echo "РЕКОМЕНДАЦИИ:"
echo "========================================"
echo ""

if [ "$HTTP_CODE" = "404" ]; then
    echo "❌ ПРОБЛЕМА: Сервер запущен, но не раздает файлы"
    echo ""
    echo "РЕШЕНИЕ 1: Проверьте src/index.js"
    echo "  Должна быть строка:"
    echo "  app.use('/media', express.static(MEDIA_PATH));"
    echo ""
    echo "РЕШЕНИЕ 2: Проверьте что MEDIA_PATH правильный"
    echo "  cat src/index.js | grep MEDIA_PATH"
    echo ""
    echo "РЕШЕНИЕ 3: Перезапустите сервер"
    echo "  sudo systemctl restart kiosk-server"
    echo ""
elif [ "$HTTP_CODE" = "200" ]; then
    echo "✅ ВСЁ РАБОТАЕТ!"
    echo ""
    echo "Если в браузере не работает, проверьте:"
    echo "  1. CORS настройки"
    echo "  2. Firewall"
    echo "  3. URL в браузере"
    echo ""
elif [ "$HTTP_CODE" = "000" ]; then
    echo "❌ ПРОБЛЕМА: Сервер не запущен"
    echo ""
    echo "РЕШЕНИЕ:"
    echo "  sudo systemctl start kiosk-server"
    echo "  sudo systemctl status kiosk-server"
    echo ""
fi

echo "Для просмотра логов в реальном времени:"
echo "  journalctl -u kiosk-server -f"
echo ""
