# 📘 Пошаговая инструкция по установке Kiosk Content Platform v3.0

## 🎯 Обзор

Эта инструкция проведет вас через установку всех трех компонентов:
1. **Server** (Backend) - на VPS/сервере
2. **Editor** (Редактор) - на компьютере администратора
3. **Player** (Плеер) - на устройствах для отображения

**Время установки:** 30-60 минут

---

# 🖥️ ЧАСТЬ 1: Установка Server (на VPS/сервере)

## Требования:
- Ubuntu 22.04 / Windows Server 2019+
- 2GB RAM (минимум)
- 10GB свободного места
- Права администратора

---

## 📍 Вариант A: Ubuntu Server 22.04 (Рекомендуется)

### Шаг 1: Подключитесь к серверу

```bash
ssh root@YOUR_SERVER_IP
```

### Шаг 2: Обновите систему

```bash
sudo apt update
sudo apt upgrade -y
```

### Шаг 3: Установите Node.js 20.x

```bash
# Добавьте репозиторий NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Установите Node.js
sudo apt install -y nodejs

# Проверьте версию
node --version  # Должно быть v20.x.x
npm --version   # Должно быть 10.x.x
```

### Шаг 4: Создайте пользователя для приложения

```bash
# Создайте пользователя kiosk
sudo useradd -m -s /bin/bash kiosk

# Создайте директорию для приложения
sudo mkdir -p /opt/kiosk
sudo chown -R kiosk:kiosk /opt/kiosk
```

### Шаг 5: Загрузите архив на сервер

**Вариант 1: Через SCP (с вашего компьютера):**
```bash
scp kiosk-content-platform-v3.0-integrated.tar.gz root@YOUR_SERVER_IP:/tmp/
```

**Вариант 2: Через wget (если архив доступен онлайн):**
```bash
wget https://YOUR_URL/kiosk-content-platform-v3.0-integrated.tar.gz -O /tmp/kiosk.tar.gz
```

### Шаг 6: Распакуйте архив

```bash
# Перейдите в директорию
cd /opt/kiosk

# Распакуйте
sudo tar -xzf /tmp/kiosk-content-platform-v3.0-integrated.tar.gz

# Переместите содержимое
sudo mv kiosk-content-platform/* .
sudo rm -rf kiosk-content-platform

# Установите владельца
sudo chown -R kiosk:kiosk /opt/kiosk
```

### Шаг 7: Установите зависимости

```bash
# Перейдите в директорию server
cd /opt/kiosk/packages/server

# Установите зависимости
sudo -u kiosk npm install --production

# Если возникает ошибка "Killed", создайте SWAP:
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Попробуйте снова
sudo -u kiosk npm install --production
```

### Шаг 8: Настройте конфигурацию

```bash
# Создайте .env файл
sudo -u kiosk cp .env.example .env

# Сгенерируйте секретный ключ
JWT_SECRET=$(openssl rand -hex 32)

# Отредактируйте .env
sudo nano .env
```

**Содержимое .env:**
```env
# Server Configuration
PORT=3001
HOST=0.0.0.0

# Security
JWT_SECRET=ВАШ_СГЕНЕРИРОВАННЫЙ_КЛЮЧ_ЗДЕСЬ
CORS_ORIGIN=*

# Database
DATABASE_PATH=./data/kiosk.db

# Media Storage
MEDIA_PATH=./data/media
MAX_FILE_SIZE=104857600

# Logging
LOG_LEVEL=info
```

**Сохраните:** `Ctrl+O`, Enter, `Ctrl+X`

### Шаг 9: Создайте директории для данных

```bash
sudo -u kiosk mkdir -p /opt/kiosk/packages/server/data
sudo -u kiosk mkdir -p /opt/kiosk/packages/server/data/media
```

### Шаг 10: Создайте systemd service

```bash
sudo nano /etc/systemd/system/kiosk-server.service
```

