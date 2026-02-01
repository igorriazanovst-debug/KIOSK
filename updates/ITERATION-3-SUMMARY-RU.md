# 🚀 ITERATION 3: СВОДКА ИНТЕГРАЦИИ

**Дата:** 31 января 2026  
**Статус:** Готов к реализации  
**Созданных файлов:** 11

---

## 📋 ОБЗОР

Данный документ содержит все файлы, необходимые для интеграции License Server с приложениями Editor и Player. Следуйте инструкциям ниже для применения изменений к своему локальному проекту.

---

## 📦 СОЗДАННЫЕ ФАЙЛЫ

### 1. Быстрое исправление сервера (Quick Fix)
- `AdminController-FIXED.ts` — Исправленный контроллер с генерацией licenseKey
- `LicenseService-PATCHED.ts` — Патченный сервис с поддержкой опционального licenseKey
- `QUICK-FIX-GUIDE.md` — Полное руководство по применению патчей на сервере

### 2. Общие типы (Shared Types)
- `license-client.ts` — TypeScript типы для лицензионной интеграции

### 3. Интеграция Editor
- `Editor-LicenseService.ts` — Сервис управления лицензиями для Editor
- `LicenseActivation.tsx` — UI компонент активации лицензии
- `LicenseActivation.css` — Стили компонента активации
- `LicenseStatus.tsx` — UI компонент отображения статуса лицензии
- `LicenseStatus.css` — Стили компонента статуса

### 4. Интеграция Player
- `Player-LicenseService.ts` — Сервис управления лицензиями для Player с поддержкой offline режима

---

## 🔧 ШАГИ РЕАЛИЗАЦИИ

### ФАЗА 1: Быстрое исправление сервера

**Приоритет:** ВЫСОКИЙ — сначала исправляем Create License endpoint

1. **Останавливаем сервер:**
   ```bash
   sudo systemctl stop kiosk-license-server
   ```

2. **Применяем патчи:**

   Подробные инструкции — в файле `QUICK-FIX-GUIDE.md`.

   Краткий итог:
   - Добавить функцию `generateLicenseKey()` в `AdminController.ts`
   - Изменить метод `createLicense()` для генерации и передачи licenseKey
   - Обновить `LicenseService.createLicense()` для приёма опционального параметра licenseKey

3. **Пересобираем и запускаем:**
   ```bash
   cd /opt/kiosk/kiosk-content-platform/packages/server
   npm run build
   sudo systemctl start kiosk-license-server
   ```

4. **Тестируем:**
   ```bash
   # Тест создания лицензии
   curl -X POST http://localhost:3001/api/admin/licenses \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "organizationId": "YOUR_ORG_ID",
       "plan": "PRO",
       "seatsEditor": 5,
       "seatsPlayer": 10,
       "validUntil": "2027-12-31"
     }'
   ```

   Ожидаемый результат: HTTP 201 со сгенерированным licenseKey.

---

### ФАЗА 2: Общие типы

**Путь:** `packages/shared/src/types/`

1. **Переходим в директорию:**
   ```bash
   cd packages/shared/src/types
   ```

2. **Копируем `license-client.ts` в:**
   ```
   packages/shared/src/types/license-client.ts
   ```

3. **Обновляем индекс shared:**

   Редактируем `packages/shared/src/index.ts` и добавляем:
   ```typescript
   export * from './types/license-client';
   ```

4. **Пересобираем shared пакет:**
   ```bash
   cd packages/shared
   npm run build
   ```

---

### ФАЗА 3: Интеграция Editor

**Путь:** `packages/editor/src/`

#### Шаг 3.1: Добавляем LicenseService

```bash
cd packages/editor/src
mkdir -p services
```

Копируем `Editor-LicenseService.ts` в:
```
packages/editor/src/services/LicenseService.ts
```

#### Шаг 3.2: Добавляем UI компоненты

```bash
cd packages/editor/src
mkdir -p components
```

Копируем файлы:
- `LicenseActivation.tsx` → `packages/editor/src/components/LicenseActivation.tsx`
- `LicenseActivation.css` → `packages/editor/src/components/LicenseActivation.css`
- `LicenseStatus.tsx` → `packages/editor/src/components/LicenseStatus.tsx`
- `LicenseStatus.css` → `packages/editor/src/components/LicenseStatus.css`

#### Шаг 3.3: Добавляем переменную окружения

Редактируем `packages/editor/.env` (создаём, если не существует):
```env
VITE_LICENSE_SERVER_URL=http://localhost:3001
```

