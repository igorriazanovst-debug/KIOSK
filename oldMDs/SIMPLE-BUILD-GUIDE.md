# 🔧 Простое решение: Прямой запуск из папки player

## ✅ Самый простой способ

Забудьте про workspaces! Запускайте напрямую из папки player.

### Шаг 1: Перейдите в папку player

```bash
cd C:\Temp\kiosk-content-platform\packages\player
```

### Шаг 2: Замените package.json

**Скачайте файл `player-package.json` выше и:**

1. Переименуйте в `package.json`
2. Замените файл `C:\Temp\kiosk-content-platform\packages\player\package.json`

**ИЛИ создайте вручную через блокнот** (скопируйте весь текст):

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

Сохраните как `package.json` в папке `packages\player\`

### Шаг 3: Установите зависимости

```bash
# Находясь в packages\player
npm install
npm install 7zip-bin app-builder-bin --save-dev
```

⏱️ **Время:** 2-5 минут  
📦 **Что устанавливается:**
- Основные зависимости (React, Electron, etc.)
- Инструменты для сборки установщика (7zip-bin, app-builder-bin)

### Шаг 4: Соберите установщик

```bash
npm run electron:build:win
```

---

## 📋 Полная последовательность (копируй-вставляй)

```bash
cd C:\Temp\kiosk-content-platform\packages\player
npm install
npm run electron:build:win
```

---

## ✅ Проверка перед сборкой

Убедитесь что:

1. ✅ Файл `package.json` содержит секцию `"scripts"` с `"electron:build:win"`
2. ✅ Вы находитесь в папке `packages\player`
3. ✅ Выполнили `npm install`

Проверить скрипты:
```bash
npm run
```

Должны увидеть:
```
electron:build:win
  npm run build && electron-builder --win
```

---

## 🎯 Если всё равно не работает

### Вариант А: Полная переустановка

```bash
cd C:\Temp\kiosk-content-platform\packages\player

# Удалите всё
rmdir /s /q node_modules
del package-lock.json

# Замените package.json (из файла выше)

# Установите
npm install
npm install 7zip-bin app-builder-bin --save-dev

# Соберите
npm run electron:build:win
```

### Вариант Б: Скачайте свежий архив

1. Скачайте свежий `kiosk-content-platform.zip` 
2. Распакуйте в новую папку
3. Перейдите в `packages\player`
4. Выполните команды выше

---

## 💡 Совет

Если у вас уже есть сохранённый проект (my-project.json):

1. Скопируйте его в безопасное место
2. Скачайте свежий архив
3. Распакуйте
4. Скопируйте проект обратно: `packages\player\electron\project.json`
5. Соберите установщик

---

**После замены package.json попробуйте снова!** 🚀
