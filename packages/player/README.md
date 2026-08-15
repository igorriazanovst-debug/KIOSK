# 🎮 Kiosk Player

Standalone приложение для воспроизведения киоск-проектов на Windows и Linux (deb/rpm, x64 + arm64).

## 📦 Быстрый старт

### 1. Установка зависимостей

```bash
npm install
```

### 2. Разработка

```bash
# Запуск в dev режиме (с hot reload)
npm run electron:dev
```

### 3. Сборка установщика

```bash
# Полная сборка для Windows
npm run electron:build:win

# Полная сборка для Linux (deb + rpm, x64 + arm64)
npm run electron:build:linux
```

Результат: `dist-electron/Kiosk Player Setup.exe` (Windows) или `dist-electron/*.deb` / `*.rpm` (Linux, по одному файлу на архитектуру).

Требования для сборки Linux-пакетов: `rpmbuild` должен быть установлен на машине, где запускается сборка (на Debian/Ubuntu — `apt-get install rpm`), иначе electron-builder не сможет собрать `.rpm`.

## 📝 Встраивание проекта

### Способ 1: Замена project.json

```bash
# Экспортируйте проект из редактора в JSON
# Скопируйте файл
cp /path/to/my-project.json electron/project.json

# Соберите Player
npm run electron:build:win
```

### Способ 2: Через редактор (будущее)

```
Редактор → Экспорт → Установщик Windows → Создать
```

## 🎯 Доступные команды

| Команда | Описание |
|---------|----------|
| `npm run dev` | Запуск Vite dev сервера |
| `npm run build` | Сборка React приложения |
| `npm run electron:dev` | Запуск Electron в dev режиме |
| `npm run electron:build:win` | Сборка установщика Windows |
| `npm run electron:build:linux` | Сборка deb/rpm пакетов (x64 + arm64) |
| `npm run package` | Создание распакованной версии |

## 🔧 Горячие клавиши в Player

| Клавиша | Действие |
|---------|----------|
| **F11** | Полноэкранный режим |
| **ESC** | Выход из полного экрана / Закрыть popup |
| **Ctrl+O** | Открыть другой проект |
| **Ctrl+Q** | Выход из приложения |

## 📁 Структура

```
player/
├── src/
│   ├── Player.tsx          # Главный компонент
│   ├── Player.css          # Стили
│   ├── main.tsx            # Точка входа React
│   └── index.css           # Базовые стили
├── electron/
│   ├── main.js             # Electron главный процесс
│   ├── preload.js          # API bridge
│   └── project.json        # Встроенный проект (замените)
├── dist/                   # Сборка React (создаётся)
├── dist-electron/          # Сборка Electron (создаётся)
├── index.html              # HTML шаблон
├── vite.config.ts          # Конфиг Vite
├── tsconfig.json           # Конфиг TypeScript
└── package.json            # Зависимости и скрипты
```

## ⚙️ Настройка установщика

Редактируйте `package.json` → секция `build`:

```json
{
  "build": {
    "appId": "com.your-company.kiosk",
    "productName": "Your Kiosk Name",
    "win": {
      "icon": "assets/icon.ico"
    }
  }
}
```

## 🐛 Решение проблем

### "npm run build:player" не найден

**Решение:** Используйте `npm run electron:build:win`

### Ошибка сборки Electron

**Проверьте:**
1. `npm run build` выполняется успешно
2. Папка `dist/` создана
3. Файл `electron/project.json` существует

### Player не загружает проект

**Проверьте:**
1. Файл `electron/project.json` валидный JSON
2. Структура соответствует формату проекта
3. Консоль разработчика (в dev режиме)

## 📋 Требования

- **Node.js:** 18+
- **npm:** 9+
- **Windows:** для сборки .exe
- **Место на диске:** ~500 MB для node_modules

## 🚀 Производство

После сборки:

1. **Тестирование:**
   ```
   dist-electron/win-unpacked/Kiosk Player.exe
   ```

2. **Распространение:**
   ```
   dist-electron/Kiosk Player Setup.exe
   ```

## 📞 Поддержка

При проблемах проверьте:
- Версию Node.js: `node --version`
- Логи сборки
- Консоль разработчика в Electron

---

**Версия:** 1.0.0  
**Лицензия:** MIT
