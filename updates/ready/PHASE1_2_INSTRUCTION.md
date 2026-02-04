# 📋 ИНСТРУКЦИЯ: Фаза 1.2 - API Эндпоинты

**Дата:** 03.02.2026  
**Версия:** 1.0  
**Статус:** Готово к установке

---

## 📦 Что включено

```
phase1_2_api_endpoints.tar.gz
├── Services/
│   ├── UserProfileService.ts     ← Управление профилями
│   ├── ProjectService.ts         ← Управление проектами
│   └── FileService.ts            ← Управление файлами
├── Middleware/
│   ├── authClient.ts             ← Аутентификация клиентов
│   └── storageLimit.ts           ← Проверка лимитов
├── Controllers/
│   ├── AuthController.ts         ← Вход по лицензии
│   ├── ProjectController.ts      ← CRUD проектов
│   └── FileController.ts         ← Загрузка/скачивание файлов
└── Routes/
    ├── auth.routes.ts            ← /api/auth/*
    └── project.routes.ts         ← /api/projects/*
```

---

## 🎯 Что будет создано

### API Эндпоинты:

#### Аутентификация (`/api/auth`)
- `POST /api/auth/license` - вход по ключу лицензии
- `POST /api/auth/refresh` - обновление токена
- `GET /api/auth/verify` - проверка токена

#### Проекты (`/api/projects`)
- `GET /api/projects` - список проектов
- `POST /api/projects` - создать проект
- `GET /api/projects/:id` - получить проект
- `PUT /api/projects/:id` - обновить проект
- `DELETE /api/projects/:id` - удалить проект

#### Файлы (`/api/projects/:projectId/files`)
- `GET /api/projects/:projectId/files` - список файлов
- `POST /api/projects/:projectId/files` - загрузить файл
- `GET /api/projects/:projectId/files/:fileId` - скачать файл
- `DELETE /api/projects/:projectId/files/:fileId` - удалить файл

#### Хранилище
- `GET /api/storage/stats` - статистика использования

---

## 🚀 Установка

### Шаг 1: Загрузка файлов

```bash
# На локальной машине:
scp phase1_2_api_endpoints.tar.gz root@31.192.110.121:/tmp/

# На сервере:
ssh root@31.192.110.121
cd /tmp
tar -xzf phase1_2_api_endpoints.tar.gz
```

### Шаг 2: Установка зависимостей

```bash
cd /opt/kiosk/kiosk-content-platform/packages/server

# Установить multer для загрузки файлов
npm install multer @types/multer --save
```

### Шаг 3: Копирование файлов

```bash
cd /tmp

# Services
cp UserProfileService.ts /opt/kiosk/kiosk-content-platform/packages/server/src/services/
cp ProjectService.ts /opt/kiosk/kiosk-content-platform/packages/server/src/services/
cp FileService.ts /opt/kiosk/kiosk-content-platform/packages/server/src/services/

# Middleware
cp authClient.ts /opt/kiosk/kiosk-content-platform/packages/server/src/middleware/
cp storageLimit.ts /opt/kiosk/kiosk-content-platform/packages/server/src/middleware/

# Controllers
cp AuthController.ts /opt/kiosk/kiosk-content-platform/packages/server/src/controllers/
cp ProjectController.ts /opt/kiosk/kiosk-content-platform/packages/server/src/controllers/
cp FileController.ts /opt/kiosk/kiosk-content-platform/packages/server/src/controllers/

# Routes
cp auth.routes.ts /opt/kiosk/kiosk-content-platform/packages/server/src/routes/
cp project.routes.ts /opt/kiosk/kiosk-content-platform/packages/server/src/routes/
```

### Шаг 4: Создание директории для загрузок

```bash
# Создать директорию для медиа-файлов
mkdir -p /opt/kiosk/uploads/projects

# Установить права
chown -R root:root /opt/kiosk/uploads
chmod -R 755 /opt/kiosk/uploads
```

### Шаг 5: Обновление .env

```bash
cd /opt/kiosk/kiosk-content-platform/packages/server
nano .env
```

Добавь в конец файла:

```env
# Upload directory for project files
UPLOAD_DIR=/opt/kiosk/uploads
```

### Шаг 6: Обновление app.ts

Открой файл `src/app.ts`:

```bash
nano src/app.ts
```

Добавь ПОСЛЕ импортов админских роутов:

```typescript
// NEW: Client API routes
import authRoutes from './routes/auth.routes';
import projectRoutes from './routes/project.routes';
```

Добавь ПОСЛЕ регистрации админских роутов (после `/api/admin`):

```typescript
// NEW: Client API endpoints
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);

// Storage stats endpoint
app.get('/api/storage/stats', async (req, res) => {
  const { FileController } = await import('./controllers/FileController');
  return FileController.getStorageStats(req, res);
});
```

Также добавь ПЕРЕД регистрацией роутов:

```typescript
// Enable larger body size for file uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
```

---

## 🔄 Применение изменений

### 1. Компиляция

```bash
cd /opt/kiosk/kiosk-content-platform/packages/server
npm run build
```

**Проверь что нет ошибок компиляции!**

### 2. Перезапуск сервера

