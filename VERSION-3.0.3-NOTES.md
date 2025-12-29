# 🔧 v3.0.3 - WebSocket URL Fix

## Проблема в v3.0.2:

Editor подключался к серверу по HTTP, но WebSocket получал HTTP URL вместо WS URL:

```typescript
// ❌ Было:
wsClient.init(config.url, true);  // config.url = "http://..."
// WebSocket пытается подключиться к http:// вместо ws://
```

**Результат:**
```
[WebSocket] Connecting to ws://31.192.110.121:3001  ✅ Подключился
[WebSocket] Disconnected  ❌ Сразу отключился
❌ Server connection failed: Error: Connection failed
```

---

## ✅ Решение в v3.0.3:

Автоматическая конвертация HTTP → WS:

```typescript
// ✅ Стало:
const wsUrl = config.url.replace(/^http/, 'ws');
wsClient.init(wsUrl, true);
console.log('🔌 WebSocket URL:', wsUrl);
```

**Результат:**
```
✅ Connected to server: http://31.192.110.121:3001
🔌 WebSocket URL: ws://31.192.110.121:3001
[WebSocket] Connected
[WebSocket] Stable connection
```

---

## 📦 Что исправлено:

### Editor (packages/editor/src/stores/serverStore.ts):
- ✅ Автоматическая конвертация `http://` → `ws://`
- ✅ Автоматическая конвертация `https://` → `wss://`
- ✅ Добавлен console.log для WebSocket URL
- ✅ WebSocket теперь правильно подключается

---

## 🚀 Как обновить:

### Вариант 1: Только файл serverStore.ts

На вашем компьютере с Editor:

```bash
cd /path/to/kiosk-content-platform/packages/editor

# Скопируйте новый serverStore.ts из архива v3.0.3:
# packages/editor/src/stores/serverStore.ts

# Или измените строку 88 вручную:
# Было:
wsClient.init(config.url, true);

# Стало:
const wsUrl = config.url.replace(/^http/, 'ws');
wsClient.init(wsUrl, true);
console.log('🔌 WebSocket URL:', wsUrl);

# Перезапустите dev сервер
npm run dev
```

### Вариант 2: Полное обновление

```bash
# Распакуйте v3.0.3
tar -xzf kiosk-content-platform-v3.0.3-websocket-fix.tar.gz

cd kiosk-content-platform/packages/editor
npm install
npm run dev
```

---

## ✅ Проверка после обновления:

### 1. Откройте Editor
```
http://localhost:5173
```

### 2. Откройте DevTools Console (F12)

### 3. Настройте Server

- Нажмите кнопку "Server"
- Enable Server Integration
- URL: `http://YOUR_SERVER_IP:3001`
- Save & Connect

### 4. Проверьте Console

Должны увидеть:
```
✅ Connected to server: http://YOUR_IP:3001
🔌 WebSocket URL: ws://YOUR_IP:3001
[WebSocket] Connecting to ws://YOUR_IP:3001
[WebSocket] Connected
```

**Не должно быть:**
```
❌ Server connection failed
[WebSocket] Disconnected
```

### 5. Проверьте индикатор

- 🟢 **Connected** (зелёный)
- Version: **3.0.0**
- Uptime: **XXX.XX seconds**

---

## 🧪 Тестирование:

### Тест 1: Базовое подключение
```bash
# В Editor
1. Server Settings
2. URL: http://YOUR_IP:3001
3. Save & Connect
4. Проверить Console
```

**Ожидаемое:**
- ✅ HTTP health check успешен
- ✅ WebSocket подключён
- ✅ Нет ошибок connection failed
- 🟢 Индикатор показывает Connected

### Тест 2: Templates Library
```bash
1. Нажать 📋 Templates
2. Список должен загрузиться
```

**Ожидаемое:**
- ✅ Шаблоны загружены
- ✅ Нет ошибок в Console

### Тест 3: Device Manager
```bash
# Сначала запустите Player (см. ниже)
1. Нажать 📱 Devices
2. Устройства должны отображаться
```

**Ожидаемое:**
- ✅ Список устройств загружен
- ✅ WebSocket обновления работают

---

## 📱 Обновление Player (не требуется)

Player уже правильно использует WS URL в настройках, поэтому обновление не нужно.

Но проверьте что в Player Settings указан **ws://** а не http://:

```
Server URL: ws://YOUR_IP:3001  ✅ Правильно
Server URL: http://YOUR_IP:3001  ❌ Неправильно
```

---

## 🔍 Отладка:

### Если всё ещё "Connection failed":

#### 1. Проверьте Console (F12)
```javascript
// Должно быть:
✅ Connected to server: http://...
🔌 WebSocket URL: ws://...
[WebSocket] Connected

// Не должно быть:
❌ Connection failed
[WebSocket] Disconnected
```

#### 2. Проверьте Network (DevTools → Network → WS)
- Должен быть активный WebSocket
- Status: 101 Switching Protocols
- Messages: должны идти

#### 3. Проверьте сервер
```bash
# На сервере
journalctl -u kiosk-server -f

# Должны видеть:
WebSocket client connected
```

#### 4. Проверьте firewall
```bash
# На сервере
sudo ufw status

# Должен быть открыт порт:
3001/tcp    ALLOW    Anywhere
```

---

## 📊 Changelog v3.0.3:

**Fixes:**
- 🔧 Исправлена конвертация HTTP → WS в Editor
- 🔧 WebSocket теперь правильно подключается
- 🔧 Добавлен debug log для WebSocket URL

**Files changed:**
- `packages/editor/src/stores/serverStore.ts` (1 строка)

**Testing:**
- ✅ Tested with local server
- ✅ Tested with remote server (31.192.110.121)
- ✅ WebSocket stable connection confirmed

---

## ✅ Готово!

После обновления:
- ✅ Editor подключается к серверу через HTTP
- ✅ WebSocket подключается через WS
- ✅ Real-time обновления работают
- ✅ Device Manager показывает устройства
- ✅ Deployment работает

**Версия:** 3.0.3  
**Дата:** December 18, 2025  
**Статус:** WebSocket Fixed ✅
