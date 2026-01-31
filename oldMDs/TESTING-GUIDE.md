# 🧪 Testing Guide - Kiosk Content Platform v3.0

## 📋 Обзор

Полное руководство по тестированию всех компонентов системы:
- ✅ Backend Server (REST API + WebSocket)
- ✅ Editor (UI + API Integration)
- ✅ Player (WebSocket Client + Deployment)

---

## 🚀 Быстрый старт

### 1. Подготовка

```bash
# Убедитесь что сервер запущен
sudo systemctl status kiosk-server

# Или запустите вручную
cd /opt/kiosk/kiosk-content-platform/packages/server
npm start

# Проверьте доступность
curl http://localhost:3001/api/health
```

### 2. Базовые тесты

```bash
cd /opt/kiosk/kiosk-content-platform/packages/server

# Сделайте скрипты исполняемыми
chmod +x test-server.sh
chmod +x test-websocket.js
chmod +x generate-test-data.sh
chmod +x e2e-test.sh

# Запустите базовые тесты API
./test-server.sh

# Запустите WebSocket тесты
node test-websocket.js

# Создайте тестовые данные
./generate-test-data.sh

# Запустите полный E2E тест
./e2e-test.sh
```

---

## 🔬 Тесты по компонентам

### A. Backend Server Tests

#### 1. API Tests (test-server.sh)

```bash
./test-server.sh

Тестирует:
✓ Health check (GET /api/health)
✓ Templates CRUD
  - Create template (POST /api/templates)
  - Get template (GET /api/templates/:id)
  - List templates (GET /api/templates)
  - Update template (PUT /api/templates/:id)
  - Delete template (DELETE /api/templates/:id)
✓ Devices API
  - Register device (POST /api/devices/register)
  - Get device (GET /api/devices/:id)
  - List devices (GET /api/devices)
  - Update device (PUT /api/devices/:id)
  - Delete device (DELETE /api/devices/:id)
✓ Media API
  - List media (GET /api/media)
```

**Ожидаемый результат:**
```
Total tests:  18
Passed:       18
Failed:       0
✅ All tests passed!
```

#### 2. WebSocket Tests (test-websocket.js)

```bash
node test-websocket.js

Тестирует:
✓ WebSocket connection
✓ Device registration
✓ Heartbeat mechanism (3 cycles)
✓ Log message sending
✓ Message reception
```

**Ожидаемый результат:**
```
[WebSocket] Connecting to ws://localhost:3001
[WebSocket] Connected!
[WebSocket] Registering device...
[WebSocket] Device registered
[WebSocket] Heartbeat 1/3
[WebSocket] Heartbeat 2/3
[WebSocket] Heartbeat 3/3
✅ All WebSocket tests passed!
```

#### 3. E2E Integration Test (e2e-test.sh)

```bash
./e2e-test.sh

Тестирует:
Part 1: Server Tests (8 tests)
Part 2: API Integration (6 tests)
Part 3: Data Validation (4 tests)
Part 4: Cleanup (2 tests)

Total: 20 tests
```

**Ожидаемый результат:**
```
Total tests: 20
Passed: 20
Failed: 0
✅ All tests passed!
```

---

### B. Editor Integration Tests

#### 1. Manual UI Tests

**Тест 1: Server Connection**
```
1. Запустите Editor: cd packages/editor && npm run dev
2. Откройте http://localhost:5173
3. Нажмите кнопку "Server" в Toolbar
4. Включите "Enable Server Integration"
5. Укажите URL: http://localhost:3001
6. Нажмите "Save & Connect"

✓ Ожидаемое: Индикатор показывает "Connected"
✓ Версия сервера отображается
✓ Нет ошибок в консоли
```

**Тест 2: Templates Library**
```
1. Нажмите кнопку 📋 в Toolbar
2. Проверьте загрузку шаблонов

✓ Ожидаемое: Список шаблонов отображается
✓ Есть карточки с названиями и описаниями
✓ Есть кнопка "Save Current as Template"

3. Создайте простой проект
4. Нажмите "Save Current as Template"
5. Введите название: "My Test Template"
6. Введите описание: "Test description"

✓ Ожидаемое: Шаблон создан
✓ Появился в списке
✓ Можно загрузить обратно

7. Кликните на шаблон для загрузки
8. Подтвердите загрузку

✓ Ожидаемое: Проект загружен
✓ Все виджеты отображаются
```

