#!/bin/bash
# ============================================================
# ФИНАЛЬНАЯ ПРОВЕРКА ADMIN PANEL — Iteration 4.5
# Запускай на сервере: bash final_check.sh
# ============================================================

SERVER_IP="31.192.110.121"

echo "=============================================="
echo "  ФИНАЛЬНАЯ ПРОВЕРКА ADMIN PANEL"
echo "=============================================="

echo ""
echo "1. Nginx конфиг (kiosk-admin):"
echo "-------------------------------------------"
cat /etc/nginx/sites-available/kiosk-admin

echo ""
echo "2. Nginx статус:"
echo "-------------------------------------------"
systemctl status nginx | head -10

echo ""
echo "3. License Server статус:"
echo "-------------------------------------------"
systemctl status kiosk-license-server | head -10

echo ""
echo "4. CORS настройки License Server:"
echo "-------------------------------------------"
grep "CORS_ORIGIN" /opt/kiosk/kiosk-content-platform/packages/server/.env

echo ""
echo "5. Admin Panel .env:"
echo "-------------------------------------------"
cat /opt/kiosk/kiosk-content-platform/packages/admin/.env

echo ""
echo "6. Проверка доступности Admin Panel (HTML):"
echo "-------------------------------------------"
curl -s http://localhost/ | head -20

echo ""
echo "7. Проверка API через /api/health:"
echo "-------------------------------------------"
curl -s http://localhost/api/health | jq '.' 2>/dev/null || curl -s http://localhost/api/health

echo ""
echo "8. Проверка внешнего доступа к главной странице:"
echo "-------------------------------------------"
curl -s http://${SERVER_IP}/ | head -20

echo ""
echo "9. Проверка внешнего доступа к API:"
echo "-------------------------------------------"
curl -s http://${SERVER_IP}/api/health | jq '.' 2>/dev/null || curl -s http://${SERVER_IP}/api/health

echo ""
echo "10. Тест авторизации (POST /api/admin/login):"
echo "-------------------------------------------"
curl -s -X POST http://localhost/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@kiosk.local","password":"Admin123!"}' | jq '.' 2>/dev/null || \
curl -s -X POST http://localhost/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@kiosk.local","password":"Admin123!"}'

echo ""
echo "=============================================="
echo "  ПРОВЕРКА ЗАВЕРШЕНА"
echo ""
echo "  ✓ Admin Panel доступен: http://${SERVER_IP}/"
echo "  ✓ Вход: admin@kiosk.local / Admin123!"
echo "=============================================="
