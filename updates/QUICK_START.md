# ⚡ Быстрый старт Phase 2.2

## 📥 Шаг 1: Скачайте файлы
Скачайте архив `phase2.2_files.tar.gz` из чата

## 📤 Шаг 2: Загрузите на сервер
```bash
scp phase2.2_files.tar.gz root@31.192.110.121:/tmp/
```

## 🗂️ Шаг 3: Распакуйте
```bash
ssh root@31.192.110.121
cd /tmp
tar -xzf phase2.2_files.tar.gz
cd phase2.2_files
```

## 📋 Шаг 4: Копируйте файлы

```bash
# Создать директории
mkdir -p /opt/kiosk/kiosk-content-platform/packages/editor-web/src/pages
mkdir -p /opt/kiosk/kiosk-content-platform/packages/editor-web/src/hooks
mkdir -p /opt/kiosk/kiosk-content-platform/packages/editor-web/src/utils

# Копировать новые файлы
cp new_files/logger.ts /opt/kiosk/kiosk-content-platform/packages/editor-web/src/utils/
cp new_files/useActivityTimeout.ts /opt/kiosk/kiosk-content-platform/packages/editor-web/src/hooks/
cp new_files/ProtectedRoute.tsx /opt/kiosk/kiosk-content-platform/packages/editor-web/src/components/
cp new_files/LoginPage.tsx new_files/LoginPage.css new_files/EditorPage.tsx new_files/EditorPage.css /opt/kiosk/kiosk-content-platform/packages/editor-web/src/pages/

# Копировать обновлённые файлы
cp new_files/package.json /opt/kiosk/kiosk-content-platform/packages/editor-web/
cp new_files/App.tsx /opt/kiosk/kiosk-content-platform/packages/editor-web/src/
cp new_files/api-client.ts /opt/kiosk/kiosk-content-platform/packages/editor-web/src/services/
cp new_files/Toolbar.tsx /opt/kiosk/kiosk-content-platform/packages/editor-web/src/components/
```

## 🔧 Шаг 5: Установите зависимости
```bash
cd /opt/kiosk/kiosk-content-platform/packages/editor-web
npm install
```

## 🗑️ Шаг 6: Отключите старые файлы
```bash
cd /opt/kiosk/kiosk-content-platform/packages/editor-web/src/components
mv LoginDialog.tsx LoginDialog.tsx.disabled
mv LoginDialog.css LoginDialog.css.disabled
```

## 🏗️ Шаг 7: Build и Deploy
```bash
cd /opt/kiosk/kiosk-content-platform/packages/editor-web
npm run build
rm -rf /opt/kiosk/editor-web/*
cp -r dist/* /opt/kiosk/editor-web/
systemctl reload nginx
```

## ✅ Шаг 8: Проверка
Откройте http://31.192.110.121:8080
- Должна появиться страница авторизации
- Введите ключ: `3VBN-8ZQ9-1MKO-AK0R`
- После входа откроется редактор

## 📚 Полная документация
Смотрите файл `PHASE_2.2_INSTALLATION.md` для детальной информации.

---

**Время установки:** ~10 минут  
**Сложность:** Средняя  
**Требуется backup:** Да (автоматически)
