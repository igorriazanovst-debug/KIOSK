#!/bin/bash
# ============================================================
# ДИАГНОСТИКА СЕРВЕРА — Iteration 4.5
# Запускай на сервере: sudo bash diagnose.sh
# ============================================================

echo "=============================================="
echo "  1. NGINX — статус"
echo "=============================================="
systemctl status nginx 2>&1 | head -25

echo ""
echo "=============================================="
echo "  2. NGINX — конфиги (sites-enabled)"
echo "=============================================="
ls -la /etc/nginx/sites-enabled/ 2>&1
echo ""
for f in /etc/nginx/sites-enabled/*; do
    echo "--- $f ---"
    cat "$f" 2>&1
    echo ""
done

echo ""
echo "=============================================="
echo "  3. UFW — firewall правила"
echo "=============================================="
ufw status 2>&1

echo ""
echo "=============================================="
echo "  4. License Server — health check"
echo "=============================================="
curl -s http://localhost:3001/health 2>&1
echo ""

echo ""
echo "=============================================="
echo "  5. Admin Panel — env.d.ts"
echo "=============================================="
cat /opt/kiosk/kiosk-content-platform/packages/admin/src/env.d.ts 2>&1

echo ""
echo "=============================================="
echo "  6. Admin Panel — .env"
echo "=============================================="
cat /opt/kiosk/kiosk-content-platform/packages/admin/.env 2>&1

echo ""
echo "=============================================="
echo "  7. License Server — CORS настройки"
echo "=============================================="
echo "--- .env сервера ---"
cat /opt/kiosk/kiosk-content-platform/packages/server/.env 2>&1
echo ""
echo "--- grep CORS/cors/origin в src/ ---"
grep -rn "CORS\|cors\|origin\|allowedOrigins" /opt/kiosk/kiosk-content-platform/packages/server/src/ 2>&1 | head -30

echo ""
echo "=============================================="
echo "  8. Admin Panel — есть ли dist/ (сборка)"
echo "=============================================="
ls -la /opt/kiosk/kiosk-content-platform/packages/admin/dist/ 2>&1

echo ""
echo "=============================================="
echo "  9. Node/npm версии"
echo "=============================================="
node --version 2>&1
npm --version 2>&1

echo ""
echo "=============================================="
echo "  ДИАГНОСТИКА ЗАВЕРШЕНА"
echo "=============================================="
