# 🔧 Исправление ошибки Electron

## ❌ Ошибка
```
Cannot compute electron version from installed node modules
```

## ✅ Решение

### Шаг 1: Удалите node_modules и package-lock.json

```bash
# Перейдите в папку player
cd packages/player

# Удалите node_modules
rmdir /s /q node_modules

# Удалите package-lock.json
del package-lock.json
```

### Шаг 2: Обновите package.json

Откройте `packages/player/package.json` и измените:

**БЫЛО:**
```json
"electron": "^28.0.0"
```

**СТАЛО:**
```json
"electron": "28.0.0"
```

И добавьте:
```json
"author": "Kiosk Platform"
```

### Шаг 3: Переустановите зависимости

```bash
npm install
```

### Шаг 4: Попробуйте собрать снова

```bash
npm run electron:build:win
```

---

## 📋 Полная последовательность команд

```bash
cd packages/player
rmdir /s /q node_modules
del package-lock.json
npm install
npm run electron:build:win
```

---

## 🎯 Если не помогло

### Вариант 1: Установите Electron глобально

```bash
npm install -g electron@28.0.0
```

Затем:
```bash
npm run electron:build:win
```

### Вариант 2: Установите Electron локально явно

```bash
npm install electron@28.0.0 --save-dev
npm run electron:build:win
```

### Вариант 3: Очистка кэша npm

```bash
npm cache clean --force
rmdir /s /q node_modules
del package-lock.json
npm install
npm run electron:build:win
```

---

## ✅ Проверка успешной установки

После `npm install` проверьте:

```bash
# Должна показать версию
npx electron --version
```

Должно вывести: `v28.0.0`

---

## 📝 Исправленный package.json

Вот правильная версия `packages/player/package.json`:

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
      ]
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

Ключевые изменения:
1. ✅ `"author": "Kiosk Platform"` добавлено
2. ✅ `"electron": "28.0.0"` без каретки (^)
3. ✅ `"electronVersion": "28.0.0"` в секции build

---

## 🎯 После исправления

Выполните:
```bash
cd packages/player
rmdir /s /q node_modules
del package-lock.json
npm install
npm run electron:build:win
```

✅ Должно работать!
