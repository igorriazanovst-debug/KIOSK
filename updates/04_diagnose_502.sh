#!/bin/bash
################################################################################
# Диагностика 502 ошибки
################################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Диагностика 502 ошибки                                           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# 1. Проверка License Server
echo -e "${YELLOW}[1/6] Проверка License Server (порт 3001)...${NC}"
if systemctl is-active --quiet kiosk-license-server; then
    echo -e "${GREEN}✓ kiosk-license-server запущен${NC}"
else
    echo -e "${RED}❌ kiosk-license-server НЕ запущен${NC}"
    echo -e "${YELLOW}Статус:${NC}"
    systemctl status kiosk-license-server --no-pager | tail -20
fi

# 2. Проверка порта 3001
echo ""
echo -e "${YELLOW}[2/6] Проверка порта 3001...${NC}"
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Порт 3001 отвечает${NC}"
    curl -s http://localhost:3001/health | python3 -m json.tool 2>/dev/null || echo "Response received"
else
    echo -e "${RED}❌ Порт 3001 НЕ отвечает${NC}"
    echo -e "${YELLOW}Проверяем что слушает порт 3001:${NC}"
    netstat -tlnp | grep 3001 || ss -tlnp | grep 3001 || echo "Порт 3001 не используется"
fi

# 3. Проверка Nginx
echo ""
echo -e "${YELLOW}[3/6] Проверка Nginx...${NC}"
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓ Nginx запущен${NC}"
else
    echo -e "${RED}❌ Nginx НЕ запущен${NC}"
fi

# 4. Проверка конфигурации Nginx
echo ""
echo -e "${YELLOW}[4/6] Проверка конфигурации editor-web...${NC}"
if [ -f "/etc/nginx/sites-available/editor-web" ]; then
    echo -e "${GREEN}✓ Конфиг найден${NC}"
    echo -e "${BLUE}Конфигурация:${NC}"
    grep -A 5 "location /api/" /etc/nginx/sites-available/editor-web
else
    echo -e "${RED}❌ Конфиг не найден${NC}"
fi

# 5. Проверка статических файлов
echo ""
echo -e "${YELLOW}[5/6] Проверка статических файлов...${NC}"
if [ -f "/opt/kiosk/editor-web/index.html" ]; then
    echo -e "${GREEN}✓ index.html найден${NC}"
    ls -lh /opt/kiosk/editor-web/ | head -10
else
    echo -e "${RED}❌ index.html не найден${NC}"
fi

# 6. Логи Nginx
echo ""
echo -e "${YELLOW}[6/6] Последние ошибки Nginx...${NC}"
if [ -f "/var/log/nginx/editor-web.error.log" ]; then
    echo -e "${BLUE}Последние 10 строк error.log:${NC}"
    tail -10 /var/log/nginx/editor-web.error.log
else
    echo -e "${YELLOW}⚠ Лог ошибок пуст или не создан${NC}"
fi

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Рекомендации по исправлению                                      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Определяем проблему
if ! systemctl is-active --quiet kiosk-license-server; then
    echo -e "${RED}ПРОБЛЕМА: License Server не запущен${NC}"
    echo ""
    echo -e "${YELLOW}Решение:${NC}"
    echo "  systemctl start kiosk-license-server"
    echo "  systemctl status kiosk-license-server"
    echo ""
elif ! curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo -e "${RED}ПРОБЛЕМА: License Server запущен, но не отвечает${NC}"
    echo ""
    echo -e "${YELLOW}Решение:${NC}"
    echo "  # Проверить логи"
    echo "  journalctl -u kiosk-license-server -n 50"
    echo ""
    echo "  # Перезапустить"
    echo "  systemctl restart kiosk-license-server"
    echo ""
else
    echo -e "${GREEN}✓ License Server работает${NC}"
    echo -e "${YELLOW}Проверьте браузер еще раз: http://31.192.110.121:8080${NC}"
fi

echo ""
