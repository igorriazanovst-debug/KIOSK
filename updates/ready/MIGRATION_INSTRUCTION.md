# 📋 ИНСТРУКЦИЯ: Фаза 1 - Расширение базы данных для Online Editor

**Дата:** 02.02.2026  
**Версия:** 1.0  
**Статус:** Готово к применению

---

## 📦 Что включено в архив

```
phase1_backend_db_migration.tar.gz
├── schema_full_updated.prisma      ← Полная обновлённая schema
├── apply_db_migration.sh           ← Автоматический скрипт применения
├── update_storage_limits.sql       ← SQL для обновления лимитов
├── schema_extension.prisma         ← Только новые модели (для справки)
└── extend_prisma_schema.py         ← Python-скрипт (для справки)
```

---

## 🎯 Что будет сделано

### Новые таблицы:

1. **user_profiles** - Профили пользователей
   - Настройки редактора (автосохранение, тема, язык)
   - Статистика (количество проектов, использованное место)

2. **projects** - Проекты киоск-контента
   - Полный JSON проекта (projectData)
   - Метаданные (название, описание, теги, превью)
   - Связь с лицензией и организацией
   - Статистика (размер, количество файлов, просмотры)

3. **project_files** - Медиа-файлы проектов
   - Изображения, видео, аудио, документы
   - Метаданные (размер, разрешение, продолжительность)
   - Пути хранения и URL доступа

### Обновлённые модели:

- **User**: добавлена связь с `UserProfile` и `Project`
- **License**: добавлен `storageLimit` и связь с `Project`
- **Organization**: добавлена связь с `Project`

### Лимиты хранилища:

- **BASIC**: 500 MB (524288000 bytes)
- **PRO**: 1500 MB (1572864000 bytes)
- **MAX**: 3000 MB (3145728000 bytes)

---

## 🚀 Применение миграции

### Вариант 1: Автоматический (рекомендуется)

```bash
# 1. Загрузите архив на сервер
scp phase1_backend_db_migration.tar.gz root@31.192.110.121:/tmp/

# 2. Подключитесь к серверу
ssh root@31.192.110.121

# 3. Распакуйте архив
cd /tmp
tar -xzf phase1_backend_db_migration.tar.gz

# 4. Скопируйте schema в проект
cp schema_full_updated.prisma /opt/kiosk/kiosk-content-platform/packages/server/prisma/schema.prisma

# 5. Скопируйте скрипт миграции
cp apply_db_migration.sh /opt/kiosk/kiosk-content-platform/packages/server/

# 6. Запустите миграцию
cd /opt/kiosk/kiosk-content-platform/packages/server
chmod +x apply_db_migration.sh
./apply_db_migration.sh
```

**Скрипт автоматически:**
- ✅ Создаст бэкап базы данных
- ✅ Создаст резервную копию старой schema.prisma
- ✅ Применит миграции
- ✅ Обновит лимиты хранилища для существующих лицензий
- ✅ Регенерирует Prisma Client

---

### Вариант 2: Ручной

Если предпочитаете контроль на каждом шаге:

```bash
# 1. Подключитесь к серверу
ssh root@31.192.110.121

# 2. Перейдите в директорию server
cd /opt/kiosk/kiosk-content-platform/packages/server

# 3. Создайте бэкап базы данных
mkdir -p backups
export $(cat .env | grep -v '^#' | xargs)
# Получите параметры из DATABASE_URL и выполните:
pg_dump -h <host> -p <port> -U <user> -d <database> > backups/backup_$(date +%Y%m%d_%H%M%S).sql

# 4. Создайте резервную копию schema.prisma
cp prisma/schema.prisma prisma/schema.prisma.backup.$(date +%Y%m%d_%H%M%S)

# 5. Замените schema.prisma на новую версию
# (скопируйте содержимое schema_full_updated.prisma)
nano prisma/schema.prisma

# 6. Создайте миграцию
npx prisma migrate dev --name add_online_editor_tables

# 7. Обновите лимиты хранилища для существующих лицензий
# Подключитесь к PostgreSQL и выполните SQL из update_storage_limits.sql
psql -h <host> -p <port> -U <user> -d <database> < /tmp/update_storage_limits.sql

# 8. Регенерируйте Prisma Client
npx prisma generate
```

---

## 🔄 После применения миграции

### 1. Пересборка server

```bash
cd /opt/kiosk/kiosk-content-platform/packages/server

# Пересоберите TypeScript
npm run build

# Проверьте что компиляция прошла успешно
ls -la dist/
```

### 2. Перезапуск License Server

```bash
# Перезапустите сервис
systemctl restart kiosk-license-server

# Проверьте статус
systemctl status kiosk-license-server

# Проверьте логи
journalctl -u kiosk-license-server -n 50 --no-pager
```

