# 📱 Player Integration with Server v3.0

## ✅ Что добавлено в Player

### 🔌 Сервисы:

1. **Server Connection** (`src/services/server-connection.ts`)
   - WebSocket подключение к серверу
   - Автоматическая регистрация устройства
   - Heartbeat каждые 30 секунд
   - Отправка логов на сервер
   - Прием проектов для развертывания
   - Автоматическое переподключение

### 🎨 UI Компоненты:

1. **ServerSettings** (`src/components/ServerSettings.tsx`)
   - Настройка URL сервера
   - Включение/отключение интеграции
   - Имя устройства
   - Индикатор подключения
   - Тест соединения

### 🔧 Интеграция в Player.tsx:

- Автоматическая инициализация при запуске
- Прием проектов через WebSocket
- Отправка логов на сервер
- Уведомления о развертывании

---

## 🚀 Как работает

### 1. Запуск Player

```typescript
// При запуске Player автоматически:

1. Загружает конфигурацию из localStorage
2. Инициализирует serverConnection
3. Подключается к WebSocket серверу (если enabled)
4. Регистрирует устройство
5. Начинает отправлять heartbeat каждые 30 сек
6. Слушает события deployment:start
```

### 2. Регистрация устройства

```typescript
// Автоматически при подключении:

Device Info:
- id: "player-uuid" (генерируется один раз)
- name: "Kiosk Player (hostname)"
- os: navigator.platform
- version: "3.0.0"
- ipAddress: определяется сервером

// Сохраняется в БД сервера
// Отображается в Device Manager
```

### 3. Прием проектов

```typescript
// Когда Editor отправляет проект:

1. Сервер отправляет событие: deployment:start
2. Player получает projectData
3. Автоматически загружает проект
4. Отправляет лог: "Project deployed successfully"
5. Показывает уведомление пользователю
```

### 4. Heartbeat

```typescript
// Каждые 30 секунд:

Player отправляет:
{
  type: 'device:heartbeat',
  deviceId: 'player-uuid'
}

Сервер обновляет:
- last_seen timestamp
- status: 'online'
```

### 5. Логирование

```typescript
// Player автоматически отправляет логи:

- "Player started" (при подключении)
- "Project deployed successfully" (при развертывании)
- Ошибки (при возникновении)

// Доступно в Device Manager → View Logs
```

---

## 🔧 Настройка

### Открыть настройки:

В Player нужно добавить кнопку/меню для открытия ServerSettings:

```typescript
// В Player.tsx добавить состояние:
const [showServerSettings, setShowServerSettings] = useState(false);

// В JSX добавить кнопку (например, в углу экрана):
<button onClick={() => setShowServerSettings(true)}>⚙️</button>

// Рендерить компонент:
{showServerSettings && (
  <ServerSettings onClose={() => setShowServerSettings(false)} />
)}
```

### Настройка подключения:

```typescript
1. Нажать кнопку настроек ⚙️
2. Включить "Enable Server Integration"
3. Указать Server URL: ws://YOUR_IP:3001
4. Указать Device Name (опционально)
5. Нажать "Test Connection" для проверки
6. Нажать "Save"
```

---

## 📊 События WebSocket

### Отправляемые Player:

```typescript
// device:register - регистрация при подключении
{
  type: 'device:register',
  id: 'player-uuid',
  name: 'Kiosk Player',
  os: 'Windows',
  version: '3.0.0',
  ipAddress: 'N/A'
}

// device:heartbeat - каждые 30 сек
{
  type: 'device:heartbeat',
  deviceId: 'player-uuid'
}

// device:log - отправка логов
{
  type: 'device:log',
  deviceId: 'player-uuid',
  level: 'info' | 'warning' | 'error',
  message: 'Log message',
  logData: { ... }
}
```

### Получаемые Player:

```typescript
// deployment:start - новый проект
{
  type: 'deployment:start',
  taskId: 'task-uuid',
  deviceId: 'player-uuid',
  projectData: {
    name: 'My Project',
    canvas: { ... },
    widgets: [ ... ]
  }
}
```

---

## 🎯 Workflow: От Editor до Player

### Шаг 1: Editor отправляет проект

```typescript
// В Editor → Device Manager
1. Выбрать устройство
2. Нажать 🚀 Deploy
3. API вызов: POST /api/devices/{id}/deploy
```

### Шаг 2: Server обрабатывает

```typescript
// Server:
1. Получает projectData
2. Создает deployment task
3. Отправляет через WebSocket:
   - событие: deployment:start
   - на конкретный deviceId
```

