#!/bin/bash
################################################################################
# Полное тестирование Client API
# Проверяет все 16 эндпоинтов
################################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Полное тестирование Client API                                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

API_URL="http://localhost:3001"
LICENSE_KEY="EWZA-E5LJ-Z558-9LUQ"

# Счётчики
PASSED=0
FAILED=0

test_endpoint() {
    local name="$1"
    local result="$2"
    
    if [ "$result" = "OK" ]; then
        echo -e "   ${GREEN}✓${NC} $name"
        ((PASSED++))
    else
        echo -e "   ${RED}✗${NC} $name"
        ((FAILED++))
    fi
}

echo -e "${BLUE}[1] Аутентификация${NC}"
echo ""

# 1.1 Вход по лицензии
echo "1.1 POST /api/auth/license - Вход по лицензии"
AUTH_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/license" \
  -H "Content-Type: application/json" \
  -d "{\"licenseKey\":\"$LICENSE_KEY\"}")

if echo "$AUTH_RESPONSE" | jq -e '.success' &>/dev/null; then
    TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.token')
    test_endpoint "Получен токен" "OK"
    echo -e "   ${BLUE}→${NC} Token: ${TOKEN:0:50}..."
    
    STORAGE_LIMIT=$(echo "$AUTH_RESPONSE" | jq -r '.license.storageLimit')
    echo -e "   ${BLUE}→${NC} Storage limit: $STORAGE_LIMIT bytes"
else
    test_endpoint "Ошибка авторизации" "FAIL"
    echo "$AUTH_RESPONSE" | jq .
    exit 1
fi

echo ""

# 1.2 Проверка токена
echo "1.2 GET /api/auth/verify - Проверка токена"
VERIFY=$(curl -s "$API_URL/api/auth/verify" \
  -H "Authorization: Bearer $TOKEN")

if echo "$VERIFY" | jq -e '.valid' &>/dev/null; then
    test_endpoint "Токен валиден" "OK"
else
    test_endpoint "Токен невалиден" "FAIL"
fi

echo ""
echo -e "${BLUE}[2] Управление проектами${NC}"
echo ""

# 2.1 Создание проекта
echo "2.1 POST /api/projects - Создание проекта"
CREATE_PROJECT=$(curl -s -X POST "$API_URL/api/projects" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "API Test Project",
    "description": "Тестовый проект для проверки API",
    "projectData": {
      "widgets": [],
      "canvas": {"width": 1920, "height": 1080}
    },
    "tags": ["test", "api"]
  }')

if echo "$CREATE_PROJECT" | jq -e '.success' &>/dev/null; then
    PROJECT_ID=$(echo "$CREATE_PROJECT" | jq -r '.project.id')
    test_endpoint "Проект создан" "OK"
    echo -e "   ${BLUE}→${NC} Project ID: $PROJECT_ID"
else
    test_endpoint "Ошибка создания проекта" "FAIL"
    echo "$CREATE_PROJECT" | jq .
fi

echo ""

# 2.2 Получение списка проектов
echo "2.2 GET /api/projects - Список проектов"
LIST_PROJECTS=$(curl -s "$API_URL/api/projects" \
  -H "Authorization: Bearer $TOKEN")

if echo "$LIST_PROJECTS" | jq -e '.success' &>/dev/null; then
    COUNT=$(echo "$LIST_PROJECTS" | jq '.count')
    test_endpoint "Список получен ($COUNT проектов)" "OK"
else
    test_endpoint "Ошибка получения списка" "FAIL"
fi

echo ""

# 2.3 Получение проекта по ID
echo "2.3 GET /api/projects/:id - Получение проекта"
GET_PROJECT=$(curl -s "$API_URL/api/projects/$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN")

if echo "$GET_PROJECT" | jq -e '.success' &>/dev/null; then
    test_endpoint "Проект получен" "OK"
    NAME=$(echo "$GET_PROJECT" | jq -r '.project.name')
    echo -e "   ${BLUE}→${NC} Name: $NAME"
else
    test_endpoint "Ошибка получения проекта" "FAIL"
fi

echo ""

# 2.4 Обновление проекта
echo "2.4 PUT /api/projects/:id - Обновление проекта"
UPDATE_PROJECT=$(curl -s -X PUT "$API_URL/api/projects/$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Test Project",
    "description": "Описание обновлено",
    "tags": ["test", "api", "updated"]
  }')

if echo "$UPDATE_PROJECT" | jq -e '.success' &>/dev/null; then
    test_endpoint "Проект обновлён" "OK"
    NEW_NAME=$(echo "$UPDATE_PROJECT" | jq -r '.project.name')
    echo -e "   ${BLUE}→${NC} New name: $NEW_NAME"
else
    test_endpoint "Ошибка обновления проекта" "FAIL"
fi

echo ""
echo -e "${BLUE}[3] Управление файлами${NC}"
echo ""

# 3.1 Создание тестового файла
echo "3.1 Подготовка тестового файла"
TEST_FILE="/tmp/test_upload.txt"
echo "This is a test file for API testing" > "$TEST_FILE"
echo "Content: Lorem ipsum dolor sit amet" >> "$TEST_FILE"
test_endpoint "Файл создан" "OK"

echo ""

