#!/bin/bash

# ============================================================
# Автоматическое исправление загрузки видео в PropertiesPanel
# Проблема: Out of Memory при загрузке больших видеофайлов
# Решение: Загрузка на сервер через API вместо base64
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

FILE="src/components/PropertiesPanel.tsx"

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Исправление загрузки видео${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

if [ ! -f "$FILE" ]; then
  echo -e "${RED}✗${NC} Файл не найден: $FILE"
  echo "Запустите скрипт из директории: packages/editor-web"
  exit 1
fi

# Создаём backup
BACKUP="${FILE}.backup.video_$(date +%Y%m%d_%H%M%S)"
cp "$FILE" "$BACKUP"
echo -e "${GREEN}✓${NC} Backup создан: $BACKUP"
echo ""

# Добавляем импорт apiClient если его нет
if ! grep -q "import { apiClient }" "$FILE"; then
  echo -e "${YELLOW}→${NC} Добавляем импорт apiClient..."
  sed -i "/import React from 'react';/a import { apiClient } from '../services/api-client';" "$FILE"
  echo -e "${GREEN}✓${NC} Импорт добавлен"
fi

# Создаём временный файл с исправленной версией обработчика загрузки видео
cat > /tmp/video_fix.txt << 'HANDLER_END'
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          // Проверка размера
                          const maxSize = 500 * 1024 * 1024; // 500 MB
                          if (file.size > maxSize) {
                            alert('⚠️ Файл слишком большой! Максимум 500 MB');
                            e.target.value = '';
                            return;
                          }
                          
                          try {
                            console.log(`⏳ Загрузка видео (${(file.size / (1024 * 1024)).toFixed(1)} MB)...`);
                            
                            if (!project?.id) {
                              alert('❌ Сначала создайте или откройте проект');
                              e.target.value = '';
                              return;
                            }
                            
                            // Загружаем на сервер вместо base64
                            const result = await apiClient.uploadFile(project.id, file);
                            
                            if (result) {
                              updateWidget(selectedWidget.id, {
                                properties: {
                                  ...selectedWidget.properties,
                                  src: result.url,
                                  isLocalFile: false,
                                  fileName: file.name
                                }
                              });
                              alert('✅ Видео загружено на сервер!');
                            }
                          } catch (error: any) {
                            console.error('Upload error:', error);
                            alert('❌ Ошибка загрузки: ' + error.message);
                          }
                          
                          e.target.value = '';
                        }
                      }}
HANDLER_END

# Находим и заменяем блок загрузки видео
echo -e "${YELLOW}→${NC} Ищем блок загрузки видео..."

# Используем Python для более надежной замены
python3 << 'PYTHON_END'
import re

# Читаем файл
with open('src/components/PropertiesPanel.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Читаем новый обработчик
with open('/tmp/video_fix.txt', 'r', encoding='utf-8') as f:
    new_handler = f.read()

# Паттерн для поиска старого обработчика видео
# Ищем блок с accept="video/*" и FileReader
pattern = r'(accept="video/\*"\s+onChange=\{)\(e\) => \{[^}]*const file = e\.target\.files\?\.\[0\];[^}]*if \(file\) \{[^}]*const reader = new FileReader\(\);[^}]*reader\.onload[^}]*reader\.readAsDataURL\(file\);[^}]*\}[^}]*e\.target\.value = \'\';[^}]*\}\}'

# Пробуем найти паттерн
match = re.search(pattern, content, re.DOTALL)

if match:
    # Заменяем найденный блок
    replacement = match.group(1) + new_handler.strip() + '}'
    content = content[:match.start()] + replacement + content[match.end():]
    
    with open('src/components/PropertiesPanel.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("✓ Блок загрузки видео успешно заменен")
    exit(0)
else:
    print("✗ Не найден блок загрузки видео FileReader")
    print("Попробуем альтернативный метод...")
    exit(1)
PYTHON_END

PYTHON_RESULT=$?

if [ $PYTHON_RESULT -eq 0 ]; then
  echo -e "${GREEN}✓${NC} Исправление применено успешно!"
else
  echo -e "${YELLOW}⚠${NC} Автоматическое исправление не удалось"
  echo ""
  echo "Примените исправление вручную:"
  echo "1. Откройте: nano $FILE"
  echo "2. Найдите строку: accept=\"video/*\""
  echo "3. Замените весь блок onChange на содержимое: /tmp/video_fix.txt"
  echo ""
  cat /tmp/video_fix.txt
  exit 1
fi

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${GREEN}✅ ГОТОВО!${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo "Теперь пересоберите проект:"
echo "  npm run build"
echo ""
echo "И задеплойте:"
echo "  sudo cp -r dist/* /opt/kiosk/editor-web/"
echo "  sudo systemctl reload nginx"
echo ""
