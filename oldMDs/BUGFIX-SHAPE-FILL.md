# 🐛 Исправление: Пропадает заливка Shape в Preview/Player

## 🔍 Диагностика проблемы

### Возможные причины:

1. **fillColor не сохраняется** - значение `transparent` или `undefined`
2. **z-index проблема** - shape позади canvas background
3. **opacity = 0** - фигура невидима
4. **backgroundColor canvas** перекрывает shape

---

## ✅ Решение 1: Проверка сохранённого проекта

### Шаг 1: Экспортируйте проект

В редакторе:
1. Нажмите **"💾 Сохранить"**
2. Сохраните как `test-project.json`

### Шаг 2: Откройте JSON в блокноте

Найдите ваш shape виджет и проверьте:

```json
{
  "type": "shape",
  "properties": {
    "fillColor": "#ff0000",  ← Должно быть ваш цвет
    "opacity": 1,             ← Должно быть 1, не 0
    "shapeType": "rectangle"
  },
  "zIndex": 0                 ← Проверьте значение
}
```

**Если `fillColor` отсутствует или `transparent`** - это проблема сохранения!

---

## ✅ Решение 2: Убедитесь в z-index

Shape должен быть **поверх** фона canvas.

### В редакторе:

1. Выделите shape
2. Правая панель → **Z-Index**
3. Установите значение > 0 (например: 1 или 10)
4. Сохраните проект

---

## ✅ Решение 3: Проверка opacity

В панели свойств:
- **Opacity** должна быть 1.0 (100%)
- Если 0 - виджет невидим

---

## ✅ Решение 4: Исправление кода (если проблема в коде)

### Проблема: fillColor не применяется в Preview/Player

**Файл:** `packages/editor/src/components/Preview.tsx`  
**Строка:** ~153-177

Проверьте что `fillColor` правильно извлекается:

```typescript
const renderShape = (widget: Widget, baseStyle: React.CSSProperties) => {
  const { 
    shapeType = 'rectangle', 
    fillColor = '#4a90e2',  // ← Значение по умолчанию
    strokeColor = '#2c3e50', 
    strokeWidth = 0, 
    cornerRadius = 0, 
    opacity = 1 
  } = widget.properties || {};  // ← Добавьте || {}

  console.log('Shape fillColor:', fillColor);  // ← Для отладки

  const style: React.CSSProperties = {
    ...baseStyle,
    backgroundColor: fillColor,  // ← Применяется здесь
    opacity,
    border: strokeWidth > 0 ? `${strokeWidth}px solid ${strokeColor}` : 'none',
    borderRadius: shapeType === 'rectangle' && cornerRadius ? `${cornerRadius}px` : undefined
  };

  if (shapeType === 'circle' || shapeType === 'ellipse') {
    style.borderRadius = '50%';
  }

  return <div key={widget.id} style={style} />;
};
```

**Аналогично исправьте в:** `packages/player/src/Player.tsx`

---

## ✅ Решение 5: Проверка порядка виджетов

Виджеты рендерятся по **z-index** - от меньшего к большему.

### Правильный порядок:

```
z-index: 0  ← Фоновый shape (должен быть первым)
z-index: 1  ← Контент поверх
z-index: 2  ← Кнопки
z-index: 3  ← Popup
```

### В редакторе:

1. **Правая панель** → **Структура**
2. Проверьте порядок виджетов
3. Shape должен быть в начале списка (низкий z-index)

---

## 🔧 Тестовый проект

Создам простой проект для теста:

```json
{
  "name": "Test Shape",
  "canvas": {
    "width": 1920,
    "height": 1080,
    "backgroundColor": "#ffffff"
  },
  "widgets": [
    {
      "id": "bg-shape",
      "type": "shape",
      "x": 0,
      "y": 0,
      "width": 1920,
      "height": 1080,
      "zIndex": 0,
      "rotation": 0,
      "locked": false,
      "properties": {
        "shapeType": "rectangle",
        "fillColor": "#ff0000",
        "strokeColor": "#000000",
        "strokeWidth": 0,
        "cornerRadius": 0,
        "opacity": 1
      }
    },
    {
      "id": "test-text",
      "type": "text",
      "x": 100,
      "y": 100,
      "width": 400,
      "height": 100,
      "zIndex": 1,
      "properties": {
        "text": "Если видите красный фон - всё работает!",
        "fontSize": 24,
        "textColor": "#ffffff",
        "backgroundColor": "transparent"
      }
    }
  ]
}
```

### Тест:

1. Сохраните этот JSON как `test-shape.json`
2. Загрузите в редакторе (**"📂 Открыть"**)
3. Нажмите **Preview** (Play)
4. Должен быть **КРАСНЫЙ** фон

**Если фон белый** - проблема в коде!  
**Если фон красный** - проблема в вашем проекте (настройки)

---

## 📋 Чек-лист диагностики

- [ ] Откройте проект JSON → проверьте `fillColor`
- [ ] `fillColor` не `transparent` и не `undefined`
- [ ] `opacity` = 1 (не 0)
- [ ] `zIndex` shape меньше чем у других виджетов
- [ ] В Preview/Player фон canvas не перекрывает shape
- [ ] Протестируйте с test-shape.json выше

---

## 🔍 Отладка в браузере

### Preview режим:

1. Откройте Preview
2. F12 → Console
3. Найдите shape элемент:
   ```javascript
   document.querySelectorAll('[style*="position: absolute"]')
   ```
4. Проверьте стили:
   ```javascript
   // Должно показать backgroundColor
   element.style.backgroundColor
   ```

### Если backgroundColor пустой:

Проблема в коде - fillColor не передаётся.

---

## 🛠️ Быстрое исправление

Добавьте отладку в `Preview.tsx`:

```typescript
const renderShape = (widget: Widget, baseStyle: React.CSSProperties) => {
  const properties = widget.properties || {};
  
  // ОТЛАДКА
  console.log('Widget:', widget.id);
  console.log('Properties:', properties);
  console.log('fillColor:', properties.fillColor);
  
  const { 
    shapeType = 'rectangle', 
    fillColor = '#4a90e2', 
    strokeColor = '#2c3e50', 
    strokeWidth = 0, 
    cornerRadius = 0, 
    opacity = 1 
  } = properties;

  // ОТЛАДКА
  console.log('After extraction:', { fillColor, opacity, shapeType });

  const style: React.CSSProperties = {
    ...baseStyle,
    backgroundColor: fillColor,
    opacity,
    border: strokeWidth > 0 ? `${strokeWidth}px solid ${strokeColor}` : 'none',
    borderRadius: shapeType === 'rectangle' && cornerRadius ? `${cornerRadius}px` : undefined
  };

  // ОТЛАДКА
  console.log('Final style:', style);

  return <div key={widget.id} style={style} />;
};
```

Откройте Preview → F12 → Console → Посмотрите что выводится.

---

## 📤 Пришлите мне

Чтобы я мог точно помочь:

1. **Экспортированный JSON** вашего проекта (или проблемного shape)
2. **Скриншот** редактора с выделенным shape
3. **Скриншот** Preview где нет заливки
4. **Логи из Console** (если добавите отладку)

Тогда я смогу точно найти проблему!

---

**Версия:** 2.0.1  
**Статус:** Ожидание информации для диагностики
