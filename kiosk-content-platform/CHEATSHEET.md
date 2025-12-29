# ⚡ Шпаргалка: Создание установщика

## 🎯 Краткая последовательность

### 1️⃣ Создать проект
```bash
npm run dev:editor
```
→ Создайте контент → Сохраните `.json`

### 2️⃣ Скопировать проект
```bash
cd packages/player
copy "C:\путь\к\проекту.json" electron\project.json
```

### 3️⃣ Установить зависимости (один раз!)
```bash
npm install
npm install 7zip-bin app-builder-bin --save-dev
```

### 4️⃣ Собрать установщик
```bash
npm run electron:build:win
```

### 5️⃣ Взять результат
```
dist-electron\Kiosk Player Setup.exe
```

---

## 📋 Команды из корня проекта

```bash
# Разработка
npm run dev:editor          # Редактор
npm run player:dev          # Player в dev режиме

# Сборка
npm run player:build        # Создать установщик

# Быстрая проверка
cd packages/player/dist-electron
dir
```

---

## 🔄 При обновлении проекта

```bash
# Только эти 2 шага:
copy "новый-проект.json" packages\player\electron\project.json
npm run player:build
```

---

## 📍 Важные пути

| Что | Где |
|-----|-----|
| Редактор | `npm run dev:editor` |
| Куда копировать | `packages/player/electron/project.json` |
| Где собирать | `packages/player/` |
| Результат | `packages/player/dist-electron/` |

---

## ⚙️ Горячие клавиши Player

| Клавиша | Действие |
|---------|----------|
| F11 | Полный экран |
| ESC | Выход |
| Ctrl+O | Открыть проект |
| Ctrl+Q | Закрыть |

---

## 🐛 Быстрые решения

**Ошибка "Missing script":**
```bash
cd packages/player
npm run electron:build:win
```

**Ошибка "Cannot find module":**
```bash
cd packages/player
npm install
npm install 7zip-bin app-builder-bin --save-dev
npm run electron:build:win
```

**Забыл где проект:**
- Откройте редактор
- Проверьте Downloads/Документы
- Сохраните снова

**Не создаётся установщик:**
```bash
cd packages/player
npm install 7zip-bin app-builder-bin --save-dev
rmdir /s /q "%LOCALAPPDATA%\electron-builder\Cache"
npm run electron:build:win
```

---

## 📏 Размеры

- Установщик: ~80 MB
- Время сборки: 5-10 мин (первый раз)
- Время пересборки: 2-3 мин

---

## ✅ Минимальный чеклист

- [ ] `npm run dev:editor` → создать → сохранить
- [ ] `copy проект.json electron\project.json`
- [ ] `npm install` (один раз)
- [ ] `npm install 7zip-bin app-builder-bin --save-dev`
- [ ] `npm run electron:build:win`
- [ ] Взять из `dist-electron\`

**🎉 Готово!**