Для продакшена заменяем на публичный URL сервера:
```env
VITE_LICENSE_SERVER_URL=http://194.58.92.190:3001
```

#### Шаг 3.4: Интеграция с приложением

Редактируем `packages/editor/src/App.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { LicenseService } from './services/LicenseService';
import { LicenseActivation } from './components/LicenseActivation';
import { LicenseStatus } from './components/LicenseStatus';

function App() {
  const [isLicensed, setIsLicensed] = useState(false);
  const [showActivation, setShowActivation] = useState(false);
  const [showStatus, setShowStatus] = useState(false);

  useEffect(() => {
    // Проверяем лицензию при монте компонента
    checkLicense();

    // Запускаем авто-обновление токена
    const cleanup = LicenseService.startAutoRefresh();

    return cleanup;
  }, []);

  const checkLicense = async () => {
    const licensed = LicenseService.isLicensed();
    setIsLicensed(licensed);

    if (licensed) {
      // Валидация online
      const valid = await LicenseService.validate();
      if (!valid) {
        setShowActivation(true);
      }
    } else {
      setShowActivation(true);
    }
  };

  const handleActivationSuccess = () => {
    setShowActivation(false);
    setIsLicensed(true);
  };

  const handleDeactivate = () => {
    setIsLicensed(false);
    setShowActivation(true);
    setShowStatus(false);
  };

  return (
    <div className="app">
      {/* Диалог активации лицензии */}
      {showActivation && (
        <LicenseActivation
          onSuccess={handleActivationSuccess}
          onCancel={() => setShowActivation(false)}
        />
      )}

      {/* Модальное окно статуса лицензии */}
      {showStatus && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="close-btn" onClick={() => setShowStatus(false)}>
              ✕
            </button>
            <LicenseStatus onDeactivate={handleDeactivate} />
          </div>
        </div>
      )}

      {/* Основной UI приложения */}
      <header>
        <h1>Kiosk Editor</h1>
        <div className="header-actions">
          {isLicensed ? (
            <button onClick={() => setShowStatus(true)}>
              🔑 Статус лицензии
            </button>
          ) : (
            <button onClick={() => setShowActivation(true)}>
              🔓 Активировать лицензию
            </button>
          )}
        </div>
      </header>

      {/* Контент приложения */}
      {isLicensed ? (
        <main>
          {/* Интерфейс Editor */}
        </main>
      ) : (
        <div className="not-licensed">
          <p>Пожалуйста, активируйте лицензию для использования Editor.</p>
        </div>
      )}
    </div>
  );
}

export default App;
```

#### Шаг 3.5: Тестируем Editor

```bash
cd packages/editor
npm run dev
```

Открываем http://localhost:5173 и проверяем:
1. Должен появиться диалог активации
2. Вводим ключ лицензии: `3VBN-8ZQ9-1MKO-AK0R`
3. Нажимаем «Activate»
4. Должно отобразиться сообщение об успехе, токен сохраняется
5. Обновляем страницу — должна остаться активирована

---

### ФАЗА 4: Интеграция Player

**Путь:** `packages/player/src/`

#### Шаг 4.1: Добавляем LicenseService

```bash
cd packages/player/src
mkdir -p services
```

Копируем `Player-LicenseService.ts` в:
```
packages/player/src/services/LicenseService.ts
```

#### Шаг 4.2: Добавляем поддержку Electron API

Редактируем `packages/player/electron/preload.cjs` и добавляем:

```javascript
contextBridge.exposeInMainWorld('electronAPI', {
  // ... существующие API ...

  // API для лицензий
  getMachineId: () => {
    const { machineIdSync } = require('node-machine-id');
    try {
      return machineIdSync();
    } catch {
      return null;
    }
  },

  getSystemInfo: () => {
    const os = require('os');
    return {
      platform: os.platform(),
      release: os.release(),
      arch: os.arch()
    };
  }
});
```

Устанавливаем `node-machine-id`, если ещё не установлен:
```bash
cd packages/player
npm install node-machine-id
```

#### Шаг 4.3: Добавляем проверку лицензии при запуске

Редактируем `packages/player/src/main/index.ts`:

```typescript
import { app, BrowserWindow } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    webPreferences: {
      preload: path.join(__dirname, '../preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(createWindow);
```

#### Шаг 4.4: Добавляем проверку лицензии в рендерере

