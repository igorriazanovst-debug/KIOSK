# 🔧 QUICK FIX: License Key Generation Patch

## Проблема
Create License endpoint (POST /api/admin/licenses) возвращает HTTP 500 потому что не генерирует `licenseKey` перед созданием лицензии.

## Решение
Исправлено 2 файла:
1. `AdminController.ts` - добавлена генерация `licenseKey`  
2. `LicenseService.ts` - добавлен опциональный параметр `licenseKey`

---

## 📝 Как применить патч

### Шаг 1: Остановить сервер

```bash
sudo systemctl stop kiosk-license-server
```

### Шаг 2: Перейти в директорию сервера

```bash
cd /opt/kiosk/kiosk-content-platform/packages/server
```

### Шаг 3: Создать бэкапы оригинальных файлов

```bash
cp src/controllers/AdminController.ts src/controllers/AdminController.ts.backup
cp src/services/LicenseService.ts src/services/LicenseService.ts.backup
```

### Шаг 4: Применить патчи

**Способ А: Ручное редактирование (рекомендуется)**

#### 4.1 AdminController.ts

Откройте файл:
```bash
nano src/controllers/AdminController.ts
```

**Добавьте функцию в начало файла** (после imports, до class AdminController):

```typescript
/**
 * Generate a random license key in format: XXXX-XXXX-XXXX-XXXX
 * Uses uppercase letters and numbers (A-Z, 0-9)
 */
function generateLicenseKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const groups = 4;
  const charsPerGroup = 4;
  
  return Array.from({ length: groups }, () =>
    Array.from({ length: charsPerGroup }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('')
  ).join('-');
}
```

**Найдите метод `createLicense`** и добавьте ПЕРЕД вызовом `LicenseService.createLicense()`:

```typescript
// 🆕 GENERATE LICENSE KEY AUTOMATICALLY
const licenseKey = generateLicenseKey();
```

**И передайте его в вызов**:

```typescript
const license = await LicenseService.createLicense({
  organizationId,
  plan,
  licenseKey, // 🆕 Pass the generated key
  seatsEditor: seatsEditor || planConfig.seatsEditor,
  seatsPlayer: seatsPlayer || planConfig.seatsPlayer,
  validFrom: new Date(),
  validUntil: new Date(validUntil),
  companyName,
  contactEmail,
  notes
});
```

**Также добавьте в Audit Log**:

```typescript
await AuditService.logLicenseCreated({
  licenseId: license.id,
  userId: req.user!.id,
  details: {
    organizationId,
    plan,
    licenseKey, // 🆕 Log the generated key
    seatsEditor: license.seatsEditor,
    seatsPlayer: license.seatsPlayer,
    validUntil
  },
  ipAddress: req.ip
});
```

Сохраните файл (Ctrl+O, Enter, Ctrl+X).

#### 4.2 LicenseService.ts

Откройте файл:
```bash
nano src/services/LicenseService.ts
```

**Найдите метод `createLicense`** и измените сигнатуру params:

```typescript
static async createLicense(params: {
  organizationId: string;
  plan: Plan | string;
  seatsEditor: number;
  seatsPlayer: number;
  validFrom: Date;
  validUntil: Date;
  licenseKey?: string; // 🆕 Optional parameter
  companyName?: string;
  contactEmail?: string;
  notes?: string;
}) {
```

**Замените логику генерации ключа**:

```typescript
let finalLicenseKey: string;

if (params.licenseKey) {
  // Use provided license key
  finalLicenseKey = params.licenseKey;
  
  // Check if it already exists
  const existing = await prisma.license.findUnique({
    where: { licenseKey: finalLicenseKey }
  });
  
  if (existing) {
    throw new Error(`License key ${finalLicenseKey} already exists`);
  }
} else {
  // Generate unique key
  let isUnique = false;
  
  while (!isUnique) {
    finalLicenseKey = generateLicenseKey();
    const existing = await prisma.license.findUnique({
      where: { licenseKey: finalLicenseKey }
    });
    isUnique = !existing;
  }
}
```

**И в prisma.license.create используйте**:

```typescript
return prisma.license.create({
  data: {
    licenseKey: finalLicenseKey, // 🆕 Use the determined key
    organizationId: params.organizationId,
    plan: planUpper,
    status: 'ACTIVE',
    seatsEditor: params.seatsEditor,
    seatsPlayer: params.seatsPlayer,
    validFrom: params.validFrom,
    validUntil: params.validUntil,
    companyName: params.companyName || null,
    contactEmail: params.contactEmail || null,
    notes: params.notes || null
  },
  include: {
    organization: true
  }
});
```

