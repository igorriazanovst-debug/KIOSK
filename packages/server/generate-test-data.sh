#!/bin/bash

# Test Data Generator for Kiosk Content Platform v3.0
# Creates templates, uploads media, and registers test devices

set -e

SERVER_URL="${1:-http://localhost:3001}"

echo "╔═══════════════════════════════════════════════╗"
echo "║   🧪 Test Data Generator v3.0                ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""
echo "Server: $SERVER_URL"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if server is running
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. HEALTH CHECK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

HEALTH=$(curl -s "$SERVER_URL/api/health")
if echo "$HEALTH" | grep -q "ok"; then
  echo -e "${GREEN}✓${NC} Server is running"
  VERSION=$(echo "$HEALTH" | jq -r '.version')
  echo "  Version: $VERSION"
else
  echo -e "${RED}✗${NC} Server is not responding"
  exit 1
fi

echo ""

# Create test templates
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. CREATING TEST TEMPLATES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Template 1: Welcome Screen
echo "Creating template: Welcome Screen..."
TEMPLATE1=$(curl -s -X POST "$SERVER_URL/api/templates" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Welcome Screen",
    "description": "Simple welcome screen with text and image",
    "category": "basic",
    "tags": ["welcome", "simple"],
    "data": {
      "name": "Welcome Screen",
      "canvas": {
        "width": 1920,
        "height": 1080,
        "backgroundColor": "#2196F3"
      },
      "widgets": [
        {
          "id": "text-1",
          "type": "text",
          "x": 560,
          "y": 440,
          "width": 800,
          "height": 200,
          "properties": {
            "text": "Welcome to Kiosk Platform!",
            "fontSize": 64,
            "fontWeight": "bold",
            "color": "#FFFFFF",
            "textAlign": "center"
          }
        }
      ]
    }
  }')

if echo "$TEMPLATE1" | grep -q "success.*true"; then
  TEMPLATE1_ID=$(echo "$TEMPLATE1" | jq -r '.data.id')
  echo -e "${GREEN}✓${NC} Welcome Screen created (ID: $TEMPLATE1_ID)"
else
  echo -e "${RED}✗${NC} Failed to create Welcome Screen"
fi

# Template 2: Image Gallery
echo "Creating template: Image Gallery..."
TEMPLATE2=$(curl -s -X POST "$SERVER_URL/api/templates" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Image Gallery",
    "description": "Photo gallery with 3x3 grid layout",
    "category": "gallery",
    "tags": ["images", "gallery", "grid"],
    "data": {
      "name": "Image Gallery",
      "canvas": {
        "width": 1920,
        "height": 1080,
        "backgroundColor": "#000000"
      },
      "widgets": [
        {
          "id": "text-1",
          "type": "text",
          "x": 660,
          "y": 50,
          "width": 600,
          "height": 80,
          "properties": {
            "text": "Photo Gallery",
            "fontSize": 48,
            "fontWeight": "bold",
            "color": "#FFFFFF",
            "textAlign": "center"
          }
        }
      ]
    }
  }')

if echo "$TEMPLATE2" | grep -q "success.*true"; then
  TEMPLATE2_ID=$(echo "$TEMPLATE2" | jq -r '.data.id')
  echo -e "${GREEN}✓${NC} Image Gallery created (ID: $TEMPLATE2_ID)"
else
  echo -e "${RED}✗${NC} Failed to create Image Gallery"
fi

# Template 3: Video Player
echo "Creating template: Video Player..."
TEMPLATE3=$(curl -s -X POST "$SERVER_URL/api/templates" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Video Player",
    "description": "Full-screen video player",
    "category": "video",
    "tags": ["video", "player", "fullscreen"],
    "data": {
      "name": "Video Player",
      "canvas": {
        "width": 1920,
        "height": 1080,
        "backgroundColor": "#000000"
      },
      "widgets": [
        {
          "id": "video-1",
          "type": "video",
          "x": 0,
          "y": 0,
          "width": 1920,
          "height": 1080,
          "properties": {
            "videoUrl": "",
            "autoplay": true,
            "loop": true,
            "muted": false
          }
        }
      ]
    }
  }')

if echo "$TEMPLATE3" | grep -q "success.*true"; then
  TEMPLATE3_ID=$(echo "$TEMPLATE3" | jq -r '.data.id')
  echo -e "${GREEN}✓${NC} Video Player created (ID: $TEMPLATE3_ID)"
else
  echo -e "${RED}✗${NC} Failed to create Video Player"
fi

echo ""

# List templates
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. TEMPLATE SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

TEMPLATES=$(curl -s "$SERVER_URL/api/templates")
TEMPLATE_COUNT=$(echo "$TEMPLATES" | jq -r '.data | length')
echo -e "${GREEN}✓${NC} Total templates: $TEMPLATE_COUNT"

echo "$TEMPLATES" | jq -r '.data[] | "  - \(.name) (\(.category))"'

echo ""

# Create test images (sample data URLs)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. MEDIA LIBRARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo -e "${YELLOW}ℹ${NC}  Media upload requires actual files"
echo "   To upload media, use the Editor UI or:"
echo ""
echo "   curl -X POST $SERVER_URL/api/media/upload \\"
echo "     -F 'file=@/path/to/image.jpg' \\"
echo "     -F 'name=My Image'"
echo ""

MEDIA=$(curl -s "$SERVER_URL/api/media")
MEDIA_COUNT=$(echo "$MEDIA" | jq -r '.data | length')
echo -e "${GREEN}✓${NC} Current media files: $MEDIA_COUNT"

echo ""

# Register test devices
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5. TEST DEVICES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo -e "${YELLOW}ℹ${NC}  Devices register automatically when Player connects"
echo "   Current devices:"
echo ""

DEVICES=$(curl -s "$SERVER_URL/api/devices")
DEVICE_COUNT=$(echo "$DEVICES" | jq -r '.data | length')
echo -e "${GREEN}✓${NC} Total devices: $DEVICE_COUNT"

if [ "$DEVICE_COUNT" -gt 0 ]; then
  echo "$DEVICES" | jq -r '.data[] | "  - \(.name) (\(.status)) - Last seen: \(.last_seen)"'
else
  echo "  No devices connected yet"
  echo "  Start a Player to register a device"
fi

echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✓${NC} Server:     Running"
echo -e "${GREEN}✓${NC} Templates:  $TEMPLATE_COUNT created"
echo -e "${GREEN}✓${NC} Media:      $MEDIA_COUNT files"
echo -e "${GREEN}✓${NC} Devices:    $DEVICE_COUNT registered"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "NEXT STEPS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Open Editor:"
echo "   cd packages/editor && npm run dev"
echo ""
echo "2. Configure server in Editor:"
echo "   - Click Server button in Toolbar"
echo "   - Enable Server Integration"
echo "   - URL: $SERVER_URL"
echo ""
echo "3. Browse Templates:"
echo "   - Click 📋 Templates button"
echo "   - Load a template to start editing"
echo ""
echo "4. Start Player:"
echo "   cd packages/player && npm run electron:dev"
echo ""
echo "5. Configure Player:"
echo "   - Open Settings (⚙️)"
echo "   - Enable Server Integration"
echo "   - URL: ${SERVER_URL/http/ws}"
echo ""
echo "6. Deploy to Player:"
echo "   - In Editor, click 📱 Devices"
echo "   - Select your device"
echo "   - Click 🚀 Deploy"
echo ""
echo "✅ Test data generation complete!"
