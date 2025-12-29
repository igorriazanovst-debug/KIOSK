#!/bin/bash

# API Diagnostic Script
# Helps identify why API calls are failing

echo "╔═══════════════════════════════════════════════╗"
echo "║   🔍 API Diagnostic Tool v3.0                ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""

SERVER_URL="${1:-http://localhost:3001}"

echo "Testing server: $SERVER_URL"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. RAW API RESPONSES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Testing: POST /api/templates"
echo "Request body:"
cat << 'EOF'
{
  "name": "Diagnostic Test",
  "description": "Testing API",
  "category": "test",
  "data": {"name": "Test", "canvas": {"width": 1920, "height": 1080}}
}
EOF
echo ""
echo "Response:"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST "$SERVER_URL/api/templates" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Diagnostic Test",
    "description": "Testing API",
    "category": "test",
    "data": {"name": "Test", "canvas": {"width": 1920, "height": 1080}}
  }')

echo "$RESPONSE"
echo ""

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_STATUS")

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. RESPONSE ANALYSIS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "HTTP Status: $HTTP_STATUS"
echo "Body length: ${#BODY} bytes"
echo ""

if [ "$HTTP_STATUS" = "201" ] || [ "$HTTP_STATUS" = "200" ]; then
  echo -e "${GREEN}✓${NC} Status code is OK"
else
  echo -e "${RED}✗${NC} Status code is NOT OK"
  echo "   Expected: 200 or 201"
  echo "   Got: $HTTP_STATUS"
fi
echo ""

# Check if response is valid JSON
if echo "$BODY" | jq . >/dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} Response is valid JSON"
  echo ""
  echo "Parsed response:"
  echo "$BODY" | jq .
else
  echo -e "${RED}✗${NC} Response is NOT valid JSON"
  echo ""
  echo "Raw response:"
  echo "$BODY"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. COMMON ISSUES & SOLUTIONS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -z "$BODY" ]; then
  echo -e "${RED}Issue: Empty response${NC}"
  echo "Possible causes:"
  echo "  1. Server not running"
  echo "  2. Wrong port"
  echo "  3. Firewall blocking"
  echo ""
  echo "Solutions:"
  echo "  • Check: systemctl status kiosk-server"
  echo "  • Check: netstat -tlnp | grep 3001"
  echo "  • Check: journalctl -u kiosk-server -n 20"
fi

if [ "$HTTP_STATUS" = "404" ]; then
  echo -e "${RED}Issue: 404 Not Found${NC}"
  echo "Possible causes:"
  echo "  1. Wrong API endpoint"
  echo "  2. Server routes not loaded"
  echo ""
  echo "Solutions:"
  echo "  • Verify server routes in src/routes/"
  echo "  • Check server logs for route registration"
fi

if [ "$HTTP_STATUS" = "500" ]; then
  echo -e "${RED}Issue: 500 Internal Server Error${NC}"
  echo "Possible causes:"
  echo "  1. Database error"
  echo "  2. Code error"
  echo "  3. Missing data directory"
  echo ""
  echo "Solutions:"
  echo "  • Check server logs: journalctl -u kiosk-server -n 50"
  echo "  • Verify data directory exists: ls -la data/"
  echo "  • Check database: sqlite3 data/kiosk.db '.tables'"
fi

if echo "$BODY" | grep -q "error" 2>/dev/null; then
  echo -e "${YELLOW}Warning: Error in response${NC}"
  echo "Error message:"
  echo "$BODY" | jq -r '.error // .message // "Unknown"' 2>/dev/null || echo "$BODY"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. SERVER STATUS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if server process is running
if pgrep -f "node.*server" > /dev/null; then
  echo -e "${GREEN}✓${NC} Server process is running"
  echo "   PID: $(pgrep -f "node.*server")"
else
  echo -e "${RED}✗${NC} Server process NOT found"
fi

# Check if port is listening
if netstat -tln 2>/dev/null | grep -q ":3001" || ss -tln 2>/dev/null | grep -q ":3001"; then
  echo -e "${GREEN}✓${NC} Port 3001 is listening"
else
  echo -e "${RED}✗${NC} Port 3001 is NOT listening"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5. RECOMMENDED ACTIONS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "1. Check server logs:"
echo "   journalctl -u kiosk-server -f"
echo ""

echo "2. Test health endpoint:"
echo "   curl -v http://localhost:3001/api/health"
echo ""

echo "3. Restart server:"
echo "   systemctl restart kiosk-server"
echo ""

echo "4. Check database:"
echo "   sqlite3 /opt/kiosk/packages/server/data/kiosk.db '.tables'"
echo ""

echo "5. Check routes file:"
echo "   cat /opt/kiosk/packages/server/src/routes/templates.js"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "DONE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
