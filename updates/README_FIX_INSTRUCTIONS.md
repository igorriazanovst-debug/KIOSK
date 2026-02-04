# 🔧 Исправление LoginDialog - ИНСТРУКЦИЯ

**Дата:** 04.02.2026  
**Проблема:** LoginDialog не показывается в Toolbar  
**Причина:** Незакрытая функция `handleLogout` в Toolbar.tsx  

---

## 🐛 Найденная проблема

В файле `Toolbar.tsx` функция `handleLogout` не завершена:

```typescript
const handleLogout = () => {
  if (confirm('Вы уверены что хотите выйти?'))  // ⚠️ Здесь обрывается!
```

Это ломает весь синтаксис компонента и React не может отрендерить LoginDialog.

---

## ✅ Решение

Создан **универсальный скрипт** который:
1. ✅ Создаёт backup текущего Toolbar.tsx
2. ✅ Заменяет файл на исправленную версию
3. ✅ Исправляет функцию handleLogout
4. ✅ Заменяет Grid3x3 → Grid (если есть)
5. ✅ Делает build проекта
6. ✅ Деплоит на production
7. ✅ Перезагружает Nginx
8. ✅ Проверяет доступность

---

## 🚀 Как применить исправление

### Вариант 1: Автоматический (рекомендуется)

```bash
# 1. Скачайте скрипт на локальный компьютер
#    Файл: fix_and_deploy_complete.sh

# 2. Загрузите на сервер
scp fix_and_deploy_complete.sh root@31.192.110.121:/tmp/

# 3. Подключитесь к серверу
ssh root@31.192.110.121

# 4. Запустите скрипт
chmod +x /tmp/fix_and_deploy_complete.sh
sudo /tmp/fix_and_deploy_complete.sh
```

**Время выполнения:** 2-3 минуты

---

### Вариант 2: Ручной (если нужен контроль)

```bash
# 1. Подключитесь к серверу
ssh root@31.192.110.121

# 2. Создайте backup
cp /opt/kiosk/kiosk-content-platform/packages/editor-web/src/components/Toolbar.tsx \
   /opt/kiosk/kiosk-content-platform/packages/editor-web/src/components/Toolbar.tsx.backup

# 3. Откройте файл в редакторе
nano /opt/kiosk/kiosk-content-platform/packages/editor-web/src/components/Toolbar.tsx

# 4. Найдите функцию handleLogout (примерно строка 96)
#    Замените:
const handleLogout = () => {
  if (confirm('Вы уверены что хотите выйти?'))

#    На:
const handleLogout = () => {
  if (confirm('Вы уверены что хотите выйти?')) {
    apiClient.logout();
    setIsAuthenticated(false);
    setOrganizationName(null);
    setPlan(null);
    setShowLoginDialog(true);
  }
};

# 5. Также найдите и замените Grid3x3 на Grid (если есть)
#    Ctrl+W → "Grid3x3" → заменить на "Grid"

# 6. Сохраните (Ctrl+O, Enter, Ctrl+X)

# 7. Build и deploy
cd /opt/kiosk/kiosk-content-platform/packages/editor-web
rm -rf dist
npm run build
sudo cp -r dist/* /opt/kiosk/editor-web/
sudo chown -R www-data:www-data /opt/kiosk/editor-web
sudo systemctl reload nginx
```

---

## 🧪 Проверка работы

После применения исправления:

1. **Откройте Editor в браузере:**
   ```
   http://31.192.110.121:8080
   ```

2. **Должен появиться диалог входа LoginDialog**
   - ✅ Если диалог показывается - ОТЛИЧНО!
   - ❌ Если нет - смотрите DevTools Console (F12)

3. **Войдите с тестовым ключом:**
   ```
   3VBN-8ZQ9-1MKO-AK0R
   ```

