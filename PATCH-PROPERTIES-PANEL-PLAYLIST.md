# 🔧 ПАТЧ: Добавление UI плейлиста в PropertiesPanel

## Инструкции

Добавьте следующий код В НАЧАЛО секции Video (строка ~1126), сразу после `{selectedWidget.type === 'video' && (`:

```typescript
<h4 style={{ marginTop: '0', marginBottom: '12px', fontSize: '13px', fontWeight: 'bold' }}>Режим</h4>

<div className="property-field">
  <label>
    <input
      type="radio"
      name="videoMode"
      checked={!selectedWidget.properties.playlistMode}
      onChange={() => handlePropertiesChange('playlistMode', false)}
    />
    {' '}Одиночное видео
  </label>
</div>

<div className="property-field">
  <label>
    <input
      type="radio"
      name="videoMode"
      checked={selectedWidget.properties.playlistMode || false}
      onChange={() => {
        handlePropertiesChange('playlistMode', true);
        if (!selectedWidget.properties.sources) {
          handlePropertiesChange('sources', []);
        }
      }}
    />
    {' '}Плейлист видео
  </label>
</div>

{!selectedWidget.properties.playlistMode && (
  <>
    {/* СУЩЕСТВУЮЩИЙ КОД для одиночного видео */}
  </>
)}

{selectedWidget.properties.playlistMode && (
  <>
    <h4>Видео (макс. 50)</h4>
    {/* UI плейлиста - см. полный код в FEATURE-2.1.0-VIDEO-PLAYLIST.md */}
  </>
)}
```

## Альтернатива

Замените весь файл PropertiesPanel.tsx на обновлённую версию из архива.

Файл слишком большой для автоматического патча, но логика простая:
1. Добавить переключатель режимов (одиночное/плейлист)
2. Обернуть существующий код в `{!selectedWidget.properties.playlistMode && ( ... )}`
3. Добавить новый блок для плейлиста

---

**Для простоты:** Используйте обновлённый архив, где всё уже исправлено! ✅
