#!/bin/bash
BASE="http://localhost:3001"
PRO_KEY="3VBN-8ZQ9-1MKO-AK0R"
DEVICE="smoke2-$(date +%s)"
PP() { python3 -c "import sys,json;print(json.dumps(json.load(sys.stdin),indent=2))" 2>/dev/null; }

echo "=== 1. activate ==="
ACTIVATE=$(curl -s -X POST "$BASE/api/license/activate" -H "Content-Type: application/json" -d "{\"licenseKey\":\"$PRO_KEY\",\"deviceId\":\"$DEVICE\",\"appType\":\"editor\",\"deviceName\":\"Smoke2\"}")
echo "$ACTIVATE" | PP
TOKEN=$(echo "$ACTIVATE" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])" 2>/dev/null)

echo ""
echo "=== 2. validate ==="
curl -s -X POST "$BASE/api/license/validate" -H "Content-Type: application/json" -d "{\"token\":\"$TOKEN\",\"deviceId\":\"$DEVICE\"}" | PP

echo ""
echo "=== 3. refresh ==="
REFRESH=$(curl -s -X POST "$BASE/api/license/refresh" -H "Content-Type: application/json" -d "{\"deviceId\":\"$DEVICE\",\"oldToken\":\"$TOKEN\"}")
echo "$REFRESH" | PP

echo ""
echo "=== 4. deactivate ==="
curl -s -X POST "$BASE/api/license/deactivate" -H "Content-Type: application/json" -d "{\"deviceId\":\"$DEVICE\",\"licenseKey\":\"$PRO_KEY\"}" | PP

echo ""
echo "=== 5. admin login ==="
LOGIN=$(curl -s -X POST "$BASE/api/admin/login" -H "Content-Type: application/json" -d '{"email":"admin@kiosk.local","password":"Admin123!"}')
ADMIN=$(echo "$LOGIN" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])" 2>/dev/null)
echo "token: ${ADMIN:0:50}..."

echo ""
echo "=== 6. admin licenses ==="
curl -s "$BASE/api/admin/licenses" -H "Authorization: Bearer $ADMIN" | PP

echo ""
echo "=== 7. admin devices ==="
curl -s "$BASE/api/admin/devices" -H "Authorization: Bearer $ADMIN" | PP

echo ""
echo "=== 8. admin stats ==="
curl -s "$BASE/api/admin/stats" -H "Authorization: Bearer $ADMIN" | PP

echo ""
echo "=== 9. admin audit ==="
curl -s "$BASE/api/admin/audit" -H "Authorization: Bearer $ADMIN" | PP
