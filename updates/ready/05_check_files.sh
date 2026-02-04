#!/bin/bash
################################################################################
# Проверка файлов editor-web
################################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Проверка файлов editor-web                                       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# 1. Структура файлов
echo -e "${YELLOW}[1/5] Структура файлов в /opt/kiosk/editor-web...${NC}"
ls -lh /opt/kiosk/editor-web/
echo ""
ls -lh /opt/kiosk/editor-web/assets/ 2>/dev/null || echo "⚠ Папка assets не найдена"

# 2. Проверка index.html
echo ""
echo -e "${YELLOW}[2/5] Содержимое index.html...${NC}"
if [ -f "/opt/kiosk/editor-web/index.html" ]; then
    echo -e "${GREEN}✓ index.html найден${NC}"
    echo -e "${BLUE}Первые 30 строк:${NC}"
    head -30 /opt/kiosk/editor-web/index.html
else
    echo -e "${RED}❌ index.html не найден${NC}"
fi

# 3. Проверка доступности через curl
echo ""
echo -e "${YELLOW}[3/5] Проверка доступности index.html...${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/)
if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓ HTTP 200 OK${NC}"
else
    echo -e "${RED}❌ HTTP $HTTP_CODE${NC}"
fi

# 4. Проверка JS файлов
echo ""
echo -e "${YELLOW}[4/5] Проверка JavaScript файлов...${NC}"
JS_COUNT=$(find /opt/kiosk/editor-web/assets/ -name "*.js" 2>/dev/null | wc -l)
if [ "$JS_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ Найдено $JS_COUNT JavaScript файлов${NC}"
    find /opt/kiosk/editor-web/assets/ -name "*.js" -exec ls -lh {} \;
else
    echo -e "${RED}❌ JavaScript файлы не найдены${NC}"
fi

# 5. Проверка что файлы читаемые
echo ""
echo -e "${YELLOW}[5/5] Проверка прав доступа...${NC}"
if [ -r "/opt/kiosk/editor-web/index.html" ]; then
    echo -e "${GREEN}✓ index.html читаемый${NC}"
else
    echo -e "${RED}❌ index.html не читаемый${NC}"
fi

# Тест одного JS файла
JS_FILE=$(find /opt/kiosk/editor-web/assets/ -name "index-*.js" 2>/dev/null | head -1)
if [ -n "$JS_FILE" ]; then
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:8080/assets/$(basename $JS_FILE)" | grep -q "200"; then
        echo -e "${GREEN}✓ JavaScript файлы доступны через HTTP${NC}"
    else
        echo -e "${RED}❌ JavaScript файлы НЕ доступны через HTTP${NC}"
    fi
fi

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Проверка в браузере                                              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Откройте DevTools (F12) и проверьте:${NC}"
echo ""
echo -e "1. ${BLUE}Console${NC} - есть ли ошибки?"
echo -e "2. ${BLUE}Network${NC} - все ли файлы загружаются?"
echo -e "3. ${BLUE}Application → Local Storage${NC} - есть ли данные?"
echo ""
