# 🖥️ Kiosk Content Platform - Backend Server v3.0

Централизованный сервер для управления шаблонами, медиа и устройствами.

---

## 🚀 Быстрый старт

### 1. Установка зависимостей

```bash
cd packages/server
npm install
```

### 2. Настройка

Скопируйте `.env.example` в `.env`:

```bash
cp .env.example .env
```

Отредактируйте `.env`:

```env
PORT=3001
HOST=0.0.0.0
DATABASE_PATH=./data/kiosk.db
MEDIA_PATH=./data/media
JWT_SECRET=your-secret-key-change-in-production
CORS_ORIGIN=http://localhost:5173
```

### 3. Запуск

```bash
# Development (с автоперезагрузкой)
npm run dev

# Production
npm start
```

Сервер запустится на `http://localhost:3001`

---

## 📡 API Endpoints

### Health Check

```
GET /api/health
```

**Response:**
```json
{
  "status": "ok",
  "version": "3.0.0",
  "uptime": 123.45,
  "timestamp": "2025-12-12T20:00:00.000Z"
}
```

---

### 📋 Templates API

#### Получить все шаблоны

```
GET /api/templates
Query: ?category=retail&search=menu
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Retail Display",
      "description": "Template for retail stores",
      "category": "retail",
      "tags": ["shop", "product"],
      "thumbnail": "...",
      "data": { /* project JSON */ },
      "created_at": "2025-12-12T20:00:00.000Z",
      "updated_at": "2025-12-12T20:00:00.000Z"
    }
  ]
}
```

#### Создать шаблон

```
POST /api/templates
Content-Type: application/json
```

**Body:**
```json
{
  "name": "My Template",
  "description": "Description",
  "category": "general",
  "tags": ["tag1", "tag2"],
  "data": { /* project JSON */ }
}
```

#### Обновить шаблон

```
PUT /api/templates/:id
```

#### Удалить шаблон

```
DELETE /api/templates/:id
```

---

### 🖼️ Media API

#### Получить все медиа

```
GET /api/media
Query: ?type=image&search=logo
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "logo.png",
      "type": "image",
      "file_size": 123456,
      "mime_type": "image/png",
      "width": 1920,
      "height": 1080,
      "url": "/media/uuid.png",
      "tags": ["logo", "brand"],
      "created_at": "2025-12-12T20:00:00.000Z"
    }
  ]
}
```

#### Загрузить медиа

```
POST /api/media/upload
Content-Type: multipart/form-data
```

**Form Data:**
- `file`: File (required)
- `name`: String (optional)
- `tags`: JSON string (optional)

#### Удалить медиа

```
DELETE /api/media/:id
```

---

### 📱 Devices API

#### Получить все устройства

```
GET /api/devices
Query: ?status=online
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Kiosk-01",
      "type": "player",
      "os": "Windows 11",
      "version": "3.0.0",
      "ip_address": "192.168.1.100",
      "status": "online",
      "last_seen": "2025-12-12T20:00:00.000Z",
      "current_project_id": "project-uuid",
      "settings": {},
      "created_at": "2025-12-12T20:00:00.000Z"
    }
  ]
}
```

#### Регистрация устройства

```
POST /api/devices/register
```

**Body:**
```json
{
  "id": "device-uuid",
  "name": "Kiosk-01",
  "os": "Windows 11",
  "version": "3.0.0",
  "ipAddress": "192.168.1.100"
}
```

#### Получить логи устройства

```
GET /api/devices/:id/logs
Query: ?limit=100&level=error
```

#### Отправить проект на устройство

```
POST /api/devices/:id/deploy
```

**Body:**
```json
{
  "projectId": "uuid",
  "projectName": "Retail Display",
  "projectData": { /* project JSON */ }
}
```

#### Получить статус деплоя

```
GET /api/devices/:id/deploy/:taskId
```

---

## 🔌 WebSocket Events

### Подключение

```javascript
const ws = new WebSocket('ws://localhost:3001');
```

### События от клиента (Player)

#### Регистрация устройства

```javascript
ws.send(JSON.stringify({
  type: 'device:register',
  deviceId: 'uuid',
  name: 'Kiosk-01',
  os: 'Windows 11',
  version: '3.0.0',
  ipAddress: '192.168.1.100'
}));
```

#### Heartbeat

```javascript
ws.send(JSON.stringify({
  type: 'device:heartbeat',
  deviceId: 'uuid'
}));
```

#### Отправка логов

```javascript
ws.send(JSON.stringify({
  type: 'device:log',
  deviceId: 'uuid',
  level: 'info',
  message: 'Player started',
  logData: { /* any data */ }
}));
```

### События от сервера (broadcast)

#### Устройство подключилось

```json
{
  "type": "device:connected",
  "deviceId": "uuid",
  "name": "Kiosk-01",
  "status": "online"
}
```

#### Устройство отключилось

```json
{
  "type": "device:disconnected",
  "deviceId": "uuid"
}
```

#### Начало деплоя

```json
{
  "type": "deployment:start",
  "taskId": "uuid",
  "deviceId": "uuid",
  "projectData": { /* project JSON */ }
}
```

---

## 🗄️ Database Schema

### Tables

- `templates` - Шаблоны проектов
- `media` - Медиа-библиотека
- `devices` - Зарегистрированные устройства
- `device_logs` - Логи устройств
- `deployment_tasks` - Задачи отправки проектов

---

## 📁 Структура проекта

```
packages/server/
├── src/
│   ├── database/
│   │   └── db.js              # Инициализация БД
│   ├── routes/
│   │   ├── templates.js       # Templates API
│   │   ├── media.js           # Media API
│   │   └── devices.js         # Devices API
│   └── index.js               # Главный файл
├── data/                      # База данных и медиа (создаётся автоматически)
│   ├── kiosk.db
│   └── media/
├── package.json
├── .env.example
└── README.md
```

---

## 🔒 Безопасность

### В разработке:
- CORS: `*` (все источники)
- JWT: Базовая реализация

### В production:
1. Измените `JWT_SECRET` на надёжный ключ
2. Настройте `CORS_ORIGIN` на конкретный домен
3. Используйте HTTPS
4. Настройте файрвол
5. Регулярные бэкапы БД

---

## 🛠️ Troubleshooting

### Ошибка "Port already in use"

Измените порт в `.env`:
```env
PORT=3002
```

### Ошибка прав доступа к файлам

```bash
chmod -R 755 data/
```

### База данных не создаётся

Убедитесь что директория `data/` существует:
```bash
mkdir -p data/media
```

---

## 📊 Мониторинг

### Проверка статуса

```bash
curl http://localhost:3001/api/health
```

### Логи

Сервер выводит логи в консоль:
- 📱 WebSocket подключения
- ✅ Регистрация устройств
- 📤 Загрузка медиа
- 🚀 Деплой проектов

---

## 🔄 Обновление

```bash
git pull
npm install
npm start
```

База данных обновляется автоматически при старте.

---

## 📝 License

MIT

---

**Версия:** 3.0.0  
**Дата:** Декабрь 2025
