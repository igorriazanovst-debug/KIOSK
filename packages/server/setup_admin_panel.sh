#!/bin/bash
# ============================================================
# НАСТРОЙКА ADMIN PANEL — Iteration 4.5
# Запускай на сервере: sudo bash setup_admin_panel.sh
# ============================================================

set -e

ADMIN_DIST="/opt/kiosk/kiosk-content-platform/packages/admin/dist"
ADMIN_ENV="/opt/kiosk/kiosk-content-platform/packages/admin/.env"
NGINX_CONF="/etc/nginx/sites-available/kiosk-admin"
NGINX_LINK="/etc/nginx/sites-enabled/kiosk-admin"
SERVER_ENV="/opt/kiosk/kiosk-content-platform/packages/server/.env"
SERVER_IP="31.192.110.121"

echo "=============================================="
echo "  1. Обновляем .env Admin Panel (License Server URL)"
echo "=============================================="

echo "  Текущее значение:"
grep "VITE_LICENSE_SERVER_URL" "$ADMIN_ENV"

sed -i "s|^VITE_LICENSE_SERVER_URL=.*|VITE_LICENSE_SERVER_URL=http://${SERVER_IP}:3001|" "$ADMIN_ENV"

echo "  Новое значение:"
grep "VITE_LICENSE_SERVER_URL" "$ADMIN_ENV"
echo "  ✓ .env обновлён"

echo ""
echo "=============================================="
echo "  2. Пересобираем Admin Panel (dist/)"
echo "=============================================="

cd /opt/kiosk/kiosk-content-platform/packages/admin
npm run build 2>&1
if [ $? -ne 0 ]; then
    echo "  ✗ ОШИБКА сборки! Остановка скрипта."
    exit 1
fi
echo "  ✓ Сборка dist/ завершена"
ls -la dist/

echo ""
echo "=============================================="
echo "  3. Создаём nginx конфиг для Admin Panel"
echo "=============================================="

cat > "$NGINX_CONF" << NGINX
server {
    listen 80;
    server_name ${SERVER_IP};

    root ${ADMIN_DIST};
    index index.html;

    # --- Статика Admin Panel (React SPA) ---
    location / {
        # SPA fallback: файл не найден → index.html (для React Router)
        try_files \$uri \$uri/ /index.html;
    }

    # --- Проксируем API на License Server ---
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        proxy_connect_timeout 30;
        proxy_send_timeout 30;
        proxy_read_timeout 30;
    }

    client_max_body_size 50M;
}
NGINX

echo "  ✓ Конфиг создан: $NGINX_CONF"

echo ""
echo "=============================================="
echo "  4. Создаём symlink в sites-enabled"
echo "=============================================="

if [ -L "$NGINX_LINK" ]; then
    rm "$NGINX_LINK"
fi
ln -s "$NGINX_CONF" "$NGINX_LINK"
echo "  ✓ Symlink: $NGINX_LINK"

echo ""
echo "=============================================="
echo "  5. Удаляем старый конфиг techcards"
echo "=============================================="

if [ -L "/etc/nginx/sites-enabled/techcards" ]; then
    rm "/etc/nginx/sites-enabled/techcards"
    echo "  ✓ Удалён techcards"
else
    echo "  — techcards не найден, пропускаем"
fi

echo ""
echo "=============================================="
echo "  6. Проверяем nginx конфиг на синтаксис"
echo "=============================================="

nginx -t 2>&1
if [ $? -ne 0 ]; then
    echo "  ✗ ОШИБКА синтаксиса nginx! Остановка скрипта."
    exit 1
fi
echo "  ✓ Синтаксис OK"

echo ""
echo "=============================================="
echo "  7. Перезагружаем nginx"
echo "=============================================="

systemctl reload nginx
echo "  ✓ Nginx перезагружен"

echo ""
echo "=============================================="
echo "  8. Обновляем CORS_ORIGIN на License Server"
echo "=============================================="

echo "  Текущий CORS_ORIGIN:"
grep "CORS_ORIGIN" "$SERVER_ENV"

sed -i "s|^CORS_ORIGIN=.*|CORS_ORIGIN=\"http://localhost:5173,http://localhost:3000,http://${SERVER_IP}\"|" "$SERVER_ENV"

echo "  Новый CORS_ORIGIN:"
grep "CORS_ORIGIN" "$SERVER_ENV"
echo "  ✓ CORS обновлён"

echo ""
echo "=============================================="
echo "  9. Перезапускаем License Server"
echo "=============================================="

systemctl restart kiosk-license-server
sleep 2
echo "  Health check:"
curl -s http://localhost:3001/health
echo ""
echo "  ✓ License Server перезапущен"

echo ""
echo "=============================================="
echo "  10. Итоговая проверка"
echo "=============================================="

echo "  --- curl http://localhost/ (HTML Admin Panel) ---"
curl -s http://localhost/ | head -15
echo ""

echo "  --- curl http://localhost/api/health (JSON License Server) ---"
curl -s http://localhost/api/health
echo ""

echo ""
echo "=============================================="
echo "  НАСТРОЙКА ЗАВЕРШЕНА"
echo "  Открой в браузере: http://${SERVER_IP}/"
echo "=============================================="