4. **После входа проверьте:**
   - ✅ В Toolbar показывается: 👤 Test Organization | PRO
   - ✅ Кнопка "Выйти" работает
   - ✅ AutoSaveIndicator показывается справа
   - ✅ Можно добавлять виджеты
   - ✅ Автосохранение работает (смотрите индикатор)

---

## 🔍 Диагностика проблем

### Проблема 1: LoginDialog всё ещё не показывается

**Проверьте Console (F12):**
```javascript
// Должны быть логи:
[Toolbar] Login successful: Test Organization, PRO
```

**Если ошибка импорта:**
```
Cannot find module './LoginDialog'
```

Проверьте что файл существует:
```bash
ls -la /opt/kiosk/kiosk-content-platform/packages/editor-web/src/components/LoginDialog.tsx
ls -la /opt/kiosk/kiosk-content-platform/packages/editor-web/src/components/LoginDialog.css
```

---

### Проблема 2: Build завершается с ошибками

**Типичные ошибки:**

1. **TypeScript errors:**
   ```
   error TS2304: Cannot find name 'Grid3x3'
   ```
   Решение: Замените `Grid3x3` на `Grid` в импортах

2. **Missing dependencies:**
   ```bash
   cd /opt/kiosk/kiosk-content-platform/packages/editor-web
   npm install
   ```

---

### Проблема 3: 502 Bad Gateway

**Проверьте Nginx:**
```bash
nginx -t
systemctl status nginx
systemctl restart nginx
```

**Проверьте файлы:**
```bash
ls -la /opt/kiosk/editor-web/
# Должны быть: index.html, assets/
```

---

## 📦 Файлы в этом пакете

```
fix_loginDialog/
├── fix_and_deploy_complete.sh     # Автоматический скрипт
├── Toolbar_FIXED_COMPLETE.tsx     # Исправленный Toolbar.tsx
├── diagnose_login_dialog.sh       # Скрипт диагностики (опционально)
└── README_FIX_INSTRUCTIONS.md     # Эта инструкция
```

---

## 🎯 Ожидаемый результат

После применения исправления:

✅ **LoginDialog показывается** при загрузке Editor  
✅ **Кнопка "Войти"** работает в Toolbar  
✅ **User info** отображается после входа  
✅ **Кнопка "Выйти"** работает корректно  
✅ **AutoSaveIndicator** показывается справа  
✅ **Автосохранение** работает каждые 3 минуты  

---

## 💡 Дополнительно

### Если хотите вернуть старую версию:

```bash
# Найти backup файлы
ls -la /opt/kiosk/kiosk-content-platform/packages/editor-web/src/components/Toolbar.tsx.backup*

# Восстановить
cp /opt/kiosk/.../Toolbar.tsx.backup.YYYYMMDD_HHMMSS \
   /opt/kiosk/kiosk-content-platform/packages/editor-web/src/components/Toolbar.tsx

# Rebuild
cd /opt/kiosk/kiosk-content-platform/packages/editor-web
npm run build
sudo cp -r dist/* /opt/kiosk/editor-web/
```

---

## 📞 Поддержка

**Если проблема не решена:**

1. Запустите диагностический скрипт:
   ```bash
   bash diagnose_login_dialog.sh
   ```

2. Проверьте логи Nginx:
   ```bash
   tail -f /var/log/nginx/editor-web.error.log
   ```

3. Проверьте Console браузера (F12)

4. Сообщите Клоду результаты диагностики

---

## ✅ Checklist

- [ ] Backup создан
- [ ] Скрипт запущен успешно
- [ ] Build завершился без ошибок
- [ ] Файлы скопированы в /opt/kiosk/editor-web/
- [ ] Nginx перезагружен
- [ ] Editor доступен на http://31.192.110.121:8080
- [ ] LoginDialog показывается
- [ ] Вход работает
- [ ] AutoSaveIndicator работает

---

**Версия:** 1.0  
**Дата:** 04.02.2026  
**Статус:** Готово к применению

🚀 **Удачи с исправлением!**