**Содержимое файла:**
```ini
[Unit]
Description=Kiosk Content Platform Server
After=network.target

[Service]
Type=simple
User=kiosk
Group=kiosk
WorkingDirectory=/opt/kiosk/packages/server
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

**Сохраните:** `Ctrl+O`, Enter, `Ctrl+X`

### Шаг 11: Запустите сервер

```bash
# Перезагрузите systemd
sudo systemctl daemon-reload

# Включите автозапуск
sudo systemctl enable kiosk-server

# Запустите сервер
sudo systemctl start kiosk-server

# Проверьте статус
sudo systemctl status kiosk-server
```

**Должно быть:**
```
● kiosk-server.service - Kiosk Content Platform Server
     Loaded: loaded
     Active: active (running)
```

### Шаг 12: Проверьте работу API

```bash
curl http://localhost:3001/api/health
```

**Ожидаемый ответ:**
```json
{"status":"ok","version":"3.0.0","uptime":5.123}
```

### Шаг 13: Настройте Firewall

```bash
# Разрешите порт 3001
sudo ufw allow 3001/tcp

# Разрешите SSH (если еще не разрешен)
sudo ufw allow ssh

# Включите firewall
sudo ufw enable

# Проверьте статус
sudo ufw status
```

### Шаг 14: (Опционально) Установите Nginx

```bash
# Установите Nginx
sudo apt install -y nginx

# Создайте конфигурацию
sudo nano /etc/nginx/sites-available/kiosk
```

**Содержимое:**
```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;

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
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
```

```bash
# Активируйте конфигурацию
sudo ln -s /etc/nginx/sites-available/kiosk /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# Откройте порт 80
sudo ufw allow 80/tcp
```

### Шаг 15: Запустите тесты

```bash
cd /opt/kiosk/packages/server

# Сделайте скрипты исполняемыми
chmod +x test-server.sh
chmod +x e2e-test.sh
chmod +x generate-test-data.sh

# Запустите API тесты
./test-server.sh

# Создайте тестовые данные
./generate-test-data.sh
```

### ✅ Server установлен!

**Ваш сервер доступен по адресу:**
- Прямой доступ: `http://YOUR_IP:3001`
- Через Nginx: `http://YOUR_IP`

**Проверьте:**
```bash
# С другого компьютера
curl http://YOUR_IP:3001/api/health
# или
curl http://YOUR_IP/api/health
```

---

## 📍 Вариант B: Windows Server

### Шаг 1: Установите Node.js

1. Скачайте Node.js 20.x LTS: https://nodejs.org/
2. Запустите установщик
3. Следуйте инструкциям (оставьте все по умолчанию)
4. Перезагрузите компьютер

### Шаг 2: Проверьте установку

```powershell
node --version
npm --version
```

### Шаг 3: Создайте директорию

```powershell
# Создайте папку
mkdir C:\kiosk
cd C:\kiosk
```

### Шаг 4: Распакуйте архив

1. Скопируйте `kiosk-content-platform-v3.0-integrated.zip` в `C:\kiosk`
2. Правый клик → Извлечь всё
3. Переместите содержимое в `C:\kiosk`

### Шаг 5: Установите зависимости

```powershell
cd C:\kiosk\packages\server
npm install
```

### Шаг 6: Настройте конфигурацию

```powershell
# Скопируйте example файл
copy .env.example .env

# Откройте в блокноте
notepad .env
```

Измените `JWT_SECRET` на случайную строку (32+ символов)

### Шаг 7: Запустите сервер

```powershell
npm start
```

### Шаг 8: Установите как Windows Service (опционально)

```powershell
# Установите node-windows
npm install -g node-windows

# Создайте скрипт установки service
notepad install-service.js
```

**Содержимое install-service.js:**
```javascript
var Service = require('node-windows').Service;

var svc = new Service({
  name: 'Kiosk Server',
  description: 'Kiosk Content Platform Server',
  script: 'C:\\kiosk\\packages\\server\\src\\index.js'
});

svc.on('install', function(){
  svc.start();
});

svc.install();
```

```powershell
# Запустите установку (от имени администратора)
node install-service.js
```

### Шаг 9: Настройте Firewall

