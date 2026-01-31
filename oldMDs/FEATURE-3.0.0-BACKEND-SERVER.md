# 🎉 KIOSK CONTENT PLATFORM v3.0 - Backend Server

## 🚀 Что реализовано

### ✅ Централизованный Backend Server

**Технологии:**
- Node.js + Express
- SQLite база данных
- WebSocket (ws)
- Multer для загрузки файлов
- CORS, JWT

**Возможности:**
1. 📋 **Библиотека шаблонов** - сохранение и переиспользование проектов
2. 🖼️ **Медиа-библиотека** - централизованное хранилище файлов
3. 📱 **Управление устройствами** - мониторинг и удалённое управление плеерами

---

## 📦 Структура проекта

```
kiosk-content-platform/
├── packages/
│   ├── editor/          # React редактор (существующий)
│   ├── player/          # Electron плеер (существующий)
│   └── server/          # Backend сервер (НОВЫЙ! ✨)
│       ├── src/
│       │   ├── database/
│       │   │   └── db.js
│       │   ├── routes/
│       │   │   ├── templates.js
│       │   │   ├── media.js
│       │   │   └── devices.js
│       │   └── index.js
│       ├── data/        # Создаётся автоматически
│       │   ├── kiosk.db
│       │   └── media/
│       ├── package.json
│       ├── .env.example
│       ├── .gitignore
│       └── README.md
```

---

## 🗄️ База данных (SQLite)

### Таблицы:

**1. templates** - Шаблоны проектов
```sql
id, name, description, thumbnail, data (JSON), 
category, tags (JSON), created_at, updated_at
```

**2. media** - Медиа-библиотека
```sql
id, name, type, file_path, file_size, mime_type,
width, height, duration, thumbnail, tags (JSON), created_at
```

**3. devices** - Устройства
```sql
id, name, type, os, version, ip_address, status,
last_seen, current_project_id, settings (JSON),
created_at, updated_at
```

**4. device_logs** - Логи устройств
```sql
id, device_id, level, message, data (JSON), timestamp
```

**5. deployment_tasks** - Задачи деплоя
```sql
id, project_id, project_name, device_id, status,
progress, error, created_at, completed_at
```

---

## 📡 REST API

### Templates (Шаблоны)

```
GET    /api/templates           # Список шаблонов
GET    /api/templates/:id       # Получить шаблон
POST   /api/templates           # Создать шаблон
PUT    /api/templates/:id       # Обновить шаблон
DELETE /api/templates/:id       # Удалить шаблон
```

**Пример использования:**

```javascript
// Сохранить проект как шаблон
const response = await fetch('http://localhost:3001/api/templates', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Retail Display',
    description: 'Template for retail stores',
    category: 'retail',
    tags: ['shop', 'product'],
    data: projectData  // JSON проекта
  })
});
```

---

### Media (Медиа)

```
GET    /api/media               # Список медиа
POST   /api/media/upload        # Загрузить файл
GET    /api/media/:id           # Получить медиа
DELETE /api/media/:id           # Удалить медиа
```

**Пример использования:**

```javascript
// Загрузить изображение
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('name', 'Logo');
formData.append('tags', JSON.stringify(['brand', 'logo']));

const response = await fetch('http://localhost:3001/api/media/upload', {
  method: 'POST',
  body: formData
});

const { data } = await response.json();
console.log('Media URL:', data.url);  // /media/uuid.png
```

---

### Devices (Устройства)

```
GET    /api/devices             # Список устройств
POST   /api/devices/register    # Регистрация устройства
GET    /api/devices/:id         # Получить устройство
PUT    /api/devices/:id         # Обновить устройство
DELETE /api/devices/:id         # Удалить устройство
GET    /api/devices/:id/logs    # Логи устройства
POST   /api/devices/:id/deploy  # Отправить проект
GET    /api/devices/:id/deploy/:taskId  # Статус деплоя
```

**Пример использования:**

```javascript
// Отправить проект на устройство
const response = await fetch('http://localhost:3001/api/devices/device-uuid/deploy', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    projectId: 'project-uuid',
    projectName: 'Retail Display',
    projectData: projectJSON
  })
});

const { data } = await response.json();
console.log('Task ID:', data.taskId);
```

---

## 🔌 WebSocket Protocol

### Подключение:

```javascript
const ws = new WebSocket('ws://localhost:3001');
```

### События от Player → Server:

**1. Регистрация:**
```json
{
  "type": "device:register",
  "deviceId": "uuid",
  "name": "Kiosk-01",
  "os": "Windows 11",
  "version": "3.0.0",
  "ipAddress": "192.168.1.100"
}
```

**2. Heartbeat (каждые 30 сек):**
```json
{
  "type": "device:heartbeat",
  "deviceId": "uuid"
}
```

**3. Логи:**
```json
{
  "type": "device:log",
  "deviceId": "uuid",
  "level": "info",
  "message": "Player started",
  "logData": {}
}
```

### События от Server → All Clients (broadcast):

**1. Устройство подключилось:**
```json
{
  "type": "device:connected",
  "deviceId": "uuid",
  "name": "Kiosk-01",
  "status": "online"
}
```

**2. Устройство отключилось:**
```json
{
  "type": "device:disconnected",
  "deviceId": "uuid"
}
```

