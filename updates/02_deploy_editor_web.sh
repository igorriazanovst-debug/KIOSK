#!/bin/bash
################################################################################
# Скрипт 2: Деплой editor-web на production сервер
# - Build production version
# - Настройка Nginx
# - Копирование файлов
# - Проверка работоспособности
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  ШАГ 2: Деплой editor-web на production                           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

WEB_PATH="/opt/kiosk/kiosk-content-platform/packages/editor-web"
DEPLOY_PATH="/opt/kiosk/editor-web"
NGINX_CONFIG="/etc/nginx/sites-available/editor-web"
NGINX_ENABLED="/etc/nginx/sites-enabled/editor-web"

# Проверка root прав
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Запустите скрипт с sudo${NC}"
    exit 1
fi

# Шаг 1: Проверка editor-web
echo -e "${YELLOW}[1/6] Проверка editor-web...${NC}"
if [ ! -d "$WEB_PATH" ]; then
    echo -e "${RED}❌ Директория $WEB_PATH не найдена${NC}"
    echo -e "${YELLOW}Запустите сначала: 01_prepare_editor_web.sh${NC}"
    exit 1
fi
echo -e "${GREEN}✓ editor-web найден${NC}"

# Шаг 2: Установка зависимостей
echo -e "${YELLOW}[2/6] Установка зависимостей...${NC}"
cd "$WEB_PATH"

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Установка npm пакетов...${NC}"
    npm install
fi

echo -e "${GREEN}✓ Зависимости установлены${NC}"

# Шаг 3: Build production версии
echo -e "${YELLOW}[3/6] Сборка production версии...${NC}"

# Удалить старый build
rm -rf dist

# Собрать
npm run build

if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Build не удался, директория dist не создана${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Build завершён${NC}"

# Шаг 4: Создание директории деплоя
echo -e "${YELLOW}[4/6] Подготовка директории деплоя...${NC}"

# Создать backup если существует
if [ -d "$DEPLOY_PATH" ]; then
    echo -e "${YELLOW}⚠ Создание backup...${NC}"
    mv "$DEPLOY_PATH" "${DEPLOY_PATH}.backup.$(date +%Y%m%d_%H%M%S)"
fi

# Создать директорию
mkdir -p "$DEPLOY_PATH"

# Скопировать build
cp -r dist/* "$DEPLOY_PATH/"

# Установить права
chown -R www-data:www-data "$DEPLOY_PATH"
chmod -R 755 "$DEPLOY_PATH"

echo -e "${GREEN}✓ Файлы скопированы в $DEPLOY_PATH${NC}"

# Шаг 5: Настройка Nginx
echo -e "${YELLOW}[5/6] Настройка Nginx...${NC}"

# Создать конфиг
cat > "$NGINX_CONFIG" << 'EOF'
server {
    listen 8080;
    server_name 31.192.110.121;
    
    root /opt/kiosk/editor-web;
    index index.html;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # API proxy к License Server
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Передача Authorization header
        proxy_pass_request_headers on;
    }
    
    # Статика с кешированием
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Максимальный размер загрузки (для медиафайлов)
    client_max_body_size 100M;
    
    # Логи
    access_log /var/log/nginx/editor-web.access.log;
    error_log /var/log/nginx/editor-web.error.log;
}
EOF

# Включить конфиг
if [ ! -L "$NGINX_ENABLED" ]; then
    ln -sf "$NGINX_CONFIG" "$NGINX_ENABLED"
fi

# Проверить конфигурацию
nginx -t

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Nginx конфигурация валидна${NC}"
    
    # Перезагрузить Nginx
    systemctl reload nginx
    echo -e "${GREEN}✓ Nginx перезагружен${NC}"
else
    echo -e "${RED}❌ Ошибка в конфигурации Nginx${NC}"
    exit 1
fi

# Шаг 6: Проверка работоспособности
echo -e "${YELLOW}[6/6] Проверка работоспособности...${NC}"

sleep 2

# Проверка HTTP
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/)

if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓ HTTP check passed (200 OK)${NC}"
else
    echo -e "${RED}❌ HTTP check failed (код: $HTTP_CODE)${NC}"
fi

# Проверка файлов
if [ -f "$DEPLOY_PATH/index.html" ]; then
    echo -e "${GREEN}✓ index.html найден${NC}"
else
    echo -e "${RED}❌ index.html не найден${NC}"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ ДЕПЛОЙ ЗАВЕРШЁН                                                ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📍 URLs:${NC}"
echo -e "   Local:    http://localhost:8080"
echo -e "   External: http://31.192.110.121:8080"
echo ""
echo -e "${BLUE}📁 Paths:${NC}"
echo -e "   Web root: $DEPLOY_PATH"
echo -e "   Nginx config: $NGINX_CONFIG"
echo ""
echo -e "${BLUE}🔧 Useful commands:${NC}"
echo -e "   Nginx logs:   tail -f /var/log/nginx/editor-web.access.log"
echo -e "   Nginx reload: systemctl reload nginx"
echo -e "   Nginx status: systemctl status nginx"
echo ""
echo -e "${YELLOW}➡️  Откройте http://31.192.110.121:8080 в браузере${NC}"
echo ""
