#!/bin/bash

# 🚀 Универсальный скрипт исправления LoginDialog
# Исправляет Toolbar.tsx и делает полный deploy

echo "=========================================="
echo "🚀 ИСПРАВЛЕНИЕ И ДЕПЛОЙ LoginDialog"
echo "=========================================="
echo ""

# Цвета для вывода
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

EDITOR_PATH="/opt/kiosk/kiosk-content-platform/packages/editor-web"
TOOLBAR_PATH="$EDITOR_PATH/src/components/Toolbar.tsx"
DEPLOY_PATH="/opt/kiosk/editor-web"

# Проверка что скрипт запущен на сервере
if [ ! -d "$EDITOR_PATH" ]; then
    echo -e "${RED}❌ Директория не найдена: $EDITOR_PATH${NC}"
    echo "   Запустите скрипт на production сервере!"
    exit 1
fi

echo "1️⃣ Создаём backup..."
BACKUP_PATH="$TOOLBAR_PATH.backup.$(date +%Y%m%d_%H%M%S)"
cp "$TOOLBAR_PATH" "$BACKUP_PATH"
echo -e "${GREEN}✅ Backup: $BACKUP_PATH${NC}"
echo ""

echo "2️⃣ Заменяем Toolbar.tsx на исправленную версию..."

# Создаём временный файл с ПОЛНЫМ исправленным кодом
cat > /tmp/Toolbar_FIXED.tsx << 'TOOLBAR_FIXED_EOF'
/**
 * Toolbar Component - ВЕРСИЯ 2.0 ИСПРАВЛЕННАЯ
 * С интеграцией аутентификации и автосохранения
 */

import React, { useState, useEffect } from 'react';
import { 
  Save, 
  FolderOpen, 
  Undo2, 
  Redo2, 
  ZoomIn, 
  ZoomOut, 
  Grid, 
  Magnet,
  Play,
  User,
  LogOut,
  Key
} from 'lucide-react';
import { useEditorStore } from '../stores/editorStore';
import { apiClient } from '../services/api-client';
import LoginDialog from './LoginDialog';
import AutoSaveIndicator from './AutoSaveIndicator';
import './Toolbar.css';

