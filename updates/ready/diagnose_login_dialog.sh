#!/bin/bash

# 🔍 Диагностика проблемы с LoginDialog в Toolbar

echo "=========================================="
echo "🔍 ДИАГНОСТИКА LoginDialog"
echo "=========================================="
echo ""

EDITOR_SRC="/opt/kiosk/kiosk-content-platform/packages/editor-web/src"
TOOLBAR_PATH="$EDITOR_SRC/components/Toolbar.tsx"
LOGIN_DIALOG_PATH="$EDITOR_SRC/components/LoginDialog.tsx"
LOGIN_CSS_PATH="$EDITOR_SRC/components/LoginDialog.css"

# 1. Проверяем что файлы существуют
echo "1️⃣ Проверка наличия файлов:"
echo "-------------------------------------------"

if [ -f "$TOOLBAR_PATH" ]; then
    echo "✅ Toolbar.tsx найден"
else
    echo "❌ Toolbar.tsx НЕ НАЙДЕН!"
fi

if [ -f "$LOGIN_DIALOG_PATH" ]; then
    echo "✅ LoginDialog.tsx найден"
else
    echo "❌ LoginDialog.tsx НЕ НАЙДЕН!"
fi

if [ -f "$LOGIN_CSS_PATH" ]; then
    echo "✅ LoginDialog.css найден"
else
    echo "⚠️ LoginDialog.css НЕ НАЙДЕН (может быть не критично)"
fi

echo ""

# 2. Проверяем импорт LoginDialog в Toolbar
echo "2️⃣ Проверка импорта LoginDialog в Toolbar:"
echo "-------------------------------------------"

if [ -f "$TOOLBAR_PATH" ]; then
    if grep -q "LoginDialog" "$TOOLBAR_PATH"; then
        echo "✅ Упоминание LoginDialog найдено в Toolbar.tsx"
        echo ""
        echo "Строки с LoginDialog:"
        grep -n "LoginDialog" "$TOOLBAR_PATH" | head -5
    else
        echo "❌ LoginDialog НЕ упоминается в Toolbar.tsx!"
        echo "   Это может быть причиной проблемы!"
    fi
else
    echo "❌ Не могу проверить - Toolbar.tsx не найден"
fi

echo ""

# 3. Проверяем state для показа диалога
echo "3️⃣ Проверка state управления диалогом:"
echo "-------------------------------------------"

if [ -f "$TOOLBAR_PATH" ]; then
    if grep -q "showLoginDialog\|isLoginDialogOpen\|loginDialogOpen" "$TOOLBAR_PATH"; then
        echo "✅ Найдена переменная состояния для LoginDialog"
        echo ""
        echo "State переменные:"
        grep -n "showLoginDialog\|isLoginDialogOpen\|loginDialogOpen" "$TOOLBAR_PATH" | head -5
    else
        echo "⚠️ Не найдена переменная состояния для управления показом диалога"
    fi
else
    echo "❌ Не могу проверить - Toolbar.tsx не найден"
fi

echo ""

# 4. Покажем фрагмент кода Toolbar.tsx с импортами
echo "4️⃣ Первые 30 строк Toolbar.tsx (импорты):"
echo "-------------------------------------------"

if [ -f "$TOOLBAR_PATH" ]; then
    head -30 "$TOOLBAR_PATH"
else
    echo "❌ Файл не найден"
fi

echo ""
echo ""

# 5. Покажем структуру return в Toolbar
echo "5️⃣ Return секция Toolbar (где должен быть LoginDialog):"
echo "-------------------------------------------"

if [ -f "$TOOLBAR_PATH" ]; then
    # Находим return и показываем 50 строк после
    grep -A 50 "return (" "$TOOLBAR_PATH" | head -60
else
    echo "❌ Файл не найден"
fi

echo ""
echo ""

# 6. Проверяем существование LoginDialog.tsx
echo "6️⃣ Содержимое LoginDialog.tsx (первые 20 строк):"
echo "-------------------------------------------"

if [ -f "$LOGIN_DIALOG_PATH" ]; then
    head -20 "$LOGIN_DIALOG_PATH"
else
    echo "❌ Файл не найден"
fi

echo ""
echo ""

# 7. Проверяем AutoSaveIndicator для сравнения (он же работает!)
echo "7️⃣ Для сравнения - AutoSaveIndicator в Toolbar:"
echo "-------------------------------------------"

if [ -f "$TOOLBAR_PATH" ]; then
    if grep -q "AutoSaveIndicator" "$TOOLBAR_PATH"; then
        echo "✅ AutoSaveIndicator найден (для сравнения)"
        echo ""
        grep -n "AutoSaveIndicator" "$TOOLBAR_PATH"
    else
        echo "⚠️ AutoSaveIndicator не найден"
    fi
else
    echo "❌ Файл не найден"
fi

echo ""
echo ""
echo "=========================================="
echo "✅ ДИАГНОСТИКА ЗАВЕРШЕНА"
echo "=========================================="
echo ""
echo "📋 Следующий шаг:"
echo "   Изучи вывод выше и скажи Клоду что ты видишь"
echo ""
