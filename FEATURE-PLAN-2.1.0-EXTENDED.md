# 🚀 План реализации: Расширенный набор v2.1.0

## 📦 Объём работы

### Файлов для создания: ~12
### Файлов для модификации: ~8
### Общий объём: ~3000 строк кода

---

## 🔷 Этап 1: Формы обрезки изображений

### Новые файлы:
1. ✅ **ClippedImage.tsx** - Компонент клиппинга (создан)
2. **ImageGallery.tsx** - Компонент галереи
3. **GalleryControls.tsx** - Контролы навигации

### Модификации:
1. **ImageWidget.tsx** - Интеграция ClippedImage
2. **PropertiesPanel.tsx** - UI для выбора формы + галереи
3. **Preview.tsx** - Рендер форм в Preview
4. **Player.tsx** - Рендер форм в Player

### Свойства виджета Image (новые):
```typescript
properties: {
  // Существующие
  src: string;
  opacity: number;
  
  // НОВЫЕ - Формы
  clipShape: 'rectangle' | 'circle' | 'ellipse' | 'triangle' | 
             'diamond' | 'pentagon' | 'hexagon' | 'octagon' | 
             'rounded-rectangle';
  cornerRadius: number; // для rounded-rectangle
  
  // НОВЫЕ - Галерея
  galleryMode: boolean;
  sources: Array<{
    type: 'local' | 'url';
    value: string;
    id: string;
  }>;
  currentIndex: number;
  
  // Автопереключение
  autoSwitch: boolean;
  switchInterval: number; // секунды
  
  // Эффекты
  transition: 'none' | 'fade' | 'slide' | 'zoom';
  transitionDuration: number; // мс
  
  // Контролы
  showControls: boolean;
  showIndicators: boolean;
  loop: boolean;
}
```

---

## 🎬 Этап 2: Плейлист видео

### Новые файлы:
1. **VideoPlaylist.tsx** - Компонент плейлиста
2. **PlaylistControls.tsx** - Контролы плейлиста
3. **VideoThumbnail.tsx** - Миниатюры видео

### Модификации:
1. **VideoWidget.tsx** - Интеграция плейлиста
2. **PropertiesPanel.tsx** - UI для плейлиста
3. **Preview.tsx** - Плейлист в Preview
4. **Player.tsx** - Плейлист в Player

### Свойства виджета Video (новые):
```typescript
properties: {
  // Существующие
  src: string;
  autoplay: boolean;
  loop: boolean;
  controls: boolean;
  
  // НОВЫЕ - Плейлист
  playlistMode: boolean;
  sources: Array<{
    type: 'local' | 'url';
    value: string;
    id: string;
    title?: string;
  }>;
  currentIndex: number;
  
  // Автопереход
  autoNext: boolean;
  
  // UI плейлиста
  showPlaylist: boolean;
  playlistPosition: 'right' | 'bottom';
  
  // Формы (опционально)
  clipShape?: string;
  cornerRadius?: number;
}
```

---

## 📝 Этап 3: UI в Properties Panel

### Для Image Widget:

```
┌─ Изображение ─────────────────┐
│                                │
│ Режим:                         │
│ ○ Одиночное                   │
│ ● Галерея                     │
│                                │
│ ┌─ Источники ────────────┐   │
│ │ 📷 image1.jpg      [×] │   │
│ │ 🌐 https://...     [×] │   │
│ │ 📷 image3.png      [×] │   │
│ │                          │   │
│ │ [+ Файл] [+ URL]       │   │
│ └──────────────────────────┘   │
│                                │
│ Форма обрезки:                 │
│ [Круг ▼]                      │
│                                │
│ ┌─ Когда: rounded-rect ────┐  │
│ │ Радиус углов: [20] px    │  │
│ └──────────────────────────┘   │
│                                │
│ ┌─ Автопереключение ────────┐ │
│ │ ☑ Включено                │ │
│ │ Интервал: [3] сек         │ │
│ └──────────────────────────┘   │
│                                │
│ ┌─ Эффекты ──────────────────┐ │
│ │ Переход: [Fade ▼]         │ │
│ │ Длительность: [500] мс    │ │
│ └──────────────────────────┘   │
│                                │
│ ┌─ Контролы ─────────────────┐ │
│ │ ☑ Показать стрелки        │ │
│ │ ☑ Показать индикаторы     │ │
│ │ ☑ Зацикливание            │ │
│ └──────────────────────────┘   │
└────────────────────────────────┘
```

---

## 🎯 Приоритеты реализации

### Фаза 1 (MVP):
1. ✅ ClippedImage компонент
2. Интеграция форм в ImageWidget
3. UI выбора формы в Properties
4. Рендер в Preview/Player

### Фаза 2 (Галерея):
5. Структура данных sources[]
6. UI загрузки файлов
7. Логика переключения
8. Эффекты переходов

### Фаза 3 (Контролы):
9. Кнопки навигации
10. Индикаторы
11. Автопереключение

### Фаза 4 (Видео):
12. Адаптация для VideoWidget
13. Плейлист UI
14. Автопереход видео

---

## 📂 Структура файлов

```
packages/editor/src/
├── components/
│   ├── ClippedImage.tsx          ✅ Создан
│   ├── ImageGallery.tsx          ⏳ TODO
│   ├── GalleryControls.tsx       ⏳ TODO
│   ├── VideoPlaylist.tsx         ⏳ TODO
│   ├── PlaylistControls.tsx      ⏳ TODO
│   ├── ImageWidget.tsx           🔄 Модифицировать
│   ├── VideoWidget.tsx           🔄 Модифицировать
│   ├── PropertiesPanel.tsx       🔄 Модифицировать
│   ├── Preview.tsx               🔄 Модифицировать
│   └── Canvas.tsx                ✅ OK
│
├── stores/
│   └── editorStore.ts            🔄 Добавить actions
│
└── types/
    └── index.ts                   🔄 Обновить типы

packages/player/src/
├── Player.tsx                     🔄 Модифицировать
└── components/
    ├── ImageRenderer.tsx          ⏳ TODO
    └── VideoRenderer.tsx          ⏳ TODO
```

---

## ⚡ Быстрый старт (для вас)

### Вариант 1: Поэтапная реализация
Я реализую по одной функции за раз:
- Сообщение 1: Формы обрезки
- Сообщение 2: Галерея изображений
- Сообщение 3: Плейлист видео

### Вариант 2: Готовый архив
Я создаю полностью готовый код офлайн и даю архив.

### Вариант 3: MVP сначала
Сначала минимум (формы + базовая галерея), потом расширение.

---

## 🔍 Технические детали

### Клиппинг изображений:
- Canvas API для создания масок
- React Konva для редактора
- CSS clip-path для Preview/Player

### Галерея:
- Preload следующего изображения
- requestAnimationFrame для плавных переходов
- Intersection Observer для lazy loading

### Видео плейлист:
- HTMLVideoElement API
- События ended/play/pause
- Buffering и error handling

---

## 📊 Оценка времени

- Формы обрезки: 2-3 часа
- Галерея изображений: 4-5 часов
- Плейлист видео: 3-4 часа
- Тестирование: 2 часа
- **Итого: ~12 часов работы**

---

## ❓ Следующий шаг?

**Скажите как продолжить:**

1. 📝 Реализую всё поэтапно (3-4 сообщения)
2. 📦 Даю готовый архив с реализацией
3. 🚀 Сначала MVP, потом полная версия
4. 🎯 Только конкретная функция (какая?)

**Жду вашего решения!** 🎯