### Шаг 3: Player получает и загружает

```typescript
// Player:
1. Получает deployment:start
2. Извлекает projectData
3. Вызывает setProject(projectData)
4. Отправляет лог на сервер
5. Показывает уведомление
```

---

## 🔍 Debugging

### Проверка подключения:

```typescript
// В DevTools Console Player:

// Проверить конфигурацию
console.log(localStorage.getItem('kiosk-player-server-config'));

// Проверить Device ID
console.log(localStorage.getItem('kiosk-device-id'));

// Посмотреть состояние WebSocket
// DevTools → Network → WS
```

### Общие проблемы:

#### Player не подключается

```typescript
1. Проверить Server URL (ws:// не http://)
2. Проверить что сервер запущен
3. Проверить firewall
4. Проверить консоль на ошибки
5. Проверить enabled: true в конфиге
```

#### Устройство не отображается в Device Manager

```typescript
1. Проверить подключение WebSocket
2. Проверить регистрацию в логах Player
3. Проверить БД на сервере:
   curl http://localhost:3001/api/devices
4. Проверить last_seen timestamp
```

#### Проект не приходит

```typescript
1. Проверить что устройство online
2. Проверить deployment в Editor
3. Проверить логи сервера:
   sudo journalctl -u kiosk-server -f
4. Проверить события в DevTools → Network → WS
```

---

## 🎨 Добавление UI для настроек

### Вариант 1: Кнопка в углу экрана

```typescript
// Player.tsx
<div className="settings-button">
  <button onClick={() => setShowServerSettings(true)}>
    ⚙️ Settings
  </button>
</div>

// Player.css
.settings-button {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 1000;
}
```

### Вариант 2: Через меню Electron

```typescript
// electron/main.js
const menu = Menu.buildFromTemplate([
  {
    label: 'File',
    submenu: [
      {
        label: 'Server Settings',
        click: () => {
          mainWindow.webContents.send('open-server-settings');
        }
      }
    ]
  }
]);

// Player.tsx
useEffect(() => {
  if (window.electronAPI) {
    window.electronAPI.on('open-server-settings', () => {
      setShowServerSettings(true);
    });
  }
}, []);
```

### Вариант 3: Горячая клавиша

```typescript
// Player.tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ctrl+Shift+S
    if (e.ctrlKey && e.shiftKey && e.key === 'S') {
      e.preventDefault();
      setShowServerSettings(true);
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

---

## 📈 Мониторинг

### Проверка статуса на сервере:

```bash
# Список устройств
curl http://localhost:3001/api/devices

# Конкретное устройство
curl http://localhost:3001/api/devices/player-uuid

# Логи устройства
curl http://localhost:3001/api/devices/player-uuid/logs
```

### Real-time мониторинг:

```bash
# Monitor script
cd /opt/kiosk/kiosk-content-platform/packages/server
./monitor.sh 5

# Показывает:
- Список устройств
- Online/Offline статус
- Last seen timestamp
- Current project
```

---

## 🔐 Безопасность

### Рекомендации:

1. **Используйте wss:// для production** (WebSocket over SSL)
2. **Настройте firewall** на сервере
3. **Ограничьте CORS** в server .env
4. **Используйте VPN** для удаленного доступа
5. **Регулярно обновляйте** Player и Server

### Конфигурация для SSL:

```typescript
// Server: настроить Nginx с SSL
// Player: использовать wss://

Server URL: wss://your-domain.com

// Nginx автоматически апгрейдит соединение
```

---

## 📚 API Reference

### Server Connection Methods:

```typescript
// Инициализация
serverConnection.init(config?);

// Обновление конфига
serverConnection.updateConfig({ url: 'ws://...', enabled: true });

// Получение конфига
const config = serverConnection.getConfig();

// Проверка подключения
const connected = serverConnection.isConnected();

// Отключение
serverConnection.disconnect();

// Отправка лога
serverConnection.sendLog('info', 'Message', data);

// Слушать события
serverConnection.on('deployment:start', (data) => { ... });
serverConnection.on('connected', () => { ... });
serverConnection.on('disconnected', () => { ... });
```

---

## 🎉 Готово!

Player теперь:
- ✅ Подключается к серверу
- ✅ Регистрируется как устройство
- ✅ Отправляет heartbeat
- ✅ Получает проекты
- ✅ Отправляет логи
- ✅ Автоматически переподключается

**Версия:** 3.0.0  
**Дата:** Декабрь 2025  
**Статус:** ✅ Player интеграция готова