**3. Деплой проекта:**
```json
{
  "type": "deployment:start",
  "taskId": "uuid",
  "deviceId": "uuid",
  "projectData": { /* JSON */ }
}
```

---

## 🚀 Быстрый старт

### 1. Установка:

```bash
cd packages/server
npm install
```

### 2. Настройка:

```bash
cp .env.example .env
```

Отредактируйте `.env`:
```env
PORT=3001
HOST=0.0.0.0
DATABASE_PATH=./data/kiosk.db
MEDIA_PATH=./data/media
JWT_SECRET=change-me-in-production
CORS_ORIGIN=http://localhost:5173
```

### 3. Запуск:

```bash
# Development
npm run dev

# Production
npm start
```

Сервер доступен на: `http://localhost:3001`

---

## 🧪 Тестирование API

### Health Check:

```bash
curl http://localhost:3001/api/health
```

**Response:**
```json
{
  "status": "ok",
  "version": "3.0.0",
  "uptime": 123.45
}
```

### Список шаблонов:

```bash
curl http://localhost:3001/api/templates
```

### Список устройств:

```bash
curl http://localhost:3001/api/devices
```

### Загрузить медиа:

```bash
curl -X POST http://localhost:3001/api/media/upload \
  -F "file=@image.jpg" \
  -F "name=My Image"
```

---

## 📊 Мониторинг

### Консоль сервера:

```
╔═══════════════════════════════════════════════╗
║   🚀 KIOSK CONTENT PLATFORM SERVER v3.0      ║
╚═══════════════════════════════════════════════╝

📡 Server running on: http://0.0.0.0:3001
🗄️  Database: ./data/kiosk.db
📁 Media path: ./data/media

✅ Database initialized successfully
📱 New WebSocket connection
✅ Device registered: Kiosk-01 (uuid)
📱 Device uuid disconnected
```

---

## 🔄 Workflow

### Сценарий 1: Сохранение шаблона

```
Editor → POST /api/templates → Server → SQLite
         (project JSON)
```

### Сценарий 2: Загрузка медиа

```
Editor → POST /api/media/upload → Server → File System
         (image file)                      → SQLite (metadata)
```

### Сценарий 3: Отправка проекта на устройство

```
Editor → POST /api/devices/:id/deploy → Server → WebSocket
         (project JSON)                           ↓
                                         Player (получает проект)
                                                  ↓
                                         Player загружает и запускает
```

---

## 🎯 Следующие шаги

### Этап 2: Интеграция с Editor

**Что нужно добавить в Editor:**

1. **UI компоненты:**
   - Библиотека шаблонов (Templates Library)
   - Медиа-библиотека (Media Library)
   - Менеджер устройств (Device Manager)

2. **API клиент:**
   - Класс для работы с REST API
   - WebSocket клиент для real-time обновлений

3. **Функции:**
   - Сохранить проект как шаблон
   - Загрузить медиа в библиотеку
   - Просмотр устройств
   - Отправка проекта на устройство

### Этап 3: Интеграция с Player

**Что нужно добавить в Player:**

1. **WebSocket клиент:**
   - Автоматическая регистрация при старте
   - Heartbeat каждые 30 сек
   - Отправка логов

2. **Приём проектов:**
   - Слушать `deployment:start` события
   - Загрузить проект
   - Запустить проект
   - Отправить статус

---

## 📚 Примеры кода

### Editor: Сохранить как шаблон

```typescript
async function saveAsTemplate(project: Project) {
  const response = await fetch('http://localhost:3001/api/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: project.name,
      description: 'My template',
      category: 'custom',
      tags: ['tag1'],
      data: project
    })
  });
  
  const result = await response.json();
  if (result.success) {
    console.log('Template saved:', result.data.id);
  }
}
```

### Player: Регистрация устройства

```typescript
const ws = new WebSocket('ws://localhost:3001');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'device:register',
    deviceId: getDeviceId(),
    name: 'Kiosk-01',
    os: 'Windows 11',
    version: '3.0.0',
    ipAddress: getLocalIP()
  }));
  
  // Heartbeat
  setInterval(() => {
    ws.send(JSON.stringify({
      type: 'device:heartbeat',
      deviceId: getDeviceId()
    }));
  }, 30000);
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'deployment:start') {
    loadProject(data.projectData);
  }
};
```

---

## ✅ Что готово

- ✅ Backend Server (Node.js + Express)
- ✅ SQLite база данных
- ✅ REST API (Templates, Media, Devices)
- ✅ WebSocket сервер
- ✅ Загрузка файлов (Multer)
- ✅ CORS настройка
- ✅ Автоинициализация БД
- ✅ Health check endpoint
- ✅ Логирование
- ✅ Документация API

---

## ⏳ TODO: Интеграция с Editor и Player

**Следующее сообщение:**
Хотите чтобы я реализовал интеграцию с Editor и Player?

Это включает:
1. UI компоненты в Editor (Templates Library, Media Library, Device Manager)
2. API клиент для Editor
3. WebSocket интеграцию в Player
4. Функции деплоя проектов

---

**Версия:** 3.0.0  
**Дата:** Декабрь 2025  
**Статус:** ✅ Backend Server готов

🎉 **Server работает! Готов к интеграции с Editor и Player!**
