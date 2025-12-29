# ⚡ Быстрый старт Kiosk Server v3.0

## 🎯 5 минут до запуска

### Шаг 1: Проверка требований

```bash
# Node.js 18+
node --version  # Должно быть v18.x или выше

# Если нет, установите:
# Ubuntu: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs
# Windows: https://nodejs.org/
```

---

### Шаг 2: Распаковка

```bash
# Распакуйте архив
unzip kiosk-content-platform.zip
cd kiosk-content-platform/packages/server
```

---

### Шаг 3: Установка зависимостей

```bash
npm install
```

Время: ~1-2 минуты

---

### Шаг 4: Настройка

```bash
# Создайте .env из примера
cp .env.example .env

# Windows:
# copy .env.example .env
```

**Отредактируйте .env** (опционально):

```env
PORT=3001
HOST=0.0.0.0
DATABASE_PATH=./data/kiosk.db
MEDIA_PATH=./data/media
JWT_SECRET=change-me-in-production
CORS_ORIGIN=*
```

---

### Шаг 5: Запуск

```bash
npm start
```

**Результат:**

```
╔═══════════════════════════════════════════════╗
║   🚀 KIOSK CONTENT PLATFORM SERVER v3.0      ║
╚═══════════════════════════════════════════════╝

📡 Server running on: http://0.0.0.0:3001
🗄️  Database: ./data/kiosk.db
📁 Media path: ./data/media
```

---

### Шаг 6: Проверка

Откройте браузер:

```
http://localhost:3001/api/health
```

Должны увидеть:

```json
{
  "status": "ok",
  "version": "3.0.0",
  "uptime": 5.123
}
```

✅ **Готово!** Сервер работает!

---

## 🧪 Быстрый тест

```bash
# API тест
./test-server.sh

# WebSocket тест
node test-websocket.js

# Мониторинг
./monitor.sh
```

---

## 📚 Что дальше?

### 1. Для разработки:

```bash
# Запуск с автоперезагрузкой
npm run dev
```

### 2. Для production (Ubuntu):

```bash
# Установка как systemd service
sudo nano /etc/systemd/system/kiosk-server.service

# Запуск
sudo systemctl start kiosk-server
sudo systemctl enable kiosk-server
```

См. **DEPLOYMENT-GUIDE.md** для подробностей

### 3. Интеграция с Editor:

- Откройте Editor
- Settings → Server URL: `http://localhost:3001`
- Готово к использованию Templates, Media, Devices

---

## ⚙️ Полезные команды

```bash
# Статус сервера
curl http://localhost:3001/api/health

# Список шаблонов
curl http://localhost:3001/api/templates

# Список устройств
curl http://localhost:3001/api/devices

# Логи (если systemd)
sudo journalctl -u kiosk-server -f

# Перезапуск
sudo systemctl restart kiosk-server
```

---

## 🔧 Troubleshooting

### Проблема: "Port 3001 already in use"

```bash
# Найти процесс
lsof -i :3001

# Убить процесс
kill -9 PID

# Или измените PORT в .env
```

### Проблема: "Cannot find module"

```bash
# Переустановите зависимости
rm -rf node_modules package-lock.json
npm install
```

### Проблема: "EACCES: permission denied"

```bash
# Дайте права на директорию data
sudo chown -R $USER:$USER data/
```

---

## 📞 Нужна помощь?

1. **Полная документация:** DEPLOYMENT-GUIDE.md
2. **API документация:** packages/server/README.md
3. **Тесты:** `./test-server.sh`

---

**Версия:** 3.0.0  
**Время установки:** ~5 минут  
**Сложность:** ⭐⭐☆☆☆ (Легко)

🎉 **Успешного запуска!**