export const Toolbar: React.FC = () => {
  const {
    project,
    history,
    zoom,
    gridEnabled,
    snapToGrid,
    undo,
    redo,
    setZoom,
    toggleGrid,
    toggleSnapToGrid,
    saveProject
  } = useEditorStore();

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [showLoginDialog, setShowLoginDialog] = useState(false);

  // Проверка аутентификации при монтировании
  useEffect(() => {
    const checkAuth = async () => {
      const authenticated = apiClient.isAuthenticated();
      
      if (authenticated) {
        try {
          const valid = await apiClient.verifyToken();
          if (valid) {
            setIsAuthenticated(true);
            // TODO: Получить данные организации из токена или API
          } else {
            setIsAuthenticated(false);
          }
        } catch (error) {
          setIsAuthenticated(false);
        }
      } else {
        // Показать диалог входа если не авторизован
        setShowLoginDialog(true);
      }
    };

    checkAuth();

    // Слушать события выхода
    const handleLogout = () => {
      setIsAuthenticated(false);
      setOrganizationName(null);
      setPlan(null);
      setShowLoginDialog(true);
    };

    window.addEventListener('auth:logout', handleLogout);
    window.addEventListener('auth:unauthorized', handleLogout);

    return () => {
      window.removeEventListener('auth:logout', handleLogout);
      window.removeEventListener('auth:unauthorized', handleLogout);
    };
  }, []);

  const handleLoginSuccess = (orgName: string, planType: string) => {
    setIsAuthenticated(true);
    setOrganizationName(orgName);
    setPlan(planType);
    console.log('[Toolbar] Login successful:', orgName, planType);
  };

  const handleLogout = () => {
    if (confirm('Вы уверены что хотите выйти?')) {
      apiClient.logout();
      setIsAuthenticated(false);
      setOrganizationName(null);
      setPlan(null);
      setShowLoginDialog(true);
    }
  };

  const handleSave = async () => {
    if (!project) return;
    try {
      await saveProject();
    } catch (error) {
      console.error('[Toolbar] Save failed:', error);
      alert('Не удалось сохранить проект');
    }
  };

  const handleZoomIn = () => setZoom(zoom + 0.1);
  const handleZoomOut = () => setZoom(zoom - 0.1);
  const handleResetZoom = () => setZoom(1);

  return (
    <>
      <div className="toolbar">
        {/* Left section */}
        <div className="toolbar-section">
          {/* Auth section */}
          {isAuthenticated ? (
            <div className="auth-section authenticated">
              <div className="user-info">
                <User size={16} />
                <div className="user-details">
                  <span className="org-name">{organizationName || 'Organization'}</span>
                  <span className="plan-badge">{plan || 'BASIC'}</span>
                </div>
              </div>
              <button 
                className="toolbar-btn logout-btn" 
                onClick={handleLogout}
                title="Выйти"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <button 
              className="toolbar-btn login-btn" 
              onClick={() => setShowLoginDialog(true)}
              title="Войти"
            >
              <Key size={18} />
              <span>Войти</span>
            </button>
          )}

          <div className="toolbar-divider" />

          {/* File operations */}
          <button 
            className="toolbar-btn" 
            onClick={handleSave}
            disabled={!project || !isAuthenticated}
            title="Сохранить (Ctrl+S)"
          >
            <Save size={18} />
            <span>Сохранить</span>
          </button>

          <button 
            className="toolbar-btn" 
            disabled={!isAuthenticated}
            title="Открыть проект"
          >
            <FolderOpen size={18} />
            <span>Открыть</span>
          </button>
        </div>

        {/* Center section */}
        <div className="toolbar-section">
          {/* History */}
          <button 
            className="toolbar-btn" 
            onClick={undo}
            disabled={history.past.length === 0}
            title="Отменить (Ctrl+Z)"
          >
            <Undo2 size={18} />
          </button>

          <button 
            className="toolbar-btn" 
            onClick={redo}
            disabled={history.future.length === 0}
            title="Вернуть (Ctrl+Shift+Z)"
          >
            <Redo2 size={18} />
          </button>

          <div className="toolbar-divider" />

          {/* Zoom */}
          <button 
            className="toolbar-btn" 
            onClick={handleZoomOut}
            disabled={zoom <= 0.1}
            title="Уменьшить (Ctrl+-)"
          >
            <ZoomOut size={18} />
          </button>

          <button 
            className="toolbar-btn zoom-display" 
            onClick={handleResetZoom}
            title="Сбросить масштаб (Ctrl+0)"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button 
            className="toolbar-btn" 
            onClick={handleZoomIn}
            disabled={zoom >= 5}
            title="Увеличить (Ctrl+=)"
          >
            <ZoomIn size={18} />
          </button>

          <div className="toolbar-divider" />

          {/* Grid */}
          <button 
            className={`toolbar-btn ${gridEnabled ? 'active' : ''}`}
            onClick={toggleGrid}
            title="Показать сетку"
          >
            <Grid size={18} />
          </button>

          <button 
            className={`toolbar-btn ${snapToGrid ? 'active' : ''}`}
            onClick={toggleSnapToGrid}
            title="Привязка к сетке"
          >
            <Magnet size={18} />
          </button>
        </div>

        {/* Right section */}
        <div className="toolbar-section">
          {/* AutoSave Indicator */}
          {isAuthenticated && project && <AutoSaveIndicator />}

          <div className="toolbar-divider" />

          {/* Preview */}
          <button 
            className="toolbar-btn preview-btn" 
            disabled={!project}
            title="Предпросмотр"
          >
            <Play size={18} />
            <span>Предпросмотр</span>
          </button>
        </div>
      </div>

      {/* Login Dialog */}
      {showLoginDialog && (
        <LoginDialog 
          onClose={() => !isAuthenticated ? null : setShowLoginDialog(false)}
          onSuccess={handleLoginSuccess}
        />
      )}
    </>
  );
};

export default Toolbar;
TOOLBAR_FIXED_EOF