```bash
systemctl restart kiosk-license-server
systemctl status kiosk-license-server
```

### 3. Проверка логов

```bash
journalctl -u kiosk-license-server -n 50 --no-pager
```

Должны появиться новые роуты:

```
🛣️  Client API Routes:
   • POST /api/auth/license
   • POST /api/auth/refresh
   • GET  /api/auth/verify
   • GET  /api/projects
   • POST /api/projects
   • GET  /api/projects/:id
   • PUT  /api/projects/:id
   • DELETE /api/projects/:id
```

---

## ✅ Тестирование API

### 1. Вход по лицензии

```bash
# Используем тестовую лицензию BASIC
curl -X POST http://localhost:3001/api/auth/license \
  -H "Content-Type: application/json" \
  -d '{"licenseKey":"EWZA-E5LJ-Z558-9LUQ"}' | jq .
```

**Ожидаемый ответ:**

```json
{
  "success": true,
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 604800,
  "license": {
    "id": "...",
    "plan": "BASIC",
    "storageLimit": "524288000"
  }
}
```

Сохрани токен для следующих запросов:

```bash
TOKEN="<your-token>"
```

### 2. Создание проекта

```bash
curl -X POST http://localhost:3001/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My First Project",
    "description": "Test project",
    "projectData": {
      "widgets": [],
      "canvas": {
        "width": 1920,
        "height": 1080
      }
    },
    "tags": ["test"]
  }' | jq .
```

**Ожидаемый ответ:**

```json
{
  "success": true,
  "project": {
    "id": "...",
    "name": "My First Project",
    "createdAt": "..."
  }
}
```

Сохрани `project.id` для следующих запросов:

```bash
PROJECT_ID="<project-id>"
```

### 3. Получение списка проектов

```bash
curl http://localhost:3001/api/projects \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### 4. Получение проекта по ID

```bash
curl http://localhost:3001/api/projects/$PROJECT_ID \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### 5. Загрузка файла

Создай тестовый файл:

```bash
echo "Test content" > /tmp/test.txt
```

Загрузи файл:

```bash
curl -X POST http://localhost:3001/api/projects/$PROJECT_ID/files \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/test.txt" | jq .
```

**Ожидаемый ответ:**

```json
{
  "success": true,
  "file": {
    "id": "...",
    "fileName": "test.txt",
    "fileSize": 13,
    "url": "/api/projects/.../files/..."
  },
  "storage": {
    "used": 13,
    "limit": 524288000,
    "remaining": 524287987,
    "usedPercentage": 0
  }
}
```

### 6. Статистика хранилища

```bash
curl http://localhost:3001/api/storage/stats \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## 🐛 Решение проблем

### Ошибка: "Cannot find module"

**Причина:** Файлы не скопированы или не скомпилированы

**Решение:**

```bash
cd /opt/kiosk/kiosk-content-platform/packages/server

# Проверь что файлы на месте
ls -la src/services/ProjectService.ts
ls -la src/controllers/AuthController.ts
ls -la src/routes/auth.routes.ts

# Пересобери
npm run build

# Проверь dist/
ls -la dist/services/
ls -la dist/controllers/
ls -la dist/routes/
```

### Ошибка: "multer is not defined"

**Причина:** Multer не установлен

**Решение:**

```bash
cd /opt/kiosk/kiosk-content-platform/packages/server
npm install multer @types/multer --save
npm run build
systemctl restart kiosk-license-server
```

### Ошибка: "ENOENT: no such file or directory '/opt/kiosk/uploads'"

**Причина:** Директория для загрузок не создана

**Решение:**

```bash
mkdir -p /opt/kiosk/uploads/projects
chmod -R 755 /opt/kiosk/uploads
systemctl restart kiosk-license-server
```

### Роуты не появляются в логах

**Проверь app.ts:**

```bash
cd /opt/kiosk/kiosk-content-platform/packages/server
grep "authRoutes" src/app.ts
grep "projectRoutes" src/app.ts
```

Если строк нет - добавь их по инструкции выше.

---

## 📊 Статус разработки

```
Фаза 1: Backend API
├─ [✅] 1.1 Расширение БД
├─ [✅] 1.2 API для проектов (ЗАВЕРШЕНО)
├─ [ ] 1.3 Обновление Admin Panel (показывать storageLimit)
└─ [ ] 1.4 Документация API

Фаза 2: Frontend адаптация
├─ [ ] 2.1 Создание editor-web
├─ [ ] 2.2 Интеграция с API
├─ [ ] 2.3 Управление проектами
└─ [ ] 2.4 Работа с медиа

Фаза 3: Инфраструктура
├─ [ ] 3.1 Nginx для editor-web
└─ [ ] 3.2 Production build

Фаза 4: Тестирование
└─ [ ] 4.1 Функциональное тестирование
```

**Прогресс:** ~30% (3 из 10 подзадач)

---

## 🎯 Следующие шаги

После успешной установки и тестирования API:

1. **Фаза 1.3**: Обновить Admin Panel для отображения storageLimit в списке лицензий
2. **Фаза 2**: Начать адаптацию Editor для работы с API

---

**Конец инструкции Фазы 1.2**
