#!/bin/bash
################################################################################
# Скрипт 1: Подготовка editor-web
# - Копирует packages/editor → packages/editor-web
# - Удаляет Electron зависимости
# - Обновляет конфигурации
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  ШАГ 1: Подготовка editor-web                                     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

BASE_PATH="/opt/kiosk/kiosk-content-platform/packages"
EDITOR_PATH="$BASE_PATH/editor"
WEB_PATH="$BASE_PATH/editor-web"

# Проверка существования editor
if [ ! -d "$EDITOR_PATH" ]; then
    echo -e "${RED}❌ Директория $EDITOR_PATH не найдена${NC}"
    exit 1
fi

# Шаг 1: Копирование
echo -e "${YELLOW}[1/5] Копирование editor → editor-web...${NC}"
if [ -d "$WEB_PATH" ]; then
    echo -e "${YELLOW}⚠ Директория editor-web уже существует, создаю backup...${NC}"
    mv "$WEB_PATH" "${WEB_PATH}.backup.$(date +%Y%m%d_%H%M%S)"
fi

cp -r "$EDITOR_PATH" "$WEB_PATH"
echo -e "${GREEN}✓ Скопировано${NC}"

# Шаг 2: Удаление Electron файлов
echo -e "${YELLOW}[2/5] Удаление Electron файлов...${NC}"
rm -rf "$WEB_PATH/electron"
rm -f "$WEB_PATH/main.cjs"
rm -f "$WEB_PATH/preload.cjs"
echo -e "${GREEN}✓ Electron файлы удалены${NC}"

# Шаг 3: Обновление package.json
echo -e "${YELLOW}[3/5] Обновление package.json...${NC}"

cat > "$WEB_PATH/package.json" << 'EOF'
{
  "name": "@kiosk/editor-web",
  "version": "2.0.0",
  "description": "Kiosk Content Editor - Web Version",
  "author": "Kiosk Platform Team",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "clean": "rimraf dist"
  },
  "dependencies": {
    "@kiosk/shared": "file:../shared",
    "@tiptap/react": "^2.1.13",
    "@tiptap/starter-kit": "^2.1.13",
    "konva": "^9.3.0",
    "lucide-react": "^0.263.1",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-konva": "^18.2.10",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@vitejs/plugin-react": "^4.2.1",
    "rimraf": "^5.0.0",
    "typescript": "^5.3.3",
    "vite": "^7.3.1"
  }
}
EOF

echo -e "${GREEN}✓ package.json обновлён (без Electron)${NC}"

# Шаг 4: Обновление vite.config.ts
echo -e "${YELLOW}[4/5] Обновление vite.config.ts...${NC}"

cat > "$WEB_PATH/vite.config.ts" << 'EOF'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://31.192.110.121:3001',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          konva: ['konva', 'react-konva']
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});
EOF

echo -e "${GREEN}✓ vite.config.ts обновлён (browser-only)${NC}"

# Шаг 5: Обновление index.html
echo -e "${YELLOW}[5/5] Обновление index.html...${NC}"

cat > "$WEB_PATH/index.html" << 'EOF'
<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Kiosk Content Editor - Create interactive kiosk content" />
    <title>Kiosk Editor</title>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        overflow: hidden;
      }
      
      #root {
        width: 100vw;
        height: 100vh;
      }
      
      /* Loading screen */
      .loading-screen {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
        background: #1e1e1e;
        color: #fff;
      }
      
      .loading-spinner {
        border: 4px solid rgba(255, 255, 255, 0.1);
        border-left-color: #4a90e2;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        animation: spin 1s linear infinite;
      }
      
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    </style>
  </head>
  <body>
    <div id="root">
      <div class="loading-screen">
        <div class="loading-spinner"></div>
      </div>
    </div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
EOF

echo -e "${GREEN}✓ index.html обновлён${NC}"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ ШАГ 1 ЗАВЕРШЁН                                                 ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📁 Создана директория:${NC} $WEB_PATH"
echo -e "${BLUE}🗑️  Удалены:${NC} electron/, main.cjs, preload.cjs"
echo -e "${BLUE}📝 Обновлены:${NC} package.json, vite.config.ts, index.html"
echo ""
echo -e "${YELLOW}➡️  Следующий шаг: Создание нового API клиента${NC}"
echo ""