**Тест 3: Media Library**
```
1. Нажмите кнопку 🖼️ в Toolbar
2. Нажмите "Upload Files"
3. Выберите изображение (JPG/PNG)

✓ Ожидаемое: Файл загружен
✓ Превью отображается
✓ Размер файла показан

4. Кликните на изображение
5. Скопируйте URL
6. Добавьте Image Widget в проект
7. Вставьте URL

✓ Ожидаемое: Изображение отображается
```

**Тест 4: Device Manager**
```
Предварительно: Запустите Player (см. Player Tests)

1. Нажмите кнопку 📱 в Toolbar
2. Проверьте список устройств

✓ Ожидаемое: Устройства отображаются
✓ Статус "online" для запущенных
✓ Last Seen обновляется

3. Создайте простой проект
4. Выберите устройство (online)
5. Нажмите 🚀 Deploy

✓ Ожидаемое: "Project deployed successfully"
✓ В Player проект отобразился
```

#### 2. Console Tests

```javascript
// Откройте DevTools Console в Editor

// Тест 1: Проверка API Client
console.log(localStorage.getItem('kiosk-server-settings'));
// Должен показать конфигурацию

// Тест 2: Проверка подключения
// Network → WS → должен быть активный WebSocket

// Тест 3: Проверка запросов
// Network → Fetch/XHR → должны быть запросы к /api/*
```

---

### C. Player Integration Tests

#### 1. Manual Player Tests

**Тест 1: Server Connection**
```
1. Запустите Player: cd packages/player && npm run electron:dev
2. Откройте Settings (добавьте UI кнопку)
3. Включите "Enable Server Integration"
4. Укажите URL: ws://localhost:3001
5. Укажите Device Name: "Test Player 1"
6. Нажмите "Test Connection"

✓ Ожидаемое: "Connection successful"
✓ Индикатор показывает "Connected"

7. Нажмите "Save"

✓ Ожидаемое: Settings сохранены
✓ Player переподключился
```

**Тест 2: Device Registration**
```
После подключения Player:

1. Откройте Editor → Device Manager
2. Проверьте список устройств

✓ Ожидаемое: "Test Player 1" в списке
✓ Статус: online
✓ Last Seen: "Just now"

3. Подождите 30 секунд

✓ Ожидаемое: Last Seen обновляется (heartbeat)
```

**Тест 3: Project Deployment**
```
1. В Editor создайте проект:
   - Добавьте Text widget
   - Текст: "Deployment Test"
   - Фон: красный

2. Откройте Device Manager
3. Выберите "Test Player 1"
4. Нажмите 🚀 Deploy

✓ Ожидаемое: В Editor: "Project deployed"
✓ В Player: Проект автоматически загрузился
✓ Отображается "Deployment Test" на красном фоне
✓ Показано уведомление в Player

5. Проверьте логи:
   - В Editor → Device Manager → 📋 View Logs

✓ Ожидаемое: "Project deployed successfully" в логах
```

**Тест 4: Multiple Deployments**
```
1. Измените проект (например, синий фон)
2. Deploy снова

✓ Ожидаемое: Player автоматически обновился
✓ Фон стал синим

3. Добавьте Image widget
4. Deploy

✓ Ожидаемое: Изображение отображается
```

#### 2. Console Tests (Player)

```javascript
// Откройте DevTools в Electron Player

// Тест 1: Проверка конфигурации
console.log(localStorage.getItem('kiosk-player-server-config'));
// Должен показать: {url, enabled, deviceId, deviceName}

// Тест 2: Device ID
console.log(localStorage.getItem('kiosk-device-id'));
// Должен быть UUID

// Тест 3: WebSocket
// DevTools → Network → WS
// Должен быть активный ws://localhost:3001
// Messages: register, heartbeat (каждые 30 сек)
```

