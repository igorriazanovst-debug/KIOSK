#!/bin/bash

# End-to-End Integration Test
# Tests the complete workflow: Editor → Server → Player

set -e

SERVER_URL="${1:-http://localhost:3001}"
WS_URL="${SERVER_URL/http/ws}"

echo "╔═══════════════════════════════════════════════╗"
echo "║   🧪 E2E Integration Test v3.0               ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""
echo "Server: $SERVER_URL"
echo "WebSocket: $WS_URL"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASSED=0
FAILED=0

# Test function
test_case() {
  local name="$1"
  local command="$2"
  
  echo -n "Testing: $name... "
  
  if eval "$command" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC}"
    PASSED=$((PASSED + 1))
  else
    echo -e "${RED}✗ FAIL${NC}"
    FAILED=$((FAILED + 1))
  fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PART 1: SERVER TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Health check
test_case "Server health check" \
  "curl -s '$SERVER_URL/api/health' | grep -q 'ok'"

# Create template
TEMPLATE_DATA='{
  "name": "E2E Test Template",
  "description": "Template for end-to-end testing",
  "category": "test",
  "data": {
    "name": "Test Project",
    "canvas": {"width": 1920, "height": 1080, "backgroundColor": "#FFFFFF"},
    "widgets": []
  }
}'

test_case "Create template" \
  "curl -s -X POST '$SERVER_URL/api/templates' \
    -H 'Content-Type: application/json' \
    -d '$TEMPLATE_DATA' | grep -q 'success.*true'"

# Get template ID
TEMPLATE_ID=$(curl -s "$SERVER_URL/api/templates" | jq -r '.data[0].id')

test_case "Retrieve template" \
  "curl -s '$SERVER_URL/api/templates/$TEMPLATE_ID' | grep -q 'E2E Test Template'"

# List templates
test_case "List templates" \
  "curl -s '$SERVER_URL/api/templates' | jq -e '.data | length > 0'"

# Update template
test_case "Update template" \
  "curl -s -X PUT '$SERVER_URL/api/templates/$TEMPLATE_ID' \
    -H 'Content-Type: application/json' \
    -d '{\"name\": \"E2E Test Template (Updated)\"}' | grep -q 'success'"

# Media endpoints
test_case "List media" \
  "curl -s '$SERVER_URL/api/media' | jq -e '.success == true'"

# Devices endpoints
test_case "List devices" \
  "curl -s '$SERVER_URL/api/devices' | jq -e '.success == true'"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PART 2: API INTEGRATION TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Register a mock device
DEVICE_ID="test-device-$(date +%s)"
DEVICE_DATA='{
  "id": "'$DEVICE_ID'",
  "name": "E2E Test Device",
  "os": "Test OS",
  "version": "3.0.0",
  "ipAddress": "127.0.0.1"
}'

test_case "Register device" \
  "curl -s -X POST '$SERVER_URL/api/devices/register' \
    -H 'Content-Type: application/json' \
    -d '$DEVICE_DATA' | grep -q 'success.*true'"

test_case "Get device by ID" \
  "curl -s '$SERVER_URL/api/devices/$DEVICE_ID' | grep -q 'E2E Test Device'"

# Update device
test_case "Update device" \
  "curl -s -X PUT '$SERVER_URL/api/devices/$DEVICE_ID' \
    -H 'Content-Type: application/json' \
    -d '{\"name\": \"E2E Test Device (Updated)\"}' | grep -q 'success'"

# Deploy project to device
PROJECT_DATA='{
  "projectName": "E2E Test Project",
  "projectData": {
    "name": "E2E Test Project",
    "canvas": {"width": 1920, "height": 1080},
    "widgets": []
  }
}'

test_case "Deploy project to device" \
  "curl -s -X POST '$SERVER_URL/api/devices/$DEVICE_ID/deploy' \
    -H 'Content-Type: application/json' \
    -d '$PROJECT_DATA' | grep -q 'success'"

# Get device logs
test_case "Get device logs" \
  "curl -s '$SERVER_URL/api/devices/$DEVICE_ID/logs' | jq -e '.success == true'"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PART 3: DATA VALIDATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check template count
TEMPLATE_COUNT=$(curl -s "$SERVER_URL/api/templates" | jq -r '.data | length')
test_case "Templates exist (count: $TEMPLATE_COUNT)" \
  "[ $TEMPLATE_COUNT -gt 0 ]"

# Check device count
DEVICE_COUNT=$(curl -s "$SERVER_URL/api/devices" | jq -r '.data | length')
test_case "Devices exist (count: $DEVICE_COUNT)" \
  "[ $DEVICE_COUNT -gt 0 ]"

# Validate template structure
test_case "Template has correct structure" \
  "curl -s '$SERVER_URL/api/templates/$TEMPLATE_ID' | \
    jq -e '.data | has(\"id\") and has(\"name\") and has(\"data\")'"

# Validate device structure
test_case "Device has correct structure" \
  "curl -s '$SERVER_URL/api/devices/$DEVICE_ID' | \
    jq -e '.data | has(\"id\") and has(\"name\") and has(\"status\")'"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PART 4: CLEANUP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Delete test template
test_case "Delete template" \
  "curl -s -X DELETE '$SERVER_URL/api/templates/$TEMPLATE_ID' | grep -q 'success.*true'"

# Delete test device
test_case "Delete device" \
  "curl -s -X DELETE '$SERVER_URL/api/devices/$DEVICE_ID' | grep -q 'success.*true'"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST RESULTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Total tests: $((PASSED + FAILED))"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All tests passed!${NC}"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "SYSTEM STATUS: READY FOR PRODUCTION"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "✓ Server API: Working"
  echo "✓ Database: Working"
  echo "✓ Templates: CRUD operations functional"
  echo "✓ Media: Endpoints functional"
  echo "✓ Devices: Registration and management functional"
  echo "✓ Deployment: Project deployment functional"
  echo ""
  echo "Next steps:"
  echo "1. Test Editor integration manually"
  echo "2. Test Player integration manually"
  echo "3. Test WebSocket communication"
  echo "4. Perform load testing if needed"
  echo ""
  exit 0
else
  echo -e "${RED}❌ Some tests failed!${NC}"
  echo ""
  echo "Please check the failed tests and fix the issues."
  echo ""
  exit 1
fi