1. Откройте "Брандмауэр Windows"
2. Дополнительные параметры
3. Правила для входящих подключений → Создать правило
4. Тип: Порт → Далее
5. TCP, порт 3001 → Далее
6. Разрешить подключение → Далее
7. Применить ко всем профилям → Далее
8. Имя: Kiosk Server → Готово

### ✅ Server установлен!

Проверьте: `http://localhost:3001/api/health`

---

# 💻 ЧАСТЬ 2: Установка Editor (на компьютере администратора)

## Требования:
- Windows 10/11, macOS 11+, или Linux
- 4GB RAM
- Node.js 20.x
- Современный браузер

---

## Шаг 1: Установите Node.js (если еще не установлен)

**Windows/Mac:**
1. Скачайте: https://nodejs.org/
2. Установите LTS версию (20.x)
3. Перезагрузите компьютер

**Linux:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

## Шаг 2: Распакуйте архив

**Windows:**
1. Извлеките `kiosk-content-platform-v3.0-integrated.zip`
2. Поместите в `C:\Projects\kiosk` (или другую папку)

**Mac/Linux:**
```bash
mkdir -p ~/Projects/kiosk
cd ~/Projects/kiosk
tar -xzf ~/Downloads/kiosk-content-platform-v3.0-integrated.tar.gz
```

## Шаг 3: Перейдите в директорию Editor

**Windows:**
```powershell
cd C:\Projects\kiosk\packages\editor
```

**Mac/Linux:**
```bash
cd ~/Projects/kiosk/packages/editor
```

## Шаг 4: Установите зависимости

```bash
npm install
```

⏱️ **Это займет 2-5 минут**

## Шаг 5: Запустите Editor

```bash
npm run dev
```

**Вывод должен показать:**
```
  VITE v5.0.0  ready in 1234 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.1.100:5173/
```

## Шаг 6: Откройте в браузере

1. Откройте **Chrome**, **Firefox** или **Edge**
2. Перейдите на `http://localhost:5173`
3. Вы должны увидеть Editor!

## Шаг 7: Настройте подключение к серверу

1. В Editor нажмите кнопку **"Server"** в правом верхнем углу
2. В открывшемся окне:
   - ✅ Включите "Enable Server Integration"
   - URL: `http://YOUR_SERVER_IP:3001` (или `http://YOUR_SERVER_IP` если используете Nginx)
   - Нажмите **"Save & Connect"**

3. Проверьте подключение:
   - Индикатор должен показать 🟢 **"Connected"**
   - Версия сервера: **3.0.0**

## Шаг 8: Проверьте функции

### Тест Templates Library:
1. Нажмите кнопку **📋** (Templates) в Toolbar
2. Должны увидеть список шаблонов
3. Попробуйте загрузить шаблон
4. Создайте проект и сохраните как новый шаблон

### Тест Media Library:
1. Нажмите кнопку **🖼️** (Media) в Toolbar
2. Нажмите **"Upload Files"**
3. Выберите изображение
4. Файл должен загрузиться и отобразиться

### Тест Device Manager:
1. Нажмите кнопку **📱** (Devices) в Toolbar
2. Пока будет пусто (устройства появятся после установки Player)

## ✅ Editor установлен и работает!

**Адрес Editor:** `http://localhost:5173`

**Для доступа с других компьютеров:**
1. Узнайте IP: `ipconfig` (Windows) или `ifconfig` (Mac/Linux)
2. Откройте на другом компьютере: `http://YOUR_IP:5173`

---

# 📺 ЧАСТЬ 3: Установка Player (на устройствах для отображения)

## Требования:
- Windows 10/11, macOS 11+, или Linux
- 2GB RAM
- Node.js 20.x
- Монитор/телевизор

---

## Шаг 1: Установите Node.js (если еще не установлен)

См. инструкции из Части 2, Шаг 1

## Шаг 2: Распакуйте архив

**Windows:**
```powershell
# Извлеките в C:\kiosk-player
mkdir C:\kiosk-player
# Распакуйте архив туда
```

**Mac/Linux:**
```bash
mkdir -p ~/kiosk-player
cd ~/kiosk-player
tar -xzf ~/Downloads/kiosk-content-platform-v3.0-integrated.tar.gz
```

