# 🚀 Быстрая инструкция по деплою

## 📦 Файлы в архиве:

```
editor-web-migration.tar.gz содержит:
├── 01_prepare_editor_web.sh        # Скрипт подготовки
├── 02_deploy_editor_web.sh         # Скрипт деплоя
├── api-client.ts                   # API клиент
├── editorStore.ts                  # Store с автосохранением
├── LoginDialog.tsx                 # Компонент входа
├── LoginDialog.css                 # Стили входа
├── AutoSaveIndicator.tsx           # Индикатор сохранения
├── AutoSaveIndicator.css           # Стили индикатора
├── Toolbar.tsx                     # Обновлённый Toolbar
├── Toolbar.css                     # Стили Toolbar
└── README_DEPLOY.md                # Полная документация
```

---

## ⚡ Быстрый старт (30 минут):

### ШАГ 1: Загрузка на сервер

```bash
# Скачай архив editor-web-migration.tar.gz
# Загрузи на сервер
scp editor-web-migration.tar.gz root@31.192.110.121:/tmp/

# Подключись
ssh root@31.192.110.121

# Распакуй
cd /tmp
tar -xzf editor-web-migration.tar.gz
```

---

### ШАГ 2: Подготовка структуры (5 минут)

```bash
# Выполни скрипт подготовки
chmod +x 01_prepare_editor_web.sh
./01_prepare_editor_web.sh
```

**Результат:**
- ✅ Создана директория `/opt/kiosk/kiosk-content-platform/packages/editor-web`
- ✅ Удалены Electron файлы
- ✅ Обновлены конфигурации

---

### ШАГ 3: Копирование новых файлов (5 минут)

```bash
# Перейди в директорию с распакованными файлами
cd /tmp

# Создай директории если не существуют
mkdir -p /opt/kiosk/kiosk-content-platform/packages/editor-web/src/services
mkdir -p /opt/kiosk/kiosk-content-platform/packages/editor-web/src/stores
mkdir -p /opt/kiosk/kiosk-content-platform/packages/editor-web/src/components

# Скопируй API клиент
cp api-client.ts /opt/kiosk/kiosk-content-platform/packages/editor-web/src/services/

# Скопируй Store
cp editorStore.ts /opt/kiosk/kiosk-content-platform/packages/editor-web/src/stores/

# Скопируй компоненты (TSX + CSS)
cp LoginDialog.tsx LoginDialog.css \
   AutoSaveIndicator.tsx AutoSaveIndicator.css \
   Toolbar.tsx Toolbar.css \
   /opt/kiosk/kiosk-content-platform/packages/editor-web/src/components/

# Проверь что файлы скопированы
ls -la /opt/kiosk/kiosk-content-platform/packages/editor-web/src/services/
ls -la /opt/kiosk/kiosk-content-platform/packages/editor-web/src/stores/
ls -la /opt/kiosk/kiosk-content-platform/packages/editor-web/src/components/ | grep -E "(LoginDialog|AutoSave|Toolbar)"
```

**Должны увидеть:**
```
services/api-client.ts
stores/editorStore.ts
components/LoginDialog.tsx
components/LoginDialog.css
components/AutoSaveIndicator.tsx
components/AutoSaveIndicator.css
components/Toolbar.tsx
components/Toolbar.css
```

---

### ШАГ 4: Деплой на production (15 минут)

```bash
# Выполни скрипт деплоя
chmod +x 02_deploy_editor_web.sh
sudo ./02_deploy_editor_web.sh
```

**Что делает скрипт:**
1. Устанавливает npm зависимости
2. Собирает production build
3. Копирует в `/opt/kiosk/editor-web/`
4. Настраивает Nginx (порт 8080)
5. Перезагружает Nginx
6. Проверяет работоспособность

**Результат:**
```
✅ Build завершён
✅ Файлы скопированы
✅ Nginx настроен
✅ HTTP check passed (200 OK)

📍 URLs:
   Local:    http://localhost:8080
   External: http://31.192.110.121:8080
```

---

## 🧪 Проверка работы:

### 1. Открой в браузере

```
http://31.192.110.121:8080
```

### 2. Тест входа

- Должен появиться диалог "Вход в Kiosk Editor"
- Введи тестовый ключ: **3VBN-8ZQ9-1MKO-AK0R** (PRO)
- Нажми "Войти"

### 3. После успешного входа

- ✅ В Toolbar: "👤 Test Organization | PRO"
- ✅ Редактор доступен
- ✅ Индикатор: "Сохранено ..."

### 4. Тест автосохранения

- Добавь виджет (например, кнопку)
- Подожди 10 секунд
- Индикатор покажет: "Сохранение..." → "Сохранено X сек назад"

---

## 🔧 Troubleshooting:

### Проблема: "Failed to fetch"

```bash
# Проверь License Server
curl http://localhost:3001/health

# Должен вернуть:
# {"status":"ok","message":"Kiosk License Server is running",...}
```

### Проблема: "Invalid license"

```bash
# Используй тестовые ключи:
# BASIC: EWZA-E5LJ-Z558-9LUQ
# PRO:   3VBN-8ZQ9-1MKO-AK0R  ← Рекомендуется
# MAX:   T8MH-FJE3-ETAC-YOZF
```

### Проблема: Белый экран

```bash
# Открой консоль браузера (F12)
# Проверь ошибки в Console

# Проверь логи Nginx
tail -f /var/log/nginx/editor-web.error.log
```

### Проблема: Файл не найден

```bash
# Проверь что все файлы на месте:
ls -la /opt/kiosk/kiosk-content-platform/packages/editor-web/src/services/api-client.ts
ls -la /opt/kiosk/kiosk-content-platform/packages/editor-web/src/stores/editorStore.ts
ls -la /opt/kiosk/kiosk-content-platform/packages/editor-web/src/components/LoginDialog.*
ls -la /opt/kiosk/kiosk-content-platform/packages/editor-web/src/components/AutoSaveIndicator.*
ls -la /opt/kiosk/kiosk-content-platform/packages/editor-web/src/components/Toolbar.*

# Если какой-то файл отсутствует - скопируй заново из /tmp
```

---

## 📚 Полная документация

Смотри **README_DEPLOY.md** для:
- Подробной архитектуры
- API эндпоинтов
- Настройки безопасности
- Расширенного troubleshooting
- Чеклиста тестирования

---

## ✅ Итого:

**Файлы созданы:** 11  
**Строки кода:** ~2500  
**Время деплоя:** ~30 минут  

**Результат:**
- ✅ Web-версия Editor на порту 8080
- ✅ JWT аутентификация
- ✅ Автосохранение каждые 3 минуты
- ✅ Production-ready

---

**Удачи! 🚀**