# Заменяем файл
cp /tmp/Toolbar_FIXED.tsx "$TOOLBAR_PATH"
echo -e "${GREEN}✅ Toolbar.tsx заменён на исправленную версию${NC}"
echo ""

echo "3️⃣ Проверяем что LoginDialog существует..."
LOGIN_DIALOG_PATH="$EDITOR_PATH/src/components/LoginDialog.tsx"
LOGIN_CSS_PATH="$EDITOR_PATH/src/components/LoginDialog.css"

if [ -f "$LOGIN_DIALOG_PATH" ]; then
    echo -e "${GREEN}✅ LoginDialog.tsx найден${NC}"
else
    echo -e "${RED}⚠️ LoginDialog.tsx НЕ НАЙДЕН${NC}"
    echo "   Убедитесь что файл существует!"
fi

if [ -f "$LOGIN_CSS_PATH" ]; then
    echo -e "${GREEN}✅ LoginDialog.css найден${NC}"
else
    echo -e "${YELLOW}⚠️ LoginDialog.css НЕ НАЙДЕН (может быть не критично)${NC}"
fi

echo ""

echo "4️⃣ Build проекта..."
cd "$EDITOR_PATH"

# Удаляем старый build
rm -rf dist

# Запускаем build
echo "   Запускаем: npm run build..."
if npm run build; then
    echo -e "${GREEN}✅ Build успешно завершён${NC}"
else
    echo -e "${RED}❌ Build завершился с ошибками${NC}"
    echo "   Проверьте ошибки выше"
    exit 1
fi

echo ""

echo "5️⃣ Проверяем результат build..."
if [ -d "dist" ] && [ -f "dist/index.html" ]; then
    echo -e "${GREEN}✅ Dist директория создана${NC}"
    echo "   Размеры файлов:"
    du -sh dist/
    ls -lh dist/assets/ | grep -E "\.(js|css)$" | awk '{print "   "$9" - "$5}'
else
    echo -e "${RED}❌ Dist директория не создана!${NC}"
    exit 1
fi

echo ""

echo "6️⃣ Deploy на production..."
# Удаляем старые файлы
rm -rf "$DEPLOY_PATH"/*

# Копируем новые файлы
cp -r dist/* "$DEPLOY_PATH/"

# Устанавливаем права
chown -R www-data:www-data "$DEPLOY_PATH"

echo -e "${GREEN}✅ Файлы скопированы в $DEPLOY_PATH${NC}"
echo ""

echo "7️⃣ Перезагружаем Nginx..."
if nginx -t; then
    systemctl reload nginx
    echo -e "${GREEN}✅ Nginx перезагружен${NC}"
else
    echo -e "${RED}❌ Ошибка конфигурации Nginx${NC}"
    exit 1
fi

echo ""

echo "8️⃣ Проверяем доступность..."
sleep 2

if curl -s -o /dev/null -w "%{http_code}" http://localhost:8080 | grep -q "200"; then
    echo -e "${GREEN}✅ Editor доступен на http://localhost:8080${NC}"
else
    echo -e "${RED}⚠️ Editor недоступен (может потребоваться время)${NC}"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}✅ ИСПРАВЛЕНИЕ ЗАВЕРШЕНО!${NC}"
echo "=========================================="
echo ""
echo "📋 Что было сделано:"
echo "   1. Создан backup: $BACKUP_PATH"
echo "   2. Заменён Toolbar.tsx на исправленную версию"
echo "   3. Выполнен build проекта"
echo "   4. Задеплоено на production"
echo "   5. Nginx перезагружен"
echo ""
echo "🌐 Проверьте работу:"
echo "   URL: http://31.192.110.121:8080"
echo ""
echo "🔍 Что должно работать:"
echo "   ✅ Диалог входа LoginDialog показывается"
echo "   ✅ Кнопка 'Войти' в Toolbar"
echo "   ✅ После входа показывается User info"
echo "   ✅ AutoSaveIndicator работает"
echo ""
echo "💡 Если всё ещё не работает:"
echo "   1. Откройте DevTools (F12)"
echo "   2. Проверьте Console на ошибки"
echo "   3. Проверьте вкладку Network"
echo ""