Сохраните файл (Ctrl+O, Enter, Ctrl+X).

---

**Способ Б: Замена файлов целиком**

Если у вас есть готовые файлы `AdminController-FIXED.ts` и `LicenseService-PATCHED.ts`:

```bash
# Создать бэкапы
cp src/controllers/AdminController.ts src/controllers/AdminController.ts.backup
cp src/services/LicenseService.ts src/services/LicenseService.ts.backup

# Заменить файлы
cp ../../patches/AdminController-FIXED.ts src/controllers/AdminController.ts
cp ../../patches/LicenseService-PATCHED.ts src/services/LicenseService.ts
```

---

### Шаг 5: Пересобрать проект

```bash
cd /opt/kiosk/kiosk-content-platform/packages/server
npm run build
```

Проверьте что сборка успешна:
```bash
ls -la dist/controllers/AdminController.js
ls -la dist/services/LicenseService.js
```

### Шаг 6: Запустить сервер

```bash
sudo systemctl start kiosk-license-server
sudo systemctl status kiosk-license-server
```

Проверьте логи:
```bash
sudo journalctl -u kiosk-license-server -f
```

---

## ✅ Тестирование

### Тест 1: Получить admin token

```bash
curl -X POST http://localhost:3001/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@kiosk.local",
    "password": "Admin123!"
  }'
```

Сохраните токен из ответа:
```json
{
  "success": true,
  "token": "eyJhbGc..."
}
```

### Тест 2: Получить organization ID

```bash
curl -X GET http://localhost:3001/api/admin/licenses \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

Найдите `organizationId` в одной из лицензий.

### Тест 3: Создать новую лицензию

```bash
curl -X POST http://localhost:3001/api/admin/licenses \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "YOUR_ORG_ID",
    "plan": "PRO",
    "seatsEditor": 10,
    "seatsPlayer": 20,
    "validUntil": "2027-12-31T23:59:59.000Z",
    "companyName": "Test Company",
    "contactEmail": "test@example.com",
    "notes": "Test license created via patched endpoint"
  }'
```

**Ожидаемый результат: HTTP 201**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "licenseKey": "A1B2-C3D4-E5F6-G7H8",
    "plan": "PRO",
    "seatsEditor": 10,
    "seatsPlayer": 20,
    "status": "ACTIVE",
    "validUntil": "2027-12-31T23:59:59.000Z",
    "companyName": "Test Company",
    "contactEmail": "test@example.com"
  }
}
```

### Тест 4: Проверить что ключ уникален

Повторите Тест 3 несколько раз - каждый раз должен генерироваться **новый уникальный** `licenseKey`.

---

## 🎉 Готово!

Теперь Create License endpoint работает правильно и:
- ✅ Генерирует уникальный `licenseKey` автоматически
- ✅ Возвращает HTTP 201 с данными лицензии
- ✅ Записывает событие в audit log
- ✅ Поддерживает все планы (BASIC, PRO, MAX)

---

## 🔙 Откат изменений (если нужно)

```bash
cd /opt/kiosk/kiosk-content-platform/packages/server

# Восстановить оригиналы
cp src/controllers/AdminController.ts.backup src/controllers/AdminController.ts
cp src/services/LicenseService.ts.backup src/services/LicenseService.ts

# Пересобрать
npm run build

# Перезапустить сервер
sudo systemctl restart kiosk-license-server
```

---

## 📊 Что изменилось

### До патча:
```typescript
// AdminController.ts
const license = await LicenseService.createLicense({
  organizationId,
  plan,
  // ❌ Нет licenseKey!
  seatsEditor,
  seatsPlayer,
  validFrom,
  validUntil
});
// Result: HTTP 500 - licenseKey violation
```

### После патча:
```typescript
// AdminController.ts
const licenseKey = generateLicenseKey(); // ✅

const license = await LicenseService.createLicense({
  organizationId,
  plan,
  licenseKey, // ✅ Передаем сгенерированный ключ
  seatsEditor,
  seatsPlayer,
  validFrom,
  validUntil
});
// Result: HTTP 201 - Success!
```

---

**Iteration 2 Issue #1: RESOLVED ✅**

Можно переходить к интеграции Editor и Player!
