# 🔍 Команды для диагностики проблемы

Выполните эти команды на вашем сервере по порядку:

## 1. Проверьте статус сервера
```bash
systemctl status kiosk-server
```

## 2. Посмотрите логи (последние 50 строк)
```bash
journalctl -u kiosk-server -n 50
```

## 3. Проверьте health endpoint с подробностями
```bash
curl -v http://localhost:3001/api/health
```

## 4. Проверьте реальный ответ от templates API
```bash
curl -v -X POST http://localhost:3001/api/templates \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","description":"Test","category":"test","data":{"name":"Test","canvas":{"width":1920,"height":1080}}}'
```

## 5. Запустите скрипт диагностики
```bash
chmod +x diagnose-api.sh
./diagnose-api.sh
```

## 6. Проверьте файлы routes
```bash
ls -la src/routes/
cat src/routes/templates.js | head -30
```

## 7. Проверьте базу данных
```bash
ls -la data/
sqlite3 data/kiosk.db '.tables'
sqlite3 data/kiosk.db 'SELECT * FROM templates;'
```

---

## Наиболее вероятные проблемы:

### Проблема 1: Неправильная структура ответа API
**Симптом:** `jq: parse error: Invalid numeric literal`
**Причина:** API возвращает не JSON или неправильный формат
**Решение:** Проверить src/routes/templates.js

### Проблема 2: API возвращает HTML вместо JSON
**Симптом:** `Cannot index array with string`
**Причина:** Сервер отдает HTML (например, страницу ошибки)
**Решение:** Проверить логи сервера

### Проблема 3: CORS или middleware проблема
**Симптом:** Пустые ответы
**Причина:** Запросы блокируются middleware
**Решение:** Проверить src/index.js на настройки CORS

---

## Быстрая проверка - выполните это:

```bash
# Одной командой - проверка всего
echo "=== Health Check ==="
curl -s http://localhost:3001/api/health | jq .

echo ""
echo "=== Templates List ==="
curl -s http://localhost:3001/api/templates | jq .

echo ""
echo "=== Create Template ==="
curl -s -X POST http://localhost:3001/api/templates \
  -H "Content-Type: application/json" \
  -d '{"name":"Quick Test","description":"Test","category":"test","data":{"name":"Test","canvas":{"width":1920,"height":1080}}}' | jq .
```

Скопируйте вывод этих команд и отправьте мне результат!
