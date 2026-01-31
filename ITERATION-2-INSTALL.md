# 🚀 Iteration 2: Installation Guide

## Обзор

**Iteration 2** добавляет полноценный API для управления лицензиями и устройствами.

### Новые компоненты:
- ✅ License API (activate, refresh, validate, deactivate)
- ✅ Admin API (login, CRUD licenses/devices, stats, audit logs)
- ✅ Authentication & Authorization (JWT для админов)
- ✅ Validation middleware
- ✅ Error handling
- ✅ Rate limiting
- ✅ Audit logging
- ✅ Seed script с тестовыми данными

---

## 📦 Новые файлы (14 штук)

### Services (1 файл)
1. `AuditService.ts` → `packages/server/src/services/`

### Middleware (3 файла)
2. `auth.ts` → `packages/server/src/middleware/`
3. `errorHandler.ts` → `packages/server/src/middleware/`
4. `validateRequest.ts` → `packages/server/src/middleware/`

### Controllers (2 файла)
5. `LicenseController.ts` → `packages/server/src/controllers/`
6. `AdminController.ts` → `packages/server/src/controllers/`

### Validators (2 файла)
7. `license.validators.ts` → `packages/server/src/validators/`
8. `admin.validators.ts` → `packages/server/src/validators/`

### Routes (2 файла)
9. `license.routes.ts` → `packages/server/src/routes/`
10. `admin.routes.ts` → `packages/server/src/routes/`

### Main Application (1 файл)
11. `app.ts` → `packages/server/src/` (замените старый)

### Seed Script (1 файл)
12. `seed.ts` → `packages/server/prisma/`

### Documentation (2 файла)
13. `API-DOCUMENTATION.md` → корень проекта (документация)
14. `ITERATION-2-INSTALL.md` → корень проекта (этот файл)

---

## 🔧 Установка на сервер

### Шаг 1: Загрузите файлы на сервер

```bash
# Вариант A: Через SCP с локальной машины
scp packages-server-*.ts user@server:/tmp/

# Вариант B: Скачать напрямую на сервере (если файлы доступны)
cd /opt/kiosk/kiosk-content-platform/packages/server
# ... скопируйте файлы
```

### Шаг 2: Разместите файлы в правильной структуре

```bash
cd /opt/kiosk/kiosk-content-platform/packages/server

# Создайте директории
mkdir -p src/services src/middleware src/controllers src/validators src/routes

# Переместите файлы (адаптируйте пути если загружали в /tmp)

# Services
mv /path/to/packages-server-services-AuditService.ts src/services/AuditService.ts

# Middleware
mv /path/to/packages-server-middleware-auth.ts src/middleware/auth.ts
mv /path/to/packages-server-middleware-errorHandler.ts src/middleware/errorHandler.ts
mv /path/to/packages-server-middleware-validateRequest.ts src/middleware/validateRequest.ts

# Controllers
mv /path/to/packages-server-controllers-LicenseController.ts src/controllers/LicenseController.ts
mv /path/to/packages-server-controllers-AdminController.ts src/controllers/AdminController.ts

# Validators
mv /path/to/packages-server-validators-license.validators.ts src/validators/license.validators.ts
mv /path/to/packages-server-validators-admin.validators.ts src/validators/admin.validators.ts

# Routes
mv /path/to/packages-server-routes-license.routes.ts src/routes/license.routes.ts
mv /path/to/packages-server-routes-admin.routes.ts src/routes/admin.routes.ts

# Main app (замените старый)
mv /path/to/packages-server-app.ts src/app.ts

# Seed script
mv /path/to/packages-server-prisma-seed.ts prisma/seed.ts
```

### Шаг 3: Обновите package.json

```bash
cd /opt/kiosk/kiosk-content-platform/packages/server
nano package.json
```

Добавьте в секцию `scripts`:

