#!/bin/bash

# Server Debug Script - проверяет что происходит на сервере

echo "🔍 Server Debug & Diagnostics"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Server Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

systemctl status kiosk-server --no-pager | head -20

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. Recent Logs (last 30 lines)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

journalctl -u kiosk-server -n 30 --no-pager

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. Check Routes Files"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -d "src/routes" ]; then
    echo "Routes directory exists:"
    ls -la src/routes/
    echo ""
    
    echo "Templates route (first 50 lines):"
    echo "---"
    head -50 src/routes/templates.js
    echo ""
    
    echo "Devices route (first 50 lines):"
    echo "---"
    head -50 src/routes/devices.js
else
    echo "❌ Routes directory not found!"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. Check Main Server File"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -f "src/index.js" ]; then
    echo "Middleware setup:"
    echo "---"
    grep -A 3 "app.use" src/index.js | head -20
    echo ""
    
    echo "Route registration:"
    echo "---"
    grep -B 2 -A 2 "app.use.*api" src/index.js
else
    echo "❌ src/index.js not found!"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5. Manual Test"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Sending test request with curl verbose..."
echo ""

curl -v -X POST http://localhost:3001/api/templates \
  -H "Content-Type: application/json" \
  -d '{"name":"Debug Test","description":"Test","category":"test","tags":["test"],"data":{"name":"Test","canvas":{"width":1920,"height":1080},"widgets":[]}}' \
  2>&1 | head -50

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6. Recommendations"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Based on the logs above, check:"
echo ""
echo "1. Is body-parser configured correctly?"
echo "   app.use(express.json())"
echo ""
echo "2. Are routes properly registered?"
echo "   app.use('/api/templates', templatesRouter)"
echo ""
echo "3. Are there any errors in server logs?"
echo "   Look for 'Error' or 'undefined' in logs"
echo ""
echo "4. Is the database accessible?"
echo "   Check data/kiosk.db exists"
echo ""

echo "To watch logs in real-time, run:"
echo "   journalctl -u kiosk-server -f"
