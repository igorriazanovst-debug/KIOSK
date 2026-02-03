#!/bin/bash
# ==============================================================
# install-admin.sh — Установка Admin Panel (Iteration 4)
# ==============================================================
# Запускайте НА СЕРВЕРЕ (194.58.92.190), после того как
# скопировали архив iteration4-admin-panel.zip в /tmp/
#
#   scp iteration4-admin-panel.zip root@194.58.92.190:/tmp/
#   ssh root@194.58.92.190
#   bash /tmp/install-admin.sh
# ==============================================================

set -e

ROOT="/opt/kiosk/kiosk-content-platform"
ADMIN="$ROOT/packages/admin"
ZIP="/tmp/iteration4-admin-panel.zip"

echo "============================================="
echo "  Iteration 4 — Admin Panel Installation"
echo "============================================="
echo ""

# --- 1. Проверяем архив ---
if [ ! -f "$ZIP" ]; then
    echo "❌ Архив не найден: $ZIP"
    echo ""
    echo "   Скопируйте его на сервер:"
    echo "   scp iteration4-admin-panel.zip root@194.58.92.190:/tmp/"
    exit 1
fi
echo "✓ Архив найден"

# --- 2. Распаковываем ---
echo "→ Распаковываем в $ROOT ..."
cd "$ROOT"
unzip -o "$ZIP"
echo "✓ Распакованы файлы"

# --- 3. Проверяем структуру ---
echo ""
echo "Структура packages/admin:"
find "$ADMIN" -type f | sort
echo ""

# --- 4. Устанавливаем зависимости ---
echo "→ npm install ..."
cd "$ADMIN"
npm install
echo "✓ Зависимости установлены"

# --- 5. Тестируем сборку ---
echo "→ npm run build ..."
npm run build
echo "✓ Сборка успешна (dist/ готов для продакшена)"

echo ""
echo "============================================="
echo "  ✅ Установка завершена!"
echo "============================================="
echo ""
echo "  Для запуска dev-сервера:"
echo "    cd $ADMIN"
echo "    npm run dev"
echo "    → http://localhost:3002"
echo ""
echo "  Для продакшена:"
echo "    Раздавать папку dist/ через nginx"
echo "============================================="
