# API Documentation - Iteration 2

## 📡 License API Endpoints

### POST /api/license/activate
Активировать устройство с license key

**Request:**
```json
{
  "licenseKey": "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX",
  "deviceId": "unique-device-id",
  "appType": "editor",  // или "player"
  "deviceName": "My Editor Device",  // опционально
  "osInfo": {  // опционально
    "platform": "linux",
    "release": "Ubuntu 24.04",
    "arch": "x64"
  }
}
```

**Response (201):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJSUzI1NiIs...",
  "expiresAt": "2026-01-17T12:00:00.000Z",
  "device": {
    "id": "uuid",
    "deviceId": "unique-device-id",
    "appType": "EDITOR",
    "deviceName": "My Editor Device"
  },
  "license": {
    "plan": "PRO",
    "validUntil": "2027-01-10T00:00:00.000Z"
  }
}
```

**Errors:**
- `400` - Invalid license key / Validation failed
- `403` - License limit reached / Device deactivated
- `500` - Internal server error

---

### POST /api/license/refresh
Обновить токен устройства

**Request:**
```json
{
  "deviceId": "unique-device-id",
  "oldToken": "eyJhbGciOiJSUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJSUzI1NiIs...",
  "expiresAt": "2026-01-17T12:00:00.000Z"
}
```

**Errors:**
- `401` - Invalid or expired token
- `403` - Device ID mismatch / Device deactivated / License invalid
- `404` - Device not found

---

### POST /api/license/validate
Проверить валидность токена

**Request:**
```json
{
  "token": "eyJhbGciOiJSUzI1NiIs...",
  "deviceId": "unique-device-id"
}
```

**Response (200):**
```json
{
  "valid": true,
  "payload": {
    "licenseId": "uuid",
    "deviceId": "unique-device-id",
    "plan": "pro",
    "app": "editor",
    "features": {
      "maxEditorDevices": 5,
      "maxPlayerDevices": 10,
      "cloudSync": true,
      "advancedAnalytics": true
    },
    "expiresAt": "2026-01-17T12:00:00.000Z"
  }
}
```

**Response (200) - Invalid:**
```json
{
  "valid": false,
  "error": "Token expired"
}
```

---

### POST /api/license/deactivate
Деактивировать устройство

**Request:**
```json
{
  "deviceId": "unique-device-id",
  "licenseKey": "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Device deactivated successfully"
}
```

**Errors:**
- `400` - Invalid license key
- `403` - Device does not belong to this license
- `404` - Device not found

---

## 🔐 Admin API Endpoints

### POST /api/admin/login
Вход админа

**Request:**
```json
{
  "email": "admin@kiosk.local",
  "password": "Admin123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJSUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "admin@kiosk.local",
    "role": "ADMIN",
    "organization": {
      "id": "uuid",
      "name": "Demo Organization"
    }
  }
}
```

**Errors:**
- `401` - Invalid credentials

---

### GET /api/admin/licenses
Получить список лицензий (требует admin токен)

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Query Parameters:**
- `status` - ACTIVE | SUSPENDED | EXPIRED | CANCELLED
- `plan` - BASIC | PRO | MAX
- `search` - поиск по license key или названию организации
- `page` - номер страницы (default: 1)
- `limit` - лимит на страницу (default: 20, max: 100)

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "licenseKey": "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX",
      "plan": "PRO",
      "status": "ACTIVE",
      "validUntil": "2027-01-10T00:00:00.000Z",
      "organization": {
        "id": "uuid",
        "name": "Demo Organization"
      },
      "_count": {
        "devices": 3
      },
      "createdAt": "2026-01-10T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "pages": 3
  }
}
```

---

### POST /api/admin/licenses
Создать новую лицензию (требует admin токен)

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Request:**
```json
{
  "organizationId": "uuid",
  "plan": "PRO",
  "validUntil": "2027-01-10T00:00:00.000Z"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "licenseKey": "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX",
    "plan": "PRO",
    "status": "ACTIVE",
    "validUntil": "2027-01-10T00:00:00.000Z",
    "organizationId": "uuid",
    "createdAt": "2026-01-10T00:00:00.000Z"
  }
}
```

---