## Шаг 3: Перейдите в директорию Player

**Windows:**
```powershell
cd C:\kiosk-player\packages\player
```

**Mac/Linux:**
```bash
cd ~/kiosk-player/packages/player
```

## Шаг 4: Установите зависимости

```bash
npm install
```

⏱️ **Это займет 2-5 минут**

## Шаг 5: Добавьте кнопку Settings в Player

Откройте `src/Player.tsx` в редакторе и добавьте:

```typescript
// В начале файла, добавьте импорт
import { ServerSettings } from './components/ServerSettings';

// В компоненте Player добавьте состояние
const [showServerSettings, setShowServerSettings] = useState(false);

// В JSX добавьте кнопку (перед закрывающим div)
{!embedded && (
  <button
    className="settings-button"
    onClick={() => setShowServerSettings(true)}
    style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      width: '60px',
      height: '60px',
      borderRadius: '50%',
      background: '#2196F3',
      color: 'white',
      border: 'none',
      fontSize: '24px',
      cursor: 'pointer',
      zIndex: 1000,
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
    }}
  >
    ⚙️
  </button>
)}

{showServerSettings && (
  <ServerSettings onClose={() => setShowServerSettings(false)} />
)}
```

## Шаг 6: Запустите Player

```bash
npm run electron:dev
```

**Откроется окно Electron с Player!**

## Шаг 7: Настройте подключение к серверу

1. В Player нажмите кнопку **⚙️** (Settings) в правом нижнем углу
2. В настройках:
   - ✅ Включите "Enable Server Integration"
   - Server URL: `ws://YOUR_SERVER_IP:3001` (или `ws://YOUR_SERVER_IP` если Nginx)
   - Device Name: `Player 1` (или любое имя)
   - Нажмите **"Test Connection"**
   - Должно показать: ✅ "Connection successful"
   - Нажмите **"Save"**

3. Проверьте индикатор:
   - Должен показать: 🟢 **"Connected"**

## Шаг 8: Проверьте регистрацию устройства

1. Вернитесь в **Editor**
2. Откройте **Device Manager** (кнопка 📱)
3. Вы должны увидеть ваше устройство "Player 1"
4. Статус: **🟢 online**
5. Last Seen: **Just now**

## Шаг 9: Протестируйте Deployment

### В Editor:
1. Создайте простой проект:
   - Добавьте Text widget
   - Текст: "Test Deployment"
   - Фон: синий
2. Откройте Device Manager
3. Выберите "Player 1"
4. Нажмите **🚀 Deploy**
5. Подтвердите

### В Player:
✅ Проект должен автоматически загрузиться!
✅ Должно отобразиться "Test Deployment" на синем фоне
✅ Появится уведомление о развертывании

## Шаг 10: (Опционально) Настройте автозапуск

### Windows:

1. Соберите приложение:
```powershell
npm run electron:build:win
```

2. Установщик будет в `dist-electron/`
3. Установите приложение
4. Добавьте в автозагрузку:
   - Win+R → `shell:startup`
   - Создайте ярлык на Kiosk Player

### Linux:

1. Соберите AppImage:
```bash
npm run electron:build
```

2. Создайте autostart файл:
```bash
mkdir -p ~/.config/autostart
nano ~/.config/autostart/kiosk-player.desktop
```

```ini
[Desktop Entry]
Type=Application
Name=Kiosk Player
Exec=/path/to/kiosk-player.AppImage
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
```

## ✅ Player установлен и работает!

Player теперь:
- 🟢 Подключен к серверу
- 📝 Зарегистрирован как устройство
- 💓 Отправляет heartbeat каждые 30 секунд
- 📥 Получает проекты от Editor
- 📤 Отправляет логи на сервер

---

# 🎉 ФИНАЛЬНАЯ ПРОВЕРКА

## Полный workflow:

### 1. Проверьте Server:
```bash
curl http://YOUR_SERVER_IP:3001/api/health
# Ответ: {"status":"ok","version":"3.0.0"}
```

