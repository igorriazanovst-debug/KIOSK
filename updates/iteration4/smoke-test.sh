BASE="http://localhost:3001"
PRO_KEY="3VBN-8ZQ9-1MKO-AK0R"
DEVICE="smoke-test-$(date +%s)"

echo "=== 1. activate ==="
ACTIVATE=$(curl -s -X POST "$BASE/api/license/activate" \
  -H "Content-Type: application/json" \
  -d "{\"licenseKey\":\"$PRO_KEY\",\"deviceId\":\"$DEVICE\",\"appType\":\"editor\",\"deviceName\":\"Smoke Test\"}")
echo "$ACTIVATE" | python3 -m json.tool
TOKEN=$(echo "$ACTIVATE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

echo "=== 2. validate ==="
curl -s -X POST "$BASE/api/license/validate" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOKEN\",\"deviceId\":\"$DEVICE\"}" | python3 -m json.tool

echo "=== 3. deactivate ==="
curl -s -X POST "$BASE/api/license/deactivate" \
  -H "Content-Type: application/json" \
  -d "{\"deviceId\":\"$DEVICE\",\"licenseKey\":\"$PRO_KEY\"}" | python3 -m json.tool

echo "=== 4. admin login + stats ==="
LOGIN=$(curl -s -X POST "$BASE/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@kiosk.local","password":"Admin123!"}')
ADMIN_TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")
curl -s "$BASE/api/admin/stats" -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -m json.tool