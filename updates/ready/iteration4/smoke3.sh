#!/bin/bash
BASE="http://localhost:3001"
PRO_KEY="3VBN-8ZQ9-1MKO-AK0R"
PP() { python3 -c "import sys,json;print(json.dumps(json.load(sys.stdin),indent=2))" 2>/dev/null; }

# Admin login
LOGIN=$(curl -s -X POST "$BASE/api/admin/login" -H "Content-Type: application/json" -d '{"email":"admin@kiosk.local","password":"Admin123!"}')
ADMIN=$(echo "$LOGIN" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])" 2>/dev/null)

echo "=== Очистка старых устройств ==="
# Получаем список устройств, удаляем все кроме TEST-DEVICE-001
DEVICES=$(curl -s "$BASE/api/admin/devices" -H "Authorization: Bearer $ADMIN")
IDS=$(echo "$DEVICES" | python3 -c "
import sys,json
data=json.load(sys.stdin)['data']
for d in data:
    if d['deviceId'] != 'TEST-DEVICE-001':
        print(d['id'])
" 2>/dev/null)

for ID in $IDS; do
    RES=$(curl -s -X DELETE "$BASE/api/admin/devices/$ID" -H "Authorization: Bearer $ADMIN")
    STATUS=$(echo "$RES" | python3 -c "import sys,json;print(json.load(sys.stdin).get('success','fail'))" 2>/dev/null)
    DNAME=$(echo "$DEVICES" | python3 -c "import sys,json;[print(d['deviceId']) for d in json.load(sys.stdin)['data'] if d['id']=='$ID']" 2>/dev/null)
    echo "  DELETE $DNAME → $STATUS"
done

echo ""
echo "=== Текущие устройства ==="
curl -s "$BASE/api/admin/devices" -H "Authorization: Bearer $ADMIN" | python3 -c "
import sys,json
data=json.load(sys.stdin)['data']
for d in data:
    print(f\"  {d['deviceId']:30} {d['status']:15} {d['appType']}\")
print(f\"  Итого: {len(data)} устройств\")
" 2>/dev/null

echo ""
echo "============================================"
echo "  ПОЛНЫЙ ЦИКЛ ТЕСТИРОВАНИЯ"
echo "============================================"
DEVICE="full-cycle-$(date +%s)"

echo ""
echo "=== 1. activate (новое устройство: $DEVICE) ==="
ACTIVATE=$(curl -s -X POST "$BASE/api/license/activate" -H "Content-Type: application/json" -d "{\"licenseKey\":\"$PRO_KEY\",\"deviceId\":\"$DEVICE\",\"appType\":\"editor\",\"deviceName\":\"Full Cycle Test\"}")
echo "$ACTIVATE" | PP
TOKEN=$(echo "$ACTIVATE" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])" 2>/dev/null)
if [ -z "$TOKEN" ]; then
    echo "STOP: activate failed, token empty"
    exit 1
fi

echo ""
echo "=== 2. validate ==="
curl -s -X POST "$BASE/api/license/validate" -H "Content-Type: application/json" -d "{\"token\":\"$TOKEN\",\"deviceId\":\"$DEVICE\"}" | PP

echo ""
echo "=== 3. refresh ==="
REFRESH=$(curl -s -X POST "$BASE/api/license/refresh" -H "Content-Type: application/json" -d "{\"deviceId\":\"$DEVICE\",\"oldToken\":\"$TOKEN\"}")
echo "$REFRESH" | PP
NEW_TOKEN=$(echo "$REFRESH" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])" 2>/dev/null)

echo ""
echo "=== 4. validate (новый токен) ==="
curl -s -X POST "$BASE/api/license/validate" -H "Content-Type: application/json" -d "{\"token\":\"$NEW_TOKEN\",\"deviceId\":\"$DEVICE\"}" | PP

echo ""
echo "=== 5. deactivate ==="
curl -s -X POST "$BASE/api/license/deactivate" -H "Content-Type: application/json" -d "{\"deviceId\":\"$DEVICE\",\"licenseKey\":\"$PRO_KEY\"}" | PP

echo ""
echo "=== 6. validate после deactivate (должен fail) ==="
curl -s -X POST "$BASE/api/license/validate" -H "Content-Type: application/json" -d "{\"token\":\"$NEW_TOKEN\",\"deviceId\":\"$DEVICE\"}" | PP

echo ""
echo "============================================"
echo "  ТЕСТ ЗАВЕРШЁН"
echo "============================================"
