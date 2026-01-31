# 📝 Editor Integration with Server v3.0

## ✅ Что добавлено в Editor

### 🔌 Сервисы:

1. **API Client** (`src/services/api-client.ts`)
   - Класс для всех HTTP запросов к серверу
   - Методы для Templates, Media, Devices
   - Автоматическая обработка ошибок
   - Поддержка загрузки файлов

2. **WebSocket Client** (`src/services/websocket-client.ts`)
   - Real-time связь с сервером
   - Автоматическое переподключение
   - События: device:connected, device:disconnected, deployment:*

3. **Server Store** (`src/stores/serverStore.ts`)
   - Zustand store для состояния сервера
   - Сохранение настроек в localStorage
   - Методы подключения/отключения

### 🎨 UI Компоненты:

1. **ServerSettings** (`src/components/ServerSettings.tsx`)
   - Настройка URL сервера
   - Включение/отключение интеграции
   - Индикатор подключения
   - Статус сервера (версия, uptime)

2. **TemplatesLibrary** (`src/components/TemplatesLibrary.tsx`)
   - Просмотр всех шаблонов с сервера
   - Загрузка шаблона в проект
   - Сохранение текущего проекта как шаблона
   - Удаление шаблонов
   - Поиск и фильтрация по категориям

3. **MediaLibrary** (`src/components/MediaLibrary.tsx`)
   - Просмотр медиа файлов
   - Загрузка новых файлов (images, videos, audio)
   - Удаление файлов
   - Поиск и фильтрация по типу
   - Preview для изображений

4. **DeviceManager** (`src/components/DeviceManager.tsx`)
   - Список всех устройств (players)
   - Статистика (online/offline/total)
   - Отправка проекта на устройство
   - Просмотр логов устройства
   - Удаление устройств
   - Real-time обновления статуса

### 🔧 Интеграция в Toolbar:

Добавлены кнопки:
- 🌐 **Server** - индикатор подключения и настройки
- 📋 **Templates** - библиотека шаблонов
- 🖼️ **Media** - медиа-библиотека
- 📱 **Devices** - менеджер устройств

---

## 🚀 Как использовать

### 1. Настройка подключения

```typescript
// Нажмите на кнопку "Server" в Toolbar
// Откроется панель настроек

// 1. Включите интеграцию
Enable Server Integration: ✓

// 2. Укажите URL сервера
Server URL: http://YOUR_IP:3001

// 3. Нажмите "Save & Connect"
```

### 2. Работа с шаблонами

```typescript
// Открыть Templates Library
Нажмите кнопку 📋 в Toolbar

// Сохранить текущий проект как шаблон
"💾 Save Current as Template"
Введите название и описание

// Загрузить шаблон
Кликните на карточку шаблона
Подтвердите загрузку
```

### 3. Работа с медиа

```typescript
// Открыть Media Library
Нажмите кнопку 🖼️ в Toolbar

// Загрузить файлы
"📤 Upload Files"
Выберите файлы (несколько сразу)

// Использовать медиа
Кликните на файл
Drag-and-drop в проект или вставьте URL
```

### 4. Управление устройствами

```typescript
// Открыть Device Manager
Нажмите кнопку 📱 в Toolbar

// Отправить проект на устройство
Нажмите 🚀 на карточке устройства
Проект отправится автоматически

// Просмотр логов
Нажмите 📋 на карточке устройства
Откроется окно с логами
```

---

## 🔌 API Examples

### Использование API Client:

```typescript
import { apiClient } from '../services/api-client';

// Получить все шаблоны
const result = await apiClient.getTemplates();
if (result.success) {
  console.log('Templates:', result.data);
}

// Загрузить медиа
const file = new File(['...'], 'image.png', { type: 'image/png' });
const upload = await apiClient.uploadMedia(file, 'My Image', ['tag1']);
if (upload.success) {
  console.log('Media URL:', apiClient.getMediaUrl(upload.data!));
}

// Отправить проект на устройство
const deploy = await apiClient.deployProject('device-id', {
  projectName: 'My Project',
  projectData: project,
});
```

### Использование WebSocket:

```typescript
import { wsClient } from '../services/websocket-client';

// Слушать события
wsClient.on('device:connected', (event) => {
  console.log('Device connected:', event.deviceId);
});

wsClient.on('deployment:completed', (event) => {
  console.log('Deployment completed:', event);
});

// Отправить сообщение
wsClient.send({
  type: 'custom:event',
  data: { ... },
});
```

### Использование Server Store:

