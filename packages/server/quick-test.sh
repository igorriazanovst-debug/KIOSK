#!/bin/bash

# Quick JSON Test - проверяет правильность формирования JSON запросов

echo "🧪 Quick JSON Format Test"
echo ""

SERVER="${1:-http://localhost:3001}"

echo "Testing: $SERVER"
echo ""

# Test 1: Health Check
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Health Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

HEALTH=$(curl -s "$SERVER/api/health")
echo "Response: $HEALTH"
echo ""

# Test 2: Create Template with proper JSON
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. Create Template (with jq)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

UNIQUE_NAME="Quick Test $(date +%s)"

# Construct JSON with jq
TEMPLATE_JSON=$(jq -n \
  --arg name "$UNIQUE_NAME" \
  --arg desc "Quick test template" \
  --arg cat "test" \
  '{
    name: $name,
    description: $desc,
    category: $cat,
    tags: ["test"],
    data: {
      name: "Test Project",
      canvas: {width: 1920, height: 1080},
      widgets: []
    }
  }')

echo "JSON to send:"
echo "$TEMPLATE_JSON" | jq .
echo ""

echo "Sending POST request..."
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}\n" -X POST "$SERVER/api/templates" \
  -H "Content-Type: application/json" \
  -d "$TEMPLATE_JSON")

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE")

echo "HTTP Status: $HTTP_CODE"
echo "Response Body:"
echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Template creation succeeded!"
  TEMPLATE_ID=$(echo "$BODY" | jq -r '.data.id' 2>/dev/null)
  echo "Template ID: $TEMPLATE_ID"
  
  # Clean up
  if [ -n "$TEMPLATE_ID" ] && [ "$TEMPLATE_ID" != "null" ]; then
    echo ""
    echo "Cleaning up..."
    DELETE_RESPONSE=$(curl -s -X DELETE "$SERVER/api/templates/$TEMPLATE_ID")
    echo "Delete response: $DELETE_RESPONSE"
  fi
else
  echo "❌ Template creation failed!"
  echo "Expected HTTP 200/201, got: $HTTP_CODE"
fi

echo ""

# Test 3: Register Device with proper JSON
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. Register Device (with jq)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

DEVICE_ID="quick-test-$(date +%s)"

# Construct JSON with jq
DEVICE_JSON=$(jq -n \
  --arg id "$DEVICE_ID" \
  --arg name "Quick Test Device" \
  --arg os "Ubuntu 22.04" \
  --arg version "3.0.0" \
  --arg ip "127.0.0.1" \
  '{
    id: $id,
    name: $name,
    os: $os,
    version: $version,
    ipAddress: $ip
  }')

echo "JSON to send:"
echo "$DEVICE_JSON" | jq .
echo ""

echo "Sending POST request..."
DEV_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}\n" -X POST "$SERVER/api/devices/register" \
  -H "Content-Type: application/json" \
  -d "$DEVICE_JSON")

DEV_HTTP_CODE=$(echo "$DEV_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
DEV_BODY=$(echo "$DEV_RESPONSE" | grep -v "HTTP_CODE")

echo "HTTP Status: $DEV_HTTP_CODE"
echo "Response Body:"
echo "$DEV_BODY" | jq . 2>/dev/null || echo "$DEV_BODY"
echo ""

if [ "$DEV_HTTP_CODE" = "201" ] || [ "$DEV_HTTP_CODE" = "200" ]; then
  echo "✅ Device registration succeeded!"
  REGISTERED_ID=$(echo "$DEV_BODY" | jq -r '.data.id' 2>/dev/null)
  echo "Device ID: $REGISTERED_ID"
  
  # Clean up
  if [ -n "$REGISTERED_ID" ] && [ "$REGISTERED_ID" != "null" ]; then
    echo ""
    echo "Cleaning up..."
    DEL_DEV_RESPONSE=$(curl -s -X DELETE "$SERVER/api/devices/$REGISTERED_ID")
    echo "Delete response: $DEL_DEV_RESPONSE"
  fi
else
  echo "❌ Device registration failed!"
  echo "Expected HTTP 200/201, got: $DEV_HTTP_CODE"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