### GET /api/admin/licenses/:id
Получить детали лицензии (требует admin токен)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "licenseKey": "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX",
    "plan": "PRO",
    "status": "ACTIVE",
    "validUntil": "2027-01-10T00:00:00.000Z",
    "organization": {
      "id": "uuid",
      "name": "Demo Organization",
      "contactEmail": "contact@demo.org"
    },
    "devices": [
      {
        "id": "uuid",
        "deviceId": "device-001",
        "deviceName": "Editor 1",
        "appType": "EDITOR",
        "status": "ACTIVE",
        "lastSeenAt": "2026-01-10T12:00:00.000Z"
      }
    ],
    "createdAt": "2026-01-10T00:00:00.000Z"
  }
}
```

---

### PATCH /api/admin/licenses/:id
Обновить лицензию (требует admin токен)

**Request:**
```json
{
  "status": "SUSPENDED",
  "validUntil": "2027-06-01T00:00:00.000Z",
  "plan": "MAX"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "licenseKey": "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX",
    "plan": "MAX",
    "status": "SUSPENDED",
    "validUntil": "2027-06-01T00:00:00.000Z",
    "updatedAt": "2026-01-10T12:00:00.000Z"
  }
}
```

---

### GET /api/admin/devices
Получить список устройств (требует admin токен)

**Query Parameters:**
- `status` - ACTIVE | DEACTIVATED
- `appType` - EDITOR | PLAYER
- `licenseId` - UUID лицензии
- `search` - поиск по device ID или имени
- `page` - номер страницы
- `limit` - лимит на страницу

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "deviceId": "device-001",
      "deviceName": "Editor 1",
      "appType": "EDITOR",
      "status": "ACTIVE",
      "license": {
        "id": "uuid",
        "licenseKey": "XXXXX-...",
        "plan": "PRO",
        "organization": {
          "id": "uuid",
          "name": "Demo Organization"
        }
      },
      "lastSeenAt": "2026-01-10T12:00:00.000Z",
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

---

### DELETE /api/admin/devices/:id
Удалить (деактивировать) устройство (требует admin токен)

**Response (200):**
```json
{
  "success": true,
  "message": "Device deactivated successfully"
}
```

---

### GET /api/admin/stats
Получить статистику системы (требует admin токен)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "licenses": {
      "total": 100,
      "active": 85,
      "expired": 10,
      "byPlan": [
        { "plan": "BASIC", "count": 30 },
        { "plan": "PRO", "count": 40 },
        { "plan": "MAX", "count": 15 }
      ]
    },
    "devices": {
      "total": 450,
      "active": 380,
      "editors": 150,
      "players": 230,
      "recentActivations": 25
    }
  }
}
```

---

### GET /api/admin/audit
Получить audit logs (требует admin токен)

**Query Parameters:**
- `action` - тип действия (device_activate, token_refresh, etc.)
- `userId` - UUID пользователя
- `licenseId` - UUID лицензии
- `deviceId` - ID устройства
- `limit` - лимит записей (default: 100, max: 500)
- `offset` - смещение

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "action": "device_activate",
      "deviceId": "device-001",
      "licenseId": "uuid",
      "details": {
        "appType": "editor"
      },
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "createdAt": "2026-01-10T12:00:00.000Z",
      "user": null,
      "device": {
        "id": "uuid",
        "deviceName": "Editor 1",
        "appType": "EDITOR"
      },
      "license": {
        "id": "uuid",
        "licenseKey": "XXXXX-...",
        "plan": "PRO"
      }
    }
  ]
}
```

---

## 🔒 Authentication

### Admin Endpoints
Все admin endpoints (кроме `/api/admin/login`) требуют JWT токен в header:

```
Authorization: Bearer <token>
```

Токен получается через `/api/admin/login` и действителен 24 часа.

### License Endpoints
License endpoints (`/api/license/*`) не требуют admin токена. Они используют `licenseKey` для аутентификации.

---

## 🛡️ Rate Limiting

- **General API**: 100 requests / 15 minutes
- **Admin Login**: 5 requests / 15 minutes

Превышение лимита возвращает `429 Too Many Requests`.

---

## 📊 Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "details": [  // опционально для validation errors
    {
      "field": "email",
      "message": "Valid email is required"
    }
  ]
}
```

---

## 🧪 Testing

### Health Check
```bash
curl http://localhost:3001/health
```

### Activate Device
```bash
curl -X POST http://localhost:3001/api/license/activate \
  -H "Content-Type: application/json" \
  -d '{
    "licenseKey": "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX",
    "deviceId": "my-device-001",
    "appType": "editor"
  }'
```

### Admin Login
```bash
curl -X POST http://localhost:3001/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@kiosk.local",
    "password": "Admin123!"
  }'
```

### Get Licenses (with admin token)
```bash
curl http://localhost:3001/api/admin/licenses \
  -H "Authorization: Bearer <admin_token>"
```

---

## 📝 Notes

1. Все даты в формате ISO 8601
2. UUID используются для всех ID в базе данных
3. Device ID - это произвольная строка от клиента (MAC address, UUID, и т.д.)
4. License Key - 29 символов в формате XXXXX-XXXXX-XXXXX-XXXXX-XXXXX
5. Пароли хешируются с использованием bcrypt
6. JWT токены подписываются RSA-2048 ключами