```typescript
import { useServerStore } from '../stores/serverStore';

function MyComponent() {
  const {
    config,
    isConnected,
    serverVersion,
    setConfig,
    connect,
    checkConnection,
  } = useServerStore();

  // Изменить URL
  setConfig({ url: 'http://192.168.1.100:3001' });

  // Подключиться
  await connect();

  // Проверить соединение
  const alive = await checkConnection();
}
```

---

## 📊 Состояния компонентов

### ServerSettings

```typescript
interface ServerState {
  config: {
    url: string;
    enabled: boolean;
  };
  isConnected: boolean;
  isConnecting: boolean;
  lastError: string | null;
  serverVersion: string | null;
  serverUptime: number | null;
}
```

### Templates Library

```typescript
interface TemplatesLibraryState {
  templates: Template[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  selectedCategory: string;
}
```

### Media Library

```typescript
interface MediaLibraryState {
  media: MediaFile[];
  loading: boolean;
  error: string | null;
  uploading: boolean;
  selectedMedia: MediaFile | null;
}
```

### Device Manager

```typescript
interface DeviceManagerState {
  devices: Device[];
  loading: boolean;
  error: string | null;
  deploying: string | null;
  stats: {
    total: number;
    online: number;
    offline: number;
    error: number;
  };
}
```

---

## 🎯 Workflow Examples

### Пример 1: Создание проекта из шаблона

```typescript
1. Открыть Templates Library (📋)
2. Найти нужный шаблон через поиск
3. Кликнуть на шаблон
4. Подтвердить загрузку
5. Редактировать проект
6. Сохранить как новый шаблон
```

### Пример 2: Использование централизованного медиа

```typescript
1. Открыть Media Library (🖼️)
2. Загрузить изображение через "Upload Files"
3. Скопировать URL изображения
4. Добавить Image Widget в проект
5. Вставить URL из Media Library
6. Изображение доступно на всех устройствах
```

### Пример 3: Отправка на устройства

```typescript
1. Создать/отредактировать проект
2. Открыть Device Manager (📱)
3. Выбрать устройство (online)
4. Нажать 🚀 Deploy
5. Проект автоматически отправится
6. Player получит и запустит проект
```

---

## 🔧 Troubleshooting

### Проблема: Не подключается к серверу

```typescript
1. Проверьте что сервер запущен:
   curl http://YOUR_IP:3001/api/health

2. Проверьте URL в настройках:
   Settings → Server URL

3. Проверьте firewall:
   sudo ufw status

4. Проверьте CORS в server .env:
   CORS_ORIGIN=*
```

### Проблема: Шаблоны не загружаются

```typescript
1. Проверьте подключение к серверу
2. Откройте DevTools → Network
3. Проверьте запрос к /api/templates
4. Проверьте БД на сервере:
   ls -la /opt/kiosk/.../data/kiosk.db
```

### Проблема: Медиа не загружается

```typescript
1. Проверьте размер файла (<100 MB)
2. Проверьте тип файла (image/video/audio)
3. Проверьте директорию на сервере:
   ls -la /opt/kiosk/.../data/media/
4. Проверьте права доступа:
   sudo chown -R kiosk:kiosk data/
```

### Проблема: Устройства не отображаются

```typescript
1. Убедитесь что Player запущен
2. Проверьте что Player подключился к серверу
3. Проверьте WebSocket соединение:
   DevTools → Network → WS
4. Проверьте в БД:
   curl http://localhost:3001/api/devices
```

---

## 🎨 Кастомизация UI

### Изменить цвета:

```css
/* ServerSettings.css */
.status-button.connected {
  border-color: #your-color;
}

/* TemplatesLibrary.css */
.template-card:hover {
  border-color: #your-color;
}
```

### Добавить свои кнопки в Toolbar:

```typescript
// Toolbar.tsx
<button 
  className="btn-icon" 
  onClick={() => setShowMyComponent(true)}
  title="My Feature"
>
  <MyIcon size={18} />
</button>
```

---

## 📚 API Reference

Полная документация API:
- `packages/server/README.md`
- `/api/health` - проверка сервера
- `/api/templates` - CRUD шаблонов
- `/api/media` - управление медиа
- `/api/devices` - управление устройствами

WebSocket события:
- `device:connected`
- `device:disconnected`
- `device:status`
- `deployment:progress`
- `deployment:completed`

---

**Версия:** 3.0.0  
**Дата:** Декабрь 2025  
**Статус:** ✅ Editor интеграция готова

🎉 **Готово к использованию!**
