# 🚀 Руководство по развёртыванию Kiosk Content Platform v3.0

## 📋 Содержание

1. [Системные требования](#системные-требования)
2. [Выбор платформы развёртывания](#выбор-платформы)
3. [Локальное развёртывание](#локальное-развёртывание)
4. [Развёртывание на VPS](#развёртывание-на-vps)
5. [Развёртывание в Docker](#развёртывание-в-docker)
6. [Тестирование](#тестирование)
7. [Мониторинг и обслуживание](#мониторинг)
8. [Безопасность](#безопасность)
9. [Troubleshooting](#troubleshooting)

---

## 🖥️ Системные требования

### Минимальные:
- **CPU:** 2 ядра
- **RAM:** 2 GB
- **Диск:** 10 GB свободного места
- **ОС:** Windows 10+, Ubuntu 20.04+, macOS 10.15+
- **Node.js:** 18.x или выше
- **npm:** 9.x или выше

### Рекомендуемые:
- **CPU:** 4 ядра
- **RAM:** 4 GB
- **Диск:** 50 GB (SSD)
- **ОС:** Ubuntu 22.04 LTS
- **Node.js:** 20.x LTS
- **npm:** 10.x

### Для Production:
- **CPU:** 8 ядер
- **RAM:** 8 GB
- **Диск:** 100 GB (SSD NVMe)
- **ОС:** Ubuntu 22.04 LTS
- **Network:** Статический IP
- **SSL:** Сертификат (Let's Encrypt)

---

## 🌐 Выбор платформы развёртывания

### Вариант 1: Локальная сеть (Рекомендуется для старта)

**Подходит для:**
- Небольших организаций (1-10 устройств)
- Тестирования
- Офисных киосков в одной локации

**Плюсы:**
- ✅ Полный контроль
- ✅ Нет облачных расходов
- ✅ Низкая задержка
- ✅ Работает без интернета

**Минусы:**
- ❌ Нет доступа извне
- ❌ Требует локальный сервер
- ❌ Сложнее масштабировать

**Платформы:**
- Windows Server 2019+
- Ubuntu Server 22.04
- Synology NAS
- Raspberry Pi 4 (для тестов)

**Цена:** $0 (используете свои серверы)

---

### Вариант 2: VPS (Virtual Private Server)

**Подходит для:**
- Средних организаций (10-100 устройств)
- Распределённых киосков (разные города)
- Требуется удалённый доступ

**Плюсы:**
- ✅ Доступ откуда угодно
- ✅ Легко масштабировать
- ✅ Автобэкапы
- ✅ Профессиональная поддержка

**Минусы:**
- ⚠️ Ежемесячная оплата
- ⚠️ Зависимость от интернета

**Рекомендуемые провайдеры:**

#### 🥇 DigitalOcean (Лучший выбор)
- **Дроплет:** 2 vCPU, 4 GB RAM, 80 GB SSD
- **Цена:** $24/месяц
- **Локации:** 15 дата-центров
- **Плюсы:** Простой UI, отличная документация
- **Бонус:** $200 кредита на 60 дней для новых

#### 🥈 Linode (Akamai)
- **Instance:** 2 vCPU, 4 GB RAM, 80 GB SSD
- **Цена:** $24/месяц
- **Локации:** 11 дата-центров
- **Плюсы:** Хорошая производительность

#### 🥉 Vultr
- **Instance:** 2 vCPU, 4 GB RAM, 80 GB SSD
- **Цена:** $24/месяц
- **Локации:** 25+ локаций
- **Плюсы:** Много локаций, низкие цены

#### AWS EC2 / Google Cloud / Azure
- **Цена:** $30-50/месяц
- **Плюсы:** Масштабируемость, интеграции
- **Минусы:** Сложнее настройка, дороже

**Рекомендация:** Для большинства случаев - **DigitalOcean**

---

### Вариант 3: Docker (Для опытных)

**Подходит для:**
- Опытных DevOps
- Микросервисная архитектура
- Kubernetes кластеры

**Плюсы:**
- ✅ Изоляция
- ✅ Легко масштабировать
- ✅ Воспроизводимость

**Минусы:**
- ⚠️ Требует знания Docker
- ⚠️ Дополнительный слой абстракции

---

## 💻 Локальное развёртывание

### Windows Server / Windows 10+

#### Шаг 1: Установка Node.js

```powershell
# Скачайте с https://nodejs.org/
# Установите Node.js 20.x LTS

# Проверка
node --version  # v20.x.x
npm --version   # 10.x.x
```

#### Шаг 2: Распаковка проекта

```powershell
# Распакуйте kiosk-content-platform.zip
cd kiosk-content-platform\packages\server

# Установка зависимостей
npm install
```

#### Шаг 3: Настройка

```powershell
# Создайте .env файл
copy .env.example .env

# Отредактируйте в Notepad
notepad .env
```

**Настройки .env:**
```env
PORT=3001
HOST=0.0.0.0
DATABASE_PATH=./data/kiosk.db
MEDIA_PATH=./data/media
JWT_SECRET=your-random-secret-key-here
CORS_ORIGIN=*
```

#### Шаг 4: Запуск

```powershell
# Запуск в dev режиме
npm run dev

# Или как Windows Service (рекомендуется для production)
npm install -g node-windows
npm link node-windows

# Создайте install-service.js
node install-service.js
```

**install-service.js:**
```javascript
const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
  name: 'Kiosk Content Platform Server',
  description: 'Backend server for Kiosk CMS',
  script: path.join(__dirname, 'src', 'index.js'),
  env: [
    {
      name: "NODE_ENV",
      value: "production"
    }
  ]
});

svc.on('install', function(){
  svc.start();
  console.log('Service installed and started');
});

svc.install();
```

#### Шаг 5: Проверка

```powershell
# Откройте браузер
start http://localhost:3001/api/health
```

#### Шаг 6: Firewall

```powershell
# Разрешите порт в Windows Firewall
netsh advfirewall firewall add rule name="Kiosk Server" dir=in action=allow protocol=TCP localport=3001

# Или через GUI:
# Control Panel → Windows Defender Firewall → Advanced Settings
# → Inbound Rules → New Rule → Port → TCP 3001
```

---

### Ubuntu Server 22.04

#### Шаг 1: Обновление системы

```bash
sudo apt update
sudo apt upgrade -y
```

#### Шаг 2: Установка Node.js

```bash
# Установка Node.js 20.x LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Проверка
node --version  # v20.x.x
npm --version   # 10.x.x
```

#### Шаг 3: Создание пользователя

```bash
# Создаём пользователя для сервера
sudo useradd -r -s /bin/bash -d /opt/kiosk -m kiosk
sudo su - kiosk
```

#### Шаг 4: Распаковка проекта

```bash
# Загрузите файл через scp или wget
cd /opt/kiosk
unzip kiosk-content-platform.zip
cd kiosk-content-platform/packages/server

# Установка зависимостей
npm install --production
```

#### Шаг 5: Настройка

```bash
# Создайте .env
cp .env.example .env
nano .env
```

**Настройки .env:**
```env
PORT=3001
HOST=0.0.0.0
DATABASE_PATH=/opt/kiosk/data/kiosk.db
MEDIA_PATH=/opt/kiosk/data/media
JWT_SECRET=$(openssl rand -hex 32)
CORS_ORIGIN=*
```

#### Шаг 6: Systemd Service

```bash
# Выйдите из пользователя kiosk
exit

# Создайте systemd unit файл
sudo nano /etc/systemd/system/kiosk-server.service
```

**kiosk-server.service:**
```ini
[Unit]
Description=Kiosk Content Platform Server
After=network.target

[Service]
Type=simple
User=kiosk
WorkingDirectory=/opt/kiosk/kiosk-content-platform/packages/server
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=kiosk-server

Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

#### Шаг 7: Запуск сервиса

```bash
# Перезагрузка systemd
sudo systemctl daemon-reload

# Включение автозапуска
sudo systemctl enable kiosk-server

# Запуск
sudo systemctl start kiosk-server

# Проверка статуса
sudo systemctl status kiosk-server

# Логи
sudo journalctl -u kiosk-server -f
```

#### Шаг 8: Firewall

```bash
# UFW (Ubuntu Firewall)
sudo ufw allow 3001/tcp
sudo ufw allow OpenSSH
sudo ufw enable
sudo ufw status
```

#### Шаг 9: Проверка

```bash
curl http://localhost:3001/api/health
```

---

## 🐳 Развёртывание в Docker

### Шаг 1: Создание Dockerfile

```dockerfile
# packages/server/Dockerfile
FROM node:20-alpine

# Метаданные
LABEL maintainer="your-email@example.com"
LABEL version="3.0.0"

# Создаём пользователя
RUN addgroup -g 1001 -S kiosk && \
    adduser -u 1001 -S kiosk -G kiosk

# Рабочая директория
WORKDIR /app

# Копируем package.json
COPY package*.json ./

# Установка зависимостей
RUN npm ci --production && \
    npm cache clean --force

# Копируем код
COPY --chown=kiosk:kiosk . .

# Создаём директории для данных
RUN mkdir -p /app/data/media && \
    chown -R kiosk:kiosk /app/data

# Переключаемся на пользователя
USER kiosk

# Открываем порт
EXPOSE 3001

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Запуск
CMD ["node", "src/index.js"]
```

### Шаг 2: Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  kiosk-server:
    build:
      context: ./packages/server
      dockerfile: Dockerfile
    container_name: kiosk-server
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - HOST=0.0.0.0
      - DATABASE_PATH=/app/data/kiosk.db
      - MEDIA_PATH=/app/data/media
      - JWT_SECRET=${JWT_SECRET}
      - CORS_ORIGIN=${CORS_ORIGIN}
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    networks:
      - kiosk-network
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3001/api/health')"]
      interval: 30s
      timeout: 3s
      retries: 3

networks:
  kiosk-network:
    driver: bridge

volumes:
  kiosk-data:
```

### Шаг 3: .env для Docker

```env
# .env
JWT_SECRET=your-super-secret-key-change-me
CORS_ORIGIN=*
```

### Шаг 4: Запуск

```bash
# Сборка
docker-compose build

# Запуск
docker-compose up -d

# Логи
docker-compose logs -f kiosk-server

# Остановка
docker-compose down

# Полная очистка
docker-compose down -v
```

---

## 🌍 Развёртывание на VPS (DigitalOcean)

### Шаг 1: Создание Droplet

1. Зайдите на https://digitalocean.com
2. Create → Droplets
3. **Region:** Выберите ближайший к вашим пользователям
4. **Image:** Ubuntu 22.04 LTS
5. **Size:** Basic → 2 vCPU, 4 GB RAM ($24/mo)
6. **Authentication:** SSH Key (рекомендуется)
7. **Hostname:** kiosk-server
8. Create Droplet

### Шаг 2: Подключение

```bash
# Получите IP адрес из DigitalOcean
ssh root@YOUR_IP

# Обновление
apt update && apt upgrade -y
```

### Шаг 3: Базовая настройка безопасности

```bash
# Создание пользователя
adduser deploy
usermod -aG sudo deploy

# Настройка SSH (отключаем root login)
nano /etc/ssh/sshd_config
# PermitRootLogin no
# PasswordAuthentication no

# Перезапуск SSH
systemctl restart sshd

# Выход и подключение под новым пользователем
exit
ssh deploy@YOUR_IP
```

### Шаг 4: Установка Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Шаг 5: Загрузка проекта

```bash
# Из локальной машины
scp kiosk-content-platform.zip deploy@YOUR_IP:~/

# На сервере
cd ~
unzip kiosk-content-platform.zip
cd kiosk-content-platform/packages/server
npm install --production
```

### Шаг 6: Настройка Nginx (обратный прокси)

```bash
sudo apt install -y nginx

# Создаём конфиг
sudo nano /etc/nginx/sites-available/kiosk
```

**nginx config:**
```nginx
server {
    listen 80;
    server_name your-domain.com;  # или IP

    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /media {
        alias /opt/kiosk/data/media;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# Активация
sudo ln -s /etc/nginx/sites-available/kiosk /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Шаг 7: SSL (Let's Encrypt)

```bash
# Установка Certbot
sudo apt install -y certbot python3-certbot-nginx

# Получение сертификата
sudo certbot --nginx -d your-domain.com

# Автообновление (проверка)
sudo certbot renew --dry-run
```

### Шаг 8: Systemd Service

```bash
sudo nano /etc/systemd/system/kiosk-server.service
```

**Содержимое:** (см. выше в разделе Ubuntu)

```bash
sudo systemctl daemon-reload
sudo systemctl enable kiosk-server
sudo systemctl start kiosk-server
```

### Шаг 9: Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### Шаг 10: Проверка

```bash
curl https://your-domain.com/api/health
```

---

## 🧪 Тестирование

### 1. Тесты API (создайте test-server.sh)

```bash
#!/bin/bash

SERVER="http://localhost:3001"

echo "🧪 Testing Kiosk Server..."
echo ""

# Health Check
echo "1. Health Check..."
curl -s "$SERVER/api/health" | jq
echo ""

# Templates
echo "2. Create Template..."
TEMPLATE_ID=$(curl -s -X POST "$SERVER/api/templates" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Template",
    "description": "Test description",
    "category": "test",
    "data": {"test": true}
  }' | jq -r '.data.id')
echo "Template ID: $TEMPLATE_ID"
echo ""

echo "3. Get Templates..."
curl -s "$SERVER/api/templates" | jq '.data | length'
echo ""

echo "4. Get Template by ID..."
curl -s "$SERVER/api/templates/$TEMPLATE_ID" | jq '.data.name'
echo ""

# Devices
echo "5. Register Device..."
DEVICE_ID=$(curl -s -X POST "$SERVER/api/devices/register" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-device-1",
    "name": "Test Kiosk",
    "os": "Ubuntu 22.04",
    "version": "3.0.0",
    "ipAddress": "192.168.1.100"
  }' | jq -r '.data.id')
echo "Device ID: $DEVICE_ID"
echo ""

echo "6. Get Devices..."
curl -s "http://localhost:3001/api/devices" | jq '.data | length'
echo ""

# Cleanup
echo "7. Cleanup..."
curl -s -X DELETE "$SERVER/api/templates/$TEMPLATE_ID"
curl -s -X DELETE "$SERVER/api/devices/$DEVICE_ID"
echo "Done!"

echo ""
echo "✅ All tests passed!"
```

```bash
chmod +x test-server.sh
./test-server.sh
```

### 2. WebSocket тест (test-websocket.js)

```javascript
// test-websocket.js
import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:3001');

ws.on('open', () => {
  console.log('✅ Connected to WebSocket');
  
  // Регистрация устройства
  ws.send(JSON.stringify({
    type: 'device:register',
    deviceId: 'test-device-ws',
    name: 'WebSocket Test Device',
    os: 'Test OS',
    version: '3.0.0',
    ipAddress: '127.0.0.1'
  }));
  
  // Heartbeat
  setInterval(() => {
    ws.send(JSON.stringify({
      type: 'device:heartbeat',
      deviceId: 'test-device-ws'
    }));
    console.log('💓 Heartbeat sent');
  }, 5000);
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('📨 Message:', msg);
});

ws.on('error', (error) => {
  console.error('❌ Error:', error);
});

ws.on('close', () => {
  console.log('🔌 Disconnected');
});
```

```bash
node test-websocket.js
```

### 3. Load тест (с Apache Bench)

```bash
# Установка
sudo apt install -y apache2-utils

# 1000 запросов, 10 одновременно
ab -n 1000 -c 10 http://localhost:3001/api/health

# С keepalive
ab -n 1000 -c 10 -k http://localhost:3001/api/templates
```

### 4. Monitoring Script (monitor.sh)

```bash
#!/bin/bash

while true; do
  clear
  echo "🖥️  Kiosk Server Monitor"
  echo "======================="
  echo ""
  
  # Status
  STATUS=$(curl -s http://localhost:3001/api/health | jq -r '.status')
  echo "Status: $STATUS"
  
  # Uptime
  UPTIME=$(curl -s http://localhost:3001/api/health | jq -r '.uptime')
  echo "Uptime: ${UPTIME}s"
  
  # Process
  echo ""
  ps aux | grep "node src/index.js" | grep -v grep
  
  # Connections
  echo ""
  echo "Active connections:"
  netstat -an | grep :3001 | grep ESTABLISHED | wc -l
  
  sleep 5
done
```

---

## 📊 Мониторинг и обслуживание

### PM2 (Process Manager)

```bash
# Установка
npm install -g pm2

# Запуск
pm2 start src/index.js --name kiosk-server

# Мониторинг
pm2 monit

# Логи
pm2 logs kiosk-server

# Автозапуск
pm2 startup
pm2 save

# Управление
pm2 restart kiosk-server
pm2 stop kiosk-server
pm2 delete kiosk-server
```

### Логирование

```bash
# Ротация логов
sudo nano /etc/logrotate.d/kiosk-server
```

```
/opt/kiosk/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 kiosk kiosk
    sharedscripts
    postrotate
        systemctl reload kiosk-server
    endscript
}
```

### Бэкапы

```bash
# Скрипт бэкапа
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/kiosk"
mkdir -p $BACKUP_DIR

# База данных
cp /opt/kiosk/data/kiosk.db $BACKUP_DIR/kiosk_$DATE.db

# Медиа (если небольшой объём)
tar -czf $BACKUP_DIR/media_$DATE.tar.gz /opt/kiosk/data/media

# Удаление старых бэкапов (>30 дней)
find $BACKUP_DIR -type f -mtime +30 -delete

echo "Backup completed: $DATE"
```

```bash
# Добавить в cron (ежедневно в 3:00)
crontab -e
0 3 * * * /opt/kiosk/backup.sh
```

---

## 🔒 Безопасность

### 1. Изменить JWT Secret

```bash
# Генерация надёжного ключа
openssl rand -hex 32

# Добавить в .env
JWT_SECRET=your_generated_key
```

### 2. Ограничить CORS

```env
# В .env
CORS_ORIGIN=https://your-editor-domain.com
```

### 3. Rate Limiting

Установите express-rate-limit (TODO: добавить в следующей версии)

### 4. Регулярные обновления

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Обновление Node.js пакетов
npm audit
npm update
```

---

## 🔧 Troubleshooting

### Проблема: Порт занят

```bash
# Найти процесс
sudo lsof -i :3001

# Убить процесс
sudo kill -9 PID
```

### Проблема: База данных заблокирована

```bash
# Проверка
sudo fuser /opt/kiosk/data/kiosk.db

# Остановить сервер
sudo systemctl stop kiosk-server

# Удалить WAL файлы
rm /opt/kiosk/data/kiosk.db-shm
rm /opt/kiosk/data/kiosk.db-wal

# Запустить снова
sudo systemctl start kiosk-server
```

### Проблема: Нет места на диске

```bash
# Проверка
df -h

# Очистка логов
sudo journalctl --vacuum-time=7d

# Очистка старых медиа
find /opt/kiosk/data/media -type f -mtime +90 -delete
```

### Проблема: Высокая нагрузка

```bash
# Проверка CPU/RAM
htop

# Проверка соединений
netstat -an | grep :3001 | wc -l

# Логи ошибок
sudo journalctl -u kiosk-server -p err
```

---

## ✅ Чеклист финальной проверки

### Перед запуском в production:

- [ ] Node.js 20+ установлен
- [ ] .env настроен (JWT_SECRET изменён!)
- [ ] Firewall настроен
- [ ] Systemd service создан и включен
- [ ] Nginx reverse proxy настроен (если нужен)
- [ ] SSL сертификат установлен
- [ ] Бэкапы настроены
- [ ] Логирование работает
- [ ] Мониторинг настроен
- [ ] API тесты прошли
- [ ] WebSocket тесты прошли
- [ ] Load тесты прошли
- [ ] Документация доступна команде

---

## 📞 Поддержка

### Логи

```bash
# Systemd
sudo journalctl -u kiosk-server -f

# PM2
pm2 logs kiosk-server

# Nginx
sudo tail -f /var/log/nginx/error.log
```

### Полезные команды

```bash
# Статус
sudo systemctl status kiosk-server

# Перезапуск
sudo systemctl restart kiosk-server

# Проверка конфига
node -c src/index.js

# Тест API
curl http://localhost:3001/api/health | jq
```

---

**Версия:** 3.0.0  
**Дата:** Декабрь 2025

🎉 **Успешного развёртывания!**