Редактируем `packages/player/src/Player.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { LicenseService } from './services/LicenseService';
import { LicenseActivation } from '../components/LicenseActivation';

function Player() {
  const [licenseStatus, setLicenseStatus] = useState<{
    valid: boolean;
    mode: 'online' | 'offline' | 'none';
    message?: string;
  } | null>(null);
  const [project, setProject] = useState(null);

  useEffect(() => {
    validateLicense();

    // Запускаем авто-обновление токена
    const cleanup = LicenseService.startAutoRefresh();

    return cleanup;
  }, []);

  const validateLicense = async () => {
    const status = await LicenseService.validateOnStartup();
    setLicenseStatus(status);

    if (!status.valid) {
      console.error('Валидация лицензии не прошла:', status.message);
    }
  };

  const handleActivationSuccess = () => {
    validateLicense();
  };

  // Показываем экран активации, если лицензия не валидна
  if (!licenseStatus || !licenseStatus.valid) {
    return (
      <LicenseActivation
        onSuccess={handleActivationSuccess}
      />
    );
  }

  // Индикатор offline режима
  const isOffline = licenseStatus.mode === 'offline';

  return (
    <div className="player">
      {isOffline && (
        <div className="offline-banner">
          ⚠️ Работа в offline режиме — {licenseStatus.message}
        </div>
      )}

      {/* Существующий контент Player */}
      {project ? (
        <div className="project-view">
          {/* Рендер проекта */}
        </div>
      ) : (
        <div className="no-project">
          <p>Проект не загружен</p>
        </div>
      )}
    </div>
  );
}

export default Player;
```

#### Шаг 4.5: Тестируем Player

```bash
cd packages/player
npm run electron:dev
```

Сценарии тестирования:
1. **Первый запуск (без лицензии):**
   - Должен появиться диалог активации
   - Вводим ключ лицензии и активируем
   - Приложение продолжает работу

2. **Последующие запуски (лицензия есть):**
   - Валидация происходит online
   - Отображается основной интерфейс Player

3. **Offline режим:**
   - Отключаем интернет
   - Запускаем Player
   - Должен появиться баннер «offline режим»
   - Приложение продолжает работать (в течение 7 дней grace period)

4. **Истёкший grace period:**
   - Имитируем истечение grace period (меняем временную метку)
   - Должен появиться диалог активации

---

## ✅ ЧЕК-ЛИСТ ТЕСТИРОВАНИЯ

### Тесты Editor

- [ ] Активация валидным ключом лицензии работает
- [ ] Активация невалидным ключом показывает ошибку
- [ ] Статус лицензии отображается корректно
- [ ] Токен автоматически обновляется перед истечением
- [ ] Функции отображаются корректно в зависимости от плана
- [ ] Деактивация работает корректно
- [ ] Повторная активация после деактивации работает

### Тесты Player

- [ ] При первом запуске появляется экран активации
- [ ] Активация из Player работает
- [ ] Online валидация при запуске работает
- [ ] Offline режим активируется при отключении сети
- [ ] Offline режим показывает предупреждающий баннер
- [ ] Grace period (7 дней) соблюдается
- [ ] Токен автоматически обновляется в фоне
- [ ] Player блокируется при истечении лицензии

### Интеграционные тесты

- [ ] Активация Editor, затем Player с той же лицензией
- [ ] Проверка соблюдения лимитов мест (seats)
- [ ] Деактивация Editor, активация нового Player
- [ ] Оба приложения обновляют токены независимо
- [ ] Перезапуск сервера не влияет на активные устройства

---

## 🎯 КРИТЕРИИ УСПЕХА

Iteration 3 завершена, когда выполнены все пункты:

1. ✅ Endpoint Create License исправлен (генерирует licenseKey)
2. ✅ Общие типы созданы и экспортированы
3. ✅ Editor может активироваться по ключу лицензии
4. ✅ Editor сохраняет и валидирует токены
5. ✅ Editor автоматически обновляет токены
6. ✅ Editor отображает UI статуса лицензии
7. ✅ Player валидирует лицензию при запуске
8. ✅ Player поддерживает offline режим (7 дней grace period)
9. ✅ Player отображает индикатор статуса лицензии
10. ✅ Все тесты проходят успешно

---

## 📊 АРХИТЕКТУРА

