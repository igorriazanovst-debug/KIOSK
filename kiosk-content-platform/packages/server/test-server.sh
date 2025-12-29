#!/bin/bash

# Цвета для вывода
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SERVER="${1:-http://localhost:3001}"
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

echo "╔═══════════════════════════════════════════════╗"
echo "║   🧪 Kiosk Server Test Suite v3.0            ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""
echo "Testing server: $SERVER"
echo ""

# Функция для тестирования
test_api() {
    local name="$1"
    local expected="$2"
    local actual="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ "$actual" = "$expected" ]; then
        echo -e "${GREEN}✓${NC} $name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗${NC} $name (expected: $expected, got: $actual)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# 1. Health Check
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. HEALTH CHECK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

HEALTH=$(curl -s "$SERVER/api/health")
STATUS=$(echo $HEALTH | jq -r '.status' 2>/dev/null)
VERSION=$(echo $HEALTH | jq -r '.version' 2>/dev/null)

test_api "Server is running" "ok" "$STATUS"
test_api "Version is 3.0.0" "3.0.0" "$VERSION"

if [ "$STATUS" = "ok" ]; then
    UPTIME=$(echo $HEALTH | jq -r '.uptime')
    echo "   Uptime: ${UPTIME}s"
fi
echo ""

# 2. Templates API
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. TEMPLATES API"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Create Template
echo "Creating template..."
UNIQUE_NAME="Test Template $(date +%s)"

# Use jq to properly construct JSON
TEMPLATE_JSON=$(jq -n \
  --arg name "$UNIQUE_NAME" \
  --arg desc "Automated test template" \
  --arg cat "test" \
  '{
    name: $name,
    description: $desc,
    category: $cat,
    tags: ["test", "automation"],
    data: {
      name: "Test Project",
      canvas: {width: 1920, height: 1080},
      widgets: []
    }
  }')

CREATE_RESPONSE=$(curl -s -X POST "$SERVER/api/templates" \
  -H "Content-Type: application/json" \
  -d "$TEMPLATE_JSON")

TEMPLATE_ID=$(echo "$CREATE_RESPONSE" | jq -r '.data.id' 2>/dev/null)
CREATE_SUCCESS=$(echo "$CREATE_RESPONSE" | jq -r '.success' 2>/dev/null)

test_api "Create template" "true" "$CREATE_SUCCESS"

if [ "$TEMPLATE_ID" != "null" ] && [ -n "$TEMPLATE_ID" ]; then
    echo "   Template ID: $TEMPLATE_ID"
    
    # Get Template
    GET_RESPONSE=$(curl -s "$SERVER/api/templates/$TEMPLATE_ID")
    GET_SUCCESS=$(echo "$GET_RESPONSE" | jq -r '.success' 2>/dev/null)
    GET_NAME=$(echo "$GET_RESPONSE" | jq -r '.data.name' 2>/dev/null)
    
    test_api "Get template by ID" "true" "$GET_SUCCESS"
    test_api "Template name matches" "$UNIQUE_NAME" "$GET_NAME"
    
    # List Templates
    LIST_RESPONSE=$(curl -s "$SERVER/api/templates")
    LIST_SUCCESS=$(echo "$LIST_RESPONSE" | jq -r '.success' 2>/dev/null)
    LIST_COUNT=$(echo "$LIST_RESPONSE" | jq -r '.data | length' 2>/dev/null)
    
    test_api "List templates" "true" "$LIST_SUCCESS"
    
    if [ "$LIST_COUNT" -gt 0 ] 2>/dev/null; then
        echo -e "${GREEN}✓${NC} Found $LIST_COUNT template(s)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗${NC} No templates found"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    # Update Template
    UPDATE_RESPONSE=$(curl -s -X PUT "$SERVER/api/templates/$TEMPLATE_ID" \
      -H "Content-Type: application/json" \
      -d '{"name": "Updated Test Template"}')
    UPDATE_SUCCESS=$(echo "$UPDATE_RESPONSE" | jq -r '.success' 2>/dev/null)
    
    test_api "Update template" "true" "$UPDATE_SUCCESS"
    
    # Delete Template
    DELETE_RESPONSE=$(curl -s -X DELETE "$SERVER/api/templates/$TEMPLATE_ID")
    DELETE_SUCCESS=$(echo "$DELETE_RESPONSE" | jq -r '.success' 2>/dev/null)
    
    test_api "Delete template" "true" "$DELETE_SUCCESS"
else
    echo -e "${YELLOW}ℹ${NC}  Template creation failed, skipping related tests"
    echo "   Response: $CREATE_RESPONSE"
fi
echo ""

# 3. Devices API
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. DEVICES API"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Register Device
echo "Registering device..."
DEVICE_ID="test-device-$(date +%s)"

# Use jq to properly construct JSON
DEVICE_JSON=$(jq -n \
  --arg id "$DEVICE_ID" \
  --arg name "Test Kiosk" \
  --arg os "Ubuntu 22.04" \
  --arg version "3.0.0" \
  --arg ip "192.168.1.100" \
  '{
    id: $id,
    name: $name,
    os: $os,
    version: $version,
    ipAddress: $ip
  }')

REGISTER_RESPONSE=$(curl -s -X POST "$SERVER/api/devices/register" \
  -H "Content-Type: application/json" \
  -d "$DEVICE_JSON")

REGISTER_SUCCESS=$(echo "$REGISTER_RESPONSE" | jq -r '.success' 2>/dev/null)
REGISTERED_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.data.id' 2>/dev/null)

test_api "Register device" "true" "$REGISTER_SUCCESS"
test_api "Device ID matches" "$DEVICE_ID" "$REGISTERED_ID"

if [ "$REGISTER_SUCCESS" = "true" ]; then
    # Get Device
    DEVICE_RESPONSE=$(curl -s "$SERVER/api/devices/$DEVICE_ID")
    DEVICE_SUCCESS=$(echo "$DEVICE_RESPONSE" | jq -r '.success' 2>/dev/null)
    DEVICE_NAME=$(echo "$DEVICE_RESPONSE" | jq -r '.data.name' 2>/dev/null)
    
    test_api "Get device by ID" "true" "$DEVICE_SUCCESS"
    test_api "Device name matches" "Test Kiosk" "$DEVICE_NAME"
    
    # List Devices
    DEVICES_RESPONSE=$(curl -s "$SERVER/api/devices")
    DEVICES_SUCCESS=$(echo "$DEVICES_RESPONSE" | jq -r '.success' 2>/dev/null)
    DEVICES_COUNT=$(echo "$DEVICES_RESPONSE" | jq -r '.data | length' 2>/dev/null)
    
    test_api "List devices" "true" "$DEVICES_SUCCESS"
    
    if [ "$DEVICES_COUNT" -gt 0 ] 2>/dev/null; then
        echo -e "${GREEN}✓${NC} Found $DEVICES_COUNT device(s)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗${NC} No devices found"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    # Update Device
    UPDATE_DEV_RESPONSE=$(curl -s -X PUT "$SERVER/api/devices/$DEVICE_ID" \
      -H "Content-Type: application/json" \
      -d '{"name": "Updated Test Kiosk"}')
    UPDATE_DEV_SUCCESS=$(echo "$UPDATE_DEV_RESPONSE" | jq -r '.success' 2>/dev/null)
    
    test_api "Update device" "true" "$UPDATE_DEV_SUCCESS"
    
    # Delete Device
    DELETE_DEV_RESPONSE=$(curl -s -X DELETE "$SERVER/api/devices/$DEVICE_ID")
    DELETE_DEV_SUCCESS=$(echo "$DELETE_DEV_RESPONSE" | jq -r '.success' 2>/dev/null)
    
    test_api "Delete device" "true" "$DELETE_DEV_SUCCESS"
fi
echo ""

# 4. Media API (basic test without file upload)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. MEDIA API"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

MEDIA_RESPONSE=$(curl -s "$SERVER/api/media")
MEDIA_SUCCESS=$(echo "$MEDIA_RESPONSE" | jq -r '.success' 2>/dev/null)

test_api "List media" "true" "$MEDIA_SUCCESS"

echo -e "${YELLOW}ℹ${NC}  File upload test skipped (requires multipart/form-data)"
echo ""

# 5. WebSocket Test
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5. WEBSOCKET"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

WS_URL=$(echo $SERVER | sed 's/http/ws/')
echo "Testing WebSocket connection to $WS_URL"

# Simple connectivity test
if command -v wscat &> /dev/null; then
    timeout 2s wscat -c "$WS_URL" < /dev/null &> /dev/null
    if [ $? -eq 124 ]; then
        echo -e "${GREEN}✓${NC} WebSocket connection successful"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗${NC} WebSocket connection failed"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
else
    echo -e "${YELLOW}ℹ${NC}  wscat not installed, skipping WebSocket test"
    echo "   Install: npm install -g wscat"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Total tests:  $TOTAL_TESTS"
echo -e "Passed:       ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed:       ${RED}$FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed!${NC}"
    exit 1
fi