```json
"scripts": {
  "dev": "nodemon --exec ts-node src/app.ts",
  "build": "tsc",
  "start": "node dist/app.js",
  "generate-keys": "node scripts/generate-keys.js",
  "prisma:generate": "prisma generate",
  "prisma:migrate": "prisma migrate dev",
  "prisma:deploy": "prisma migrate deploy",
  "prisma:studio": "prisma studio",
  "seed": "ts-node prisma/seed.ts"  // ← Добавьте эту строку
}
```

### Шаг 4: Соберите проект

```bash
cd /opt/kiosk/kiosk-content-platform/packages/server

# Убедитесь что shared собран
cd ../shared
npm run build
ls -la dist/  # Проверьте что файлы есть

# Соберите server
cd ../server
npm run build

# Проверьте что всё скомпилировалось
ls -la dist/
ls -la dist/services/
ls -la dist/middleware/
ls -la dist/controllers/
ls -la dist/validators/
ls -la dist/routes/
```

### Шаг 5: Запустите seed script

```bash
cd /opt/kiosk/kiosk-content-platform/packages/server

# Создать начальные данные (admin, тестовые лицензии)
npm run seed
```

**Вывод должен быть:**
```
🌱 Starting database seed...
📦 Creating organization...
✅ Organization created: Demo Organization (uuid)
👤 Creating admin user...
✅ Admin user created: admin@kiosk.local
   Password: Admin123!
   ⚠️  CHANGE THIS PASSWORD IN PRODUCTION!
🔑 Creating test licenses...
✅ Basic license: XXXXX-XXXXX-XXXXX-XXXXX-XXXXX
✅ Pro license: XXXXX-XXXXX-XXXXX-XXXXX-XXXXX
✅ Max license: XXXXX-XXXXX-XXXXX-XXXXX-XXXXX
💻 Creating test device...
✅ Test device created: TEST-DEVICE-001
```

**Сохраните эти данные!** Они нужны для тестирования.

### Шаг 6: Перезапустите сервер

```bash
# Перезапустите systemd сервис
sudo systemctl restart kiosk-license-server

# Проверьте статус
sudo systemctl status kiosk-license-server

# Должно быть: Active: active (running)

# Посмотрите логи
sudo journalctl -u kiosk-license-server -n 30
```

**Ожидаемый вывод в логах:**
```
✅ Database connected
╔════════════════════════════════════════════════╗
║   Kiosk License Server - Iteration 2          ║
║   Full API with Authentication                ║
╚════════════════════════════════════════════════╝

📍 Server:      http://localhost:3001
🏥 Health:      http://localhost:3001/health
🌍 Environment: production

📡 API Endpoints:
   License API:
   • POST /api/license/activate
   • POST /api/license/refresh
   • POST /api/license/validate
   • POST /api/license/deactivate

   Admin API:
   • POST /api/admin/login
   • GET  /api/admin/licenses
   • POST /api/admin/licenses
   • GET  /api/admin/devices
   • GET  /api/admin/stats
   • GET  /api/admin/audit
```

---

## ✅ Тестирование API

### 1. Health Check

```bash
curl http://localhost:3001/health
```

Ожидается:
```json
{
  "status": "ok",
  "message": "Kiosk License Server is running",
  "timestamp": "2026-01-10T...",
  "environment": "production",
  "version": "1.0.0"
}
```

### 2. Активация устройства

```bash
# Используйте один из license keys из seed вывода
curl -X POST http://localhost:3001/api/license/activate \
  -H "Content-Type: application/json" \
  -d '{
    "licenseKey": "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX",
    "deviceId": "test-device-123",
    "appType": "editor",
    "deviceName": "My Test Editor"
  }'
```

Ожидается:
```json
{
  "success": true,
  "token": "eyJhbGci...",
  "expiresAt": "2026-01-17T...",
  "device": { ... },
  "license": { ... }
}
```

### 3. Admin Login

```bash
curl -X POST http://localhost:3001/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@kiosk.local",
    "password": "Admin123!"
  }'
```

Ожидается:
```json
{
  "success": true,
  "token": "eyJhbGci...",
  "user": {
    "id": "uuid",
    "email": "admin@kiosk.local",
    "role": "ADMIN",
    "organization": { ... }
  }
}
```