# 3.2 Загрузка файла
echo "3.2 POST /api/projects/:id/files - Загрузка файла"
UPLOAD_FILE=$(curl -s -X POST "$API_URL/api/projects/$PROJECT_ID/files" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$TEST_FILE")

if echo "$UPLOAD_FILE" | jq -e '.success' &>/dev/null; then
    FILE_ID=$(echo "$UPLOAD_FILE" | jq -r '.file.id')
    FILE_SIZE=$(echo "$UPLOAD_FILE" | jq -r '.file.fileSize')
    test_endpoint "Файл загружен ($FILE_SIZE bytes)" "OK"
    echo -e "   ${BLUE}→${NC} File ID: $FILE_ID"
    
    # Проверка информации о хранилище в ответе
    if echo "$UPLOAD_FILE" | jq -e '.storage' &>/dev/null; then
        STORAGE_USED=$(echo "$UPLOAD_FILE" | jq -r '.storage.used')
        STORAGE_REMAINING=$(echo "$UPLOAD_FILE" | jq -r '.storage.remaining')
        echo -e "   ${BLUE}→${NC} Storage used: $STORAGE_USED bytes"
        echo -e "   ${BLUE}→${NC} Storage remaining: $STORAGE_REMAINING bytes"
    fi
else
    test_endpoint "Ошибка загрузки файла" "FAIL"
    echo "$UPLOAD_FILE" | jq .
fi

echo ""

# 3.3 Список файлов проекта
echo "3.3 GET /api/projects/:id/files - Список файлов"
LIST_FILES=$(curl -s "$API_URL/api/projects/$PROJECT_ID/files" \
  -H "Authorization: Bearer $TOKEN")

if echo "$LIST_FILES" | jq -e '.success' &>/dev/null; then
    FILE_COUNT=$(echo "$LIST_FILES" | jq '.count')
    test_endpoint "Список файлов получен ($FILE_COUNT файлов)" "OK"
else
    test_endpoint "Ошибка получения списка файлов" "FAIL"
fi

echo ""

# 3.4 Скачивание файла
echo "3.4 GET /api/projects/:id/files/:fileId - Скачивание файла"
DOWNLOAD_FILE=$(curl -s -w "\n%{http_code}" "$API_URL/api/projects/$PROJECT_ID/files/$FILE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -o /tmp/downloaded_file.txt)

HTTP_CODE=$(echo "$DOWNLOAD_FILE" | tail -1)
if [ "$HTTP_CODE" = "200" ]; then
    test_endpoint "Файл скачан (HTTP $HTTP_CODE)" "OK"
    echo -e "   ${BLUE}→${NC} Размер: $(wc -c < /tmp/downloaded_file.txt) bytes"
else
    test_endpoint "Ошибка скачивания (HTTP $HTTP_CODE)" "FAIL"
fi

echo ""

# 3.5 Удаление файла
echo "3.5 DELETE /api/projects/:id/files/:fileId - Удаление файла"
DELETE_FILE=$(curl -s -X DELETE "$API_URL/api/projects/$PROJECT_ID/files/$FILE_ID" \
  -H "Authorization: Bearer $TOKEN")

if echo "$DELETE_FILE" | jq -e '.success' &>/dev/null; then
    test_endpoint "Файл удалён" "OK"
else
    test_endpoint "Ошибка удаления файла" "FAIL"
fi

echo ""
echo -e "${BLUE}[4] Статистика хранилища${NC}"
echo ""

# 4.1 Получение статистики
echo "4.1 GET /api/storage/stats - Статистика хранилища"
STORAGE_STATS=$(curl -s "$API_URL/api/storage/stats" \
  -H "Authorization: Bearer $TOKEN")

if echo "$STORAGE_STATS" | jq -e '.success' &>/dev/null; then
    test_endpoint "Статистика получена" "OK"
    
    USED=$(echo "$STORAGE_STATS" | jq -r '.storage.used')
    LIMIT=$(echo "$STORAGE_STATS" | jq -r '.storage.limit')
    REMAINING=$(echo "$STORAGE_STATS" | jq -r '.storage.remaining')
    PERCENT=$(echo "$STORAGE_STATS" | jq -r '.storage.usedPercentage')
    
    echo -e "   ${BLUE}→${NC} Использовано: $USED bytes ($PERCENT%)"
    echo -e "   ${BLUE}→${NC} Лимит: $LIMIT bytes"
    echo -e "   ${BLUE}→${NC} Осталось: $REMAINING bytes"
else
    test_endpoint "Ошибка получения статистики" "FAIL"
fi

echo ""
echo -e "${BLUE}[5] Очистка (удаление тестового проекта)${NC}"
echo ""

# 5.1 Удаление проекта
echo "5.1 DELETE /api/projects/:id - Удаление проекта"
DELETE_PROJECT=$(curl -s -X DELETE "$API_URL/api/projects/$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN")

if echo "$DELETE_PROJECT" | jq -e '.success' &>/dev/null; then
    test_endpoint "Проект удалён" "OK"
else
    test_endpoint "Ошибка удаления проекта" "FAIL"
fi

echo ""

# 5.2 Проверка что проект удалён
echo "5.2 Проверка удаления"
CHECK_DELETE=$(curl -s "$API_URL/api/projects/$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN")

if echo "$CHECK_DELETE" | jq -e '.error' &>/dev/null; then
    test_endpoint "Проект действительно удалён" "OK"
else
    test_endpoint "Проект не удалён?" "FAIL"
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}📊 Результаты тестирования${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${GREEN}✓ Успешно:${NC} $PASSED тестов"
echo -e "  ${RED}✗ Провалено:${NC} $FAILED тестов"
echo ""

TOTAL=$((PASSED + FAILED))
SUCCESS_RATE=$((PASSED * 100 / TOTAL))

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 ВСЕ ТЕСТЫ ПРОШЛИ! (100%)${NC}"
elif [ $SUCCESS_RATE -ge 80 ]; then
    echo -e "${YELLOW}⚠️  Большинство тестов прошли ($SUCCESS_RATE%)${NC}"
else
    echo -e "${RED}❌ Много ошибок ($SUCCESS_RATE% успеха)${NC}"
fi

echo ""
