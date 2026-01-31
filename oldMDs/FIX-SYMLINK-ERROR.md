# 🔧 Исправление: Ошибка символических ссылок Windows

## ❌ Проблема

```
ERROR: Cannot create symbolic link : Клиент не обладает требуемыми правами
```

Это проблема прав Windows при распаковке winCodeSign.

---

## ✅ Решение 1: Отключить подписывание кода (РЕКОМЕНДУЕТСЯ)

### Шаг 1: Обновите package.json

Откройте `C:\Temp\kiosk-content-platform\packages\player\package.json`

Найдите секцию `"win":` и добавьте `"sign": null`:

**БЫЛО:**
```json
"win": {
  "target": [
    {
      "target": "nsis",
      "arch": ["x64"]
    }
  ],
  "icon": "assets/icon.ico"
},
```

**СТАЛО:**
```json
"win": {
  "target": [
    {
      "target": "nsis",
      "arch": ["x64"]
    }
  ],
  "icon": "assets/icon.ico",
  "sign": null
},
```

### Шаг 2: Очистите кэш и пересоберите

```bash
# Удалите кэш electron-builder
rmdir /s /q "%LOCALAPPDATA%\electron-builder\Cache"

# Пересоберите
cd C:\Temp\kiosk-content-platform\packages\player
npm run electron:build:win
```

---

## ✅ Решение 2: Запустите как Администратор

### Вариант А: Консоль как администратор

1. Закройте текущую консоль
2. Найдите **Command Prompt** или **PowerShell**
3. Правой кнопкой → **Запустить от имени администратора**
4. Выполните:

```bash
cd C:\Temp\kiosk-content-platform\packages\player

# Очистите кэш
rmdir /s /q "%LOCALAPPDATA%\electron-builder\Cache"

# Соберите
npm run electron:build:win
```

---

## ✅ Решение 3: Включите режим разработчика Windows

### Windows 10/11:

1. **Параметры** → **Обновление и безопасность** → **Для разработчиков**
2. Включите **Режим разработчика**
3. Перезагрузите компьютер
4. Попробуйте снова:

```bash
cd C:\Temp\kiosk-content-platform\packages\player
npm run electron:build:win
```

---

## 📋 Быстрое решение (копируй-вставляй)

### Вариант 1 (без прав администратора):

```bash
# 1. Скачайте обновлённый player-package.json
# 2. Замените package.json в packages\player\

# 3. Очистите кэш
rmdir /s /q "%LOCALAPPDATA%\electron-builder\Cache"

# 4. Соберите
cd C:\Temp\kiosk-content-platform\packages\player
npm run electron:build:win
```

### Вариант 2 (с правами администратора):

```bash
# Запустите консоль как Администратор, затем:

cd C:\Temp\kiosk-content-platform\packages\player
rmdir /s /q "%LOCALAPPDATA%\electron-builder\Cache"
npm run electron:build:win
```

---

## 🎯 Обновлённый package.json

Полная версия с отключенным подписыванием:

```json
{
  "name": "@kiosk-platform/player",
  "version": "1.0.0",
  "description": "Kiosk Content Player - Runtime player for kiosk projects",
  "author": "Kiosk Platform",
  "main": "electron/main.js",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "electron:dev": "concurrently \"npm run dev\" \"wait-on http://localhost:5173 && electron .\"",
    "electron:build": "npm run build && electron-builder",
    "electron:build:win": "npm run build && electron-builder --win",
    "package": "npm run build && electron-builder --dir"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.0.0",
    "concurrently": "^8.2.2",
    "electron": "28.0.0",
    "electron-builder": "^24.9.1",
    "typescript": "^5.0.0",
    "vite": "^5.0.0",
    "wait-on": "^7.2.0"
  },
  "build": {
    "appId": "com.kiosk.player",
    "productName": "Kiosk Player",
    "directories": {
      "output": "dist-electron"
    },
    "files": [
      "dist/**/*",
      "electron/**/*",
      "package.json"
    ],
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64"]
        }
      ],
      "sign": null
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true
    },
    "electronVersion": "28.0.0"
  }
}
```

**Ключевое изменение:** `"sign": null` в секции `"win"`

---

## 💡 Что это означает?

- ✅ Установщик будет создан БЕЗ цифровой подписи
- ✅ Всё будет работать нормально
- ⚠️ Windows может показать предупреждение при установке
- ⚠️ Пользователь должен нажать "Дополнительно" → "Выполнить в любом случае"

Для внутреннего использования это абсолютно нормально!

---

## 📥 Скачайте обновлённый файл

Скачайте `player-package.json` выше и замените на `package.json`

Затем:
```bash
rmdir /s /q "%LOCALAPPDATA%\electron-builder\Cache"
cd C:\Temp\kiosk-content-platform\packages\player
npm run electron:build:win
```

✅ Должно работать! 🚀