**Сохраните токен!** Он нужен для следующих запросов.

### 4. Получить список лицензий

```bash
# Замените <ADMIN_TOKEN> на токен из предыдущего шага
curl http://localhost:3001/api/admin/licenses \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

Ожидается:
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": { ... }
}
```

### 5. Получить статистику

```bash
curl http://localhost:3001/api/admin/stats \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

### 6. Проверить audit logs

```bash
curl http://localhost:3001/api/admin/audit \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

---

## 📊 Структура после установки

```
/opt/kiosk/kiosk-content-platform/packages/server/
├── src/
│   ├── config/
│   │   ├── database.ts
│   │   ├── features.ts
│   │   └── jwt.ts
│   ├── services/
│   │   ├── TokenService.ts
│   │   ├── DeviceService.ts
│   │   ├── LicenseService.ts
│   │   └── AuditService.ts ✨ NEW
│   ├── middleware/
│   │   ├── auth.ts ✨ NEW
│   │   ├── errorHandler.ts ✨ NEW
│   │   └── validateRequest.ts ✨ NEW
│   ├── controllers/
│   │   ├── LicenseController.ts ✨ NEW
│   │   └── AdminController.ts ✨ NEW
│   ├── validators/
│   │   ├── license.validators.ts ✨ NEW
│   │   └── admin.validators.ts ✨ NEW
│   ├── routes/
│   │   ├── license.routes.ts ✨ NEW
│   │   └── admin.routes.ts ✨ NEW
│   └── app.ts ✨ UPDATED
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts ✨ NEW
├── dist/ (после сборки)
└── package.json
```

---

## 🐛 Troubleshooting

### Ошибка: "Cannot find module '@kiosk/shared'"

```bash
# Пересоберите shared
cd /opt/kiosk/kiosk-content-platform/packages/shared
npm run build

# Проверьте dist
ls -la dist/
```

### Ошибка при сборке TypeScript

```bash
# Проверьте tsconfig.json
cd /opt/kiosk/kiosk-content-platform/packages/server
cat tsconfig.json

# Должно быть:
# "paths": {
#   "@kiosk/shared": ["../shared/dist/index"],
#   ...
# }
```

### Seed script падает

```bash
# Проверьте подключение к БД
psql -U kiosk_user -d kiosk_licensing -h localhost -c "SELECT 1"

# Проверьте что Prisma Client сгенерирован
cd /opt/kiosk/kiosk-content-platform/packages/server
npm run prisma:generate
```

### Сервер не запускается

```bash
# Посмотрите детальные логи
sudo journalctl -u kiosk-license-server -n 100 --no-pager

# Проверьте порт
sudo ss -tulpn | grep :3001

# Если порт занят - освободите
sudo kill -9 $(sudo ss -tulpn | grep :3001 | awk '{print $7}' | cut -d',' -f2 | cut -d'=' -f2)
```

---

## 🎉 Iteration 2 Complete!

После успешной установки у вас работает:

- ✅ Полный License API для активации устройств
- ✅ Admin API для управления лицензиями
- ✅ JWT аутентификация
- ✅ Валидация запросов
- ✅ Rate limiting
- ✅ Audit logging
- ✅ Тестовые данные (admin + 3 лицензии)

### Что дальше?

**Iteration 3:** Editor & Player интеграция
- Интеграция API в Editor приложение
- Интеграция API в Player приложение
- Автоматическая активация при первом запуске
- Фоновое обновление токенов

**Iteration 4:** Admin Panel (React)
- Dashboard с графиками
- Управление лицензиями
- Мониторинг устройств
- Просмотр audit logs

---

## 📚 Дополнительная информация

- Полная документация API: `API-DOCUMENTATION.md`
- Примеры запросов: в документации выше
- Схема базы данных: `packages/server/prisma/schema.prisma`

---

**Отличная работа!** 🚀

Теперь у вас полноценный License Server с API!