### 2. Проверьте Editor:
- Откройте http://localhost:5173
- Индикатор Server: 🟢 Connected
- Device Manager показывает Player

### 3. Проверьте Player:
- Player запущен
- Индикатор: 🟢 Connected
- Готов к приему проектов

### 4. Тест Deployment:
```
Editor: Создать проект → Deploy to Player
Player: Проект загружен автоматически ✅
```

---

# 🔧 Устранение неполадок

## Server не запускается

```bash
# Проверьте логи
sudo journalctl -u kiosk-server -n 50

# Проверьте порт
sudo netstat -tlnp | grep 3001

# Перезапустите
sudo systemctl restart kiosk-server
```

## Editor не подключается

1. Проверьте URL (должен быть `http://`, не `ws://`)
2. Проверьте firewall на сервере
3. Проверьте DevTools Console на ошибки
4. Попробуйте: `curl http://SERVER_IP:3001/api/health`

## Player не регистрируется

1. Проверьте URL (должен быть `ws://`, не `http://`)
2. Проверьте WebSocket в DevTools → Network → WS
3. Проверьте логи сервера: `sudo journalctl -u kiosk-server -f`
4. Перезапустите Player

## Проект не доходит до Player

1. Убедитесь что устройство **online** в Device Manager
2. Проверьте WebSocket соединение в DevTools
3. Проверьте логи: `sudo journalctl -u kiosk-server | grep deployment`
4. Попробуйте deploy снова

---

# 📚 Дополнительная информация

## Документация:
- **INTEGRATION-COMPLETE.md** - полный обзор
- **DEPLOYMENT-GUIDE.md** - детали развертывания сервера
- **EDITOR-INTEGRATION.md** - работа с Editor
- **PLAYER-INTEGRATION.md** - работа с Player
- **TESTING-GUIDE.md** - тестирование системы

## Полезные команды:

### Server:
```bash
# Статус
sudo systemctl status kiosk-server

# Логи
sudo journalctl -u kiosk-server -f

# Перезапуск
sudo systemctl restart kiosk-server

# Тесты
cd /opt/kiosk/packages/server
./e2e-test.sh
```

### Editor:
```bash
# Запуск dev
npm run dev

# Сборка production
npm run build
npm run preview
```

### Player:
```bash
# Запуск dev
npm run electron:dev

# Сборка для Windows
npm run electron:build:win

# Сборка для всех платформ
npm run electron:build
```

---

# ✅ Checklist установки

## Server:
- [ ] Ubuntu 22.04 или Windows Server установлен
- [ ] Node.js 20.x установлен
- [ ] Архив распакован в /opt/kiosk
- [ ] Зависимости установлены (npm install)
- [ ] .env настроен (JWT_SECRET)
- [ ] Systemd service создан и запущен
- [ ] API отвечает (curl /api/health)
- [ ] Firewall открыт (порт 3001)
- [ ] Nginx настроен (опционально)
- [ ] Тесты пройдены (./e2e-test.sh)

## Editor:
- [ ] Node.js 20.x установлен
- [ ] Архив распакован
- [ ] Зависимости установлены (npm install)
- [ ] Editor запускается (npm run dev)
- [ ] Открывается в браузере
- [ ] Подключение к серверу работает
- [ ] Templates Library загружается
- [ ] Media Library работает
- [ ] Device Manager показывает устройства

## Player:
- [ ] Node.js 20.x установлен
- [ ] Архив распакован
- [ ] Зависимости установлены (npm install)
- [ ] Settings UI добавлен
- [ ] Player запускается (npm run electron:dev)
- [ ] Подключение к серверу работает
- [ ] Устройство регистрируется
- [ ] Проекты получаются от Editor
- [ ] Deployment работает

---

# 🎊 Готово!

Теперь у вас полностью функциональная система:

✅ **Server** - управляет всем
✅ **Editor** - создаёт контент
✅ **Player** - отображает контент

**Начните использовать прямо сейчас!** 🚀

---

**Версия:** 3.0.0  
**Дата:** December 17, 2025  
**Статус:** Production Ready
