#!/bin/bash
# fix-osinfo.sh
# osInfo в schema обязательное (String, не String?),
# но DeviceService передаёт params.osInfo которое может быть undefined.
# Заменяем одну строку: подставляем fallback.
#
# cd /opt/kiosk/kiosk-content-platform/packages/server
# bash fix-osinfo.sh

set -e
FILE="src/services/DeviceService.ts"

echo "=== Патчим $FILE ==="

sed -i 's/osInfo: params.osInfo,/osInfo: params.osInfo ? JSON.stringify(params.osInfo) : JSON.stringify({ platform: "unknown" }),/' "$FILE"

grep -n "osInfo" "$FILE"

echo ""
echo "=== Компиляция ==="
npm run build

echo ""
echo "=== Перезапуск ==="
sudo systemctl restart kiosk-license-server
sleep 2

echo ""
echo "=== Тест activate ==="
curl -s -X POST http://localhost:3001/api/license/activate \
  -H "Content-Type: application/json" \
  -d '{"licenseKey":"3VBN-8ZQ9-1MKO-AK0R","deviceId":"fix-test-1","appType":"editor","deviceName":"Fix Test"}' | python3 -c "import sys,json;print(json.dumps(json.load(sys.stdin),indent=2))"