---

## 🔄 Сценарии полного цикла

### Сценарий 1: От шаблона до развертывания

```
1. Сервер: Запущен и работает
2. Editor: Подключен к серверу
3. Player: Подключен к серверу

Шаги:
A. В Editor → Templates → Load "Welcome Screen"
B. Редактировать текст на "Hello Production!"
C. Save as Template → "Production Welcome"
D. Device Manager → Deploy to Player

Проверка:
✓ Player показывает "Hello Production!"
✓ Template сохранен на сервере
✓ Логи зафиксировали развертывание
```

### Сценарий 2: Централизованное медиа

```
1. Editor → Media Library → Upload logo.png
2. Создать проект с Image widget
3. Использовать URL загруженного logo
4. Deploy to Player 1
5. Deploy to Player 2

Проверка:
✓ Оба Player показывают один logo
✓ URL один и тот же
✓ Медиа на сервере доступно всем
```

### Сценарий 3: Множественное развертывание

```
1. Запустить 3 Player экземпляра
2. Все подключаются к серверу
3. В Device Manager видны 3 устройства
4. Создать проект
5. Deploy на все 3 устройства

Проверка:
✓ Все 3 Player получили проект
✓ Все показывают одинаковый контент
✓ Heartbeat работает для всех
```

---

## 🐛 Проблемы и решения

### Проблема 1: Тесты не проходят

```bash
# Проверьте сервер
sudo systemctl status kiosk-server
curl http://localhost:3001/api/health

# Проверьте порт
sudo netstat -tlnp | grep 3001

# Проверьте логи
sudo journalctl -u kiosk-server -n 50

# Перезапустите
sudo systemctl restart kiosk-server
```

### Проблема 2: Editor не подключается

```bash
# Проверьте URL (http://)
# Проверьте CORS в server .env
CORS_ORIGIN=*

# Проверьте firewall
sudo ufw status

# Проверьте DevTools Console
```

### Проблема 3: Player не регистрируется

```bash
# Проверьте URL (ws:// не http://)
# Проверьте WebSocket в DevTools
# Проверьте логи сервера
sudo journalctl -u kiosk-server -f

# Проверьте конфигурацию Player
localStorage.getItem('kiosk-player-server-config')
```

### Проблема 4: Проекты не приходят

```bash
# Проверьте что устройство online
curl http://localhost:3001/api/devices

# Проверьте WebSocket соединение
# DevTools → Network → WS → Messages

# Проверьте события
# Должно быть: deployment:start

# Проверьте логи сервера
sudo journalctl -u kiosk-server | grep deployment
```

---

## 📊 Метрики успеха

### Backend Server
- ✅ All API tests pass (18/18)
- ✅ WebSocket tests pass
- ✅ E2E tests pass (20/20)
- ✅ Response time < 100ms
- ✅ No errors in logs

### Editor Integration
- ✅ Server connection works
- ✅ Templates load/save
- ✅ Media upload works
- ✅ Device Manager shows devices
- ✅ Deployment succeeds

### Player Integration
- ✅ WebSocket connects
- ✅ Device registers
- ✅ Heartbeat works (30s)
- ✅ Projects received
- ✅ Logs sent to server

---

## ✅ Финальный чеклист

Перед production развертыванием:

Backend:
- [ ] All tests pass
- [ ] SSL configured (wss://)
- [ ] Firewall configured
- [ ] Backups configured
- [ ] Monitoring configured
- [ ] JWT secret changed
- [ ] CORS restricted

Editor:
- [ ] Server URL configured
- [ ] Templates load
- [ ] Media upload works
- [ ] Device Manager works
- [ ] Deployment succeeds

Player:
- [ ] WebSocket connects
- [ ] Device registers
- [ ] Projects received
- [ ] Auto-start configured
- [ ] Kiosk mode enabled

---

## 🎉 Готово!

Если все тесты прошли успешно:

**Версия:** 3.0.0  
**Статус:** ✅ Ready for Production  
**Дата:** Декабрь 2025

Система полностью протестирована и готова к использованию!