```
┌─────────────────────────────────────────────────────────┐
│                  License Server                          │
│  (http://localhost:3001 или http://194.58.92.190:3001)  │
│                                                         │
│  - POST /api/license/activate                           │
│  - POST /api/license/validate                           │
│  - POST /api/license/refresh                            │
│  - POST /api/license/deactivate                         │
└───────────────┬─────────────────────┬───────────────────┘
                │                     │
       HTTP REST API          HTTP REST API
                │                     │
     ┌──────────▼─────────┐  ┌───────▼──────────┐
     │      Editor        │  │      Player      │
     │   (React App)      │  │  (Electron App)  │
     │                    │  │                  │
     │  LicenseService.ts │  │  LicenseService.ts│
     │  - activate()      │  │  - activate()    │
     │  - validate()      │  │  - validate()    │
     │  - refresh()       │  │  - refresh()     │
     │  - deactivate()    │  │  - deactivate()  │
     │  - autoRefresh()   │  │  - autoRefresh() │
     │                    │  │  - isOfflineModeValid()│
     │  localStorage:     │  │  localStorage:   │
     │  - license_token   │  │  - license_token │
     │  - device_id       │  │  - device_id     │
     │                    │  │  - last_online   │
     └────────────────────┘  └──────────────────┘
```

---

## 🔐 ПРИМЕЧАНИЯ ПО БЕЗОПАСНОСТИ

1. **JWT Токены:**
   - Хранятся в localStorage
   - Срок действия — 7 дней
   - Автоматическое обновление при менее чем 24 часах до истечения
   - Валидация при каждом запуске приложения

2. **Device ID (идентификатор устройства):**
   - Editor: случайный UUID, генерируется и сохраняется
   - Player: Machine ID (node-machine-id) или UUID как запасной вариант
   - Используется для привязки токена к конкретному устройству

3. **Offline режим (только Player):**
   - Grace period — 7 дней после последней online валидации
   - Токен должен быть валидным
   - После истечения grace period требуется подключение к сети

4. **Ключи лицензии:**
   - Формат: XXXX-XXXX-XXXX-XXXX
   - Валидация на стороне сервера
   - После деактивации ключ невозможно использовать повторно (без очистки устройства на сервере)

---

## 🐛 ДИАГНОСТИКА ПРОБЛЕМ

### Проблема: Editor не активируется

**Проверяем:**
1. Сервер запущен: `curl http://localhost:3001/health`
2. Правильный URL сервера в `.env`
3. Ключ лицензии валиден и не истёк
4. Лимит мест не достигнут

**Решение:**
```bash
# Смотрим логи сервера
sudo journalctl -u kiosk-license-server -f

# Тестируем активацию вручную
curl -X POST http://localhost:3001/api/license/activate \
  -H "Content-Type: application/json" \
  -d '{
    "licenseKey": "3VBN-8ZQ9-1MKO-AK0R",
    "deviceId": "test-123",
    "appType": "editor",
    "deviceName": "Test Editor"
  }'
```

### Проблема: Offline режим Player не работает

**Проверяем:**
1. `kiosk_last_online_check` в localStorage
2. Дату истечения токена
3. Расчёт grace period

**Решение:**
```typescript
// В консоли браузера
console.log(localStorage.getItem('kiosk_last_online_check'));
console.log(localStorage.getItem('kiosk_license_token'));
```

### Проблема: Токен не обновляется автоматически

**Проверяем:**
1. `startAutoRefresh()` вызван в useEffect
2. Функция очистки возвращается
3. Нет ошибок в консоли

**Решение:**
```typescript
// Добавляем логирование в LicenseService
static async autoRefresh(): Promise<void> {
  console.log('[LicenseService] Проверка авто-обновления...');
  // ... остальной код
}
```

---

## 📞 СЛЕДУЮЩИЕ ШАГИ

После завершения данной итерации:

1. **Документация:**
   - Обновить руководство пользователя инструкцией по активации
   - Создать руководство администратора по управлению лицензиями
   - Описать поведение offline режима

2. **Тестирование:**
   - Провести полное интеграционное тестирование
   - Протестировать крайние случаи (истёкшие лицензии, сбои сети)
   - Нагрузочное тестирование с несколькими устройствами

3. **Деплой:**
   - Развернуть обновлённый Editor в продакшен
   - Собрать и распространить установщики Player
   - Обновить сервер патченным AdminController

4. **Будущие улучшения:**
   - Реализовать перенос лицензии между устройствами
   - Реализовать приостановку и возобновление лицензии
   - Создать дашборд аналитики использования
   - Реализовать автоматические напоминания о продлении лицензии

---

## 🎉 ГОТОВ К РАБОТЕ!

Все файлы подготовлены. Следуйте шагам реализации выше для интеграции License Server с Editor и Player.

Удачи! 🚀