### 3. Проверка работоспособности

```bash
# 1. Health check
curl http://localhost:3001/health

# 2. Проверка подключения к БД (должен вернуть список лицензий)
curl -X POST http://localhost:3001/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@kiosk.local","password":"Admin123!"}' | jq .

# Сохраните токен из ответа
TOKEN="<your-token>"

# 3. Получите список лицензий (должен содержать storageLimit)
curl http://localhost:3001/api/admin/licenses \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Ожидаемый результат:**
- Каждая лицензия имеет поле `storageLimit`
- BASIC: 524288000
- PRO: 1572864000
- MAX: 3145728000

---

## 🐛 Решение проблем

### Ошибка: "Argument missing"

**Причина:** Не все поля заполнены при создании миграции

**Решение:**
```bash
# Проверьте schema.prisma на ошибки
npx prisma validate

# Если есть ошибки, исправьте и повторите миграцию
npx prisma migrate dev --name add_online_editor_tables
```

### Ошибка: "Cannot find module @prisma/client"

**Причина:** Prisma Client не регенерирован

**Решение:**
```bash
cd /opt/kiosk/kiosk-content-platform/packages/server
npx prisma generate
npm run build
systemctl restart kiosk-license-server
```

### License Server не стартует

**Проверьте:**

1. **Логи сервиса:**
   ```bash
   journalctl -u kiosk-license-server -n 100 --no-pager
   ```

2. **Компиляция TypeScript:**
   ```bash
   cd /opt/kiosk/kiosk-content-platform/packages/server
   npm run build
   ```

3. **Подключение к БД:**
   ```bash
   export $(cat .env | grep -v '^#' | xargs)
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM licenses;"
   ```

---

## ✅ Контрольный список

Перед применением:
- [ ] Создан бэкап базы данных
- [ ] Создана резервная копия schema.prisma
- [ ] License Server остановлен (systemctl stop kiosk-license-server)

После применения:
- [ ] Миграция выполнена без ошибок
- [ ] Prisma Client регенерирован
- [ ] TypeScript код скомпилирован
- [ ] License Server запущен и работает
- [ ] Health check проходит успешно
- [ ] Лицензии содержат поле storageLimit
- [ ] Новые таблицы созданы (user_profiles, projects, project_files)

---

## 📊 Проверка структуры БД

```bash
# Подключитесь к PostgreSQL
export $(cat /opt/kiosk/kiosk-content-platform/packages/server/.env | grep -v '^#' | xargs)
psql $DATABASE_URL

# Проверьте новые таблицы
\dt

# Должны быть видны:
# - user_profiles
# - projects
# - project_files

# Проверьте структуру таблицы projects
\d projects

# Проверьте лимиты хранилища
SELECT plan, "storageLimit", ROUND("storageLimit" / 1048576.0, 2) as storage_mb FROM licenses;

# Выход
\q
```

---

## 📝 Откат изменений (если что-то пошло не так)

### Способ 1: Откат через Prisma

```bash
cd /opt/kiosk/kiosk-content-platform/packages/server

# Посмотрите список миграций
npx prisma migrate status

# Откатите последнюю миграцию
npx prisma migrate resolve --rolled-back add_online_editor_tables

# Восстановите старую schema
cp prisma/schema.prisma.backup.* prisma/schema.prisma

# Регенерируйте клиент
npx prisma generate
```

### Способ 2: Восстановление из бэкапа

```bash
cd /opt/kiosk/kiosk-content-platform/packages/server

# Остановите License Server
systemctl stop kiosk-license-server

# Восстановите из бэкапа
export $(cat .env | grep -v '^#' | xargs)
psql $DATABASE_URL < backups/backup_YYYYMMDD_HHMMSS.sql

# Восстановите старую schema
cp prisma/schema.prisma.backup.* prisma/schema.prisma

# Регенерируйте клиент
npx prisma generate

# Пересоберите
npm run build

# Запустите License Server
systemctl start kiosk-license-server
```

---

## 🎯 Следующий шаг: Фаза 2

После успешного применения миграции, следующие шаги:

1. **Создание API эндпоинтов** для работы с проектами
2. **Реализация загрузки файлов** (multer + storage)
3. **Аутентификация клиентов** по лицензии
4. **Middleware** для проверки лимитов хранилища

Это будет выполнено в следующей итерации.

---

## 📞 Поддержка

Если возникли проблемы:

1. Сохраните логи:
   ```bash
   journalctl -u kiosk-license-server -n 500 > /tmp/license_server_logs.txt
   ```

2. Проверьте статус БД:
   ```bash
   npx prisma migrate status > /tmp/migration_status.txt
   ```

3. Загрузите это резюме и логи в новый чат для диагностики

---

**Конец инструкции**
