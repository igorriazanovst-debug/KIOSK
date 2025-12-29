#!/bin/bash

# Скрипт мониторинга Kiosk Server
# Использование: ./monitor.sh [interval_seconds]

SERVER="http://localhost:3001"
INTERVAL=${1:-5}

clear

while true; do
    # Переход в начало экрана
    tput cup 0 0
    
    echo "╔═══════════════════════════════════════════════╗"
    echo "║   📊 Kiosk Server Monitor v3.0               ║"
    echo "╚═══════════════════════════════════════════════╝"
    echo ""
    
    # Время обновления
    echo "Last update: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "Refresh interval: ${INTERVAL}s (press Ctrl+C to stop)"
    echo ""
    
    # 1. Server Status
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "SERVER STATUS"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    HEALTH=$(curl -s "$SERVER/api/health" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        STATUS=$(echo $HEALTH | jq -r '.status' 2>/dev/null)
        VERSION=$(echo $HEALTH | jq -r '.version' 2>/dev/null)
        UPTIME=$(echo $HEALTH | jq -r '.uptime' 2>/dev/null)
        
        if [ "$STATUS" = "ok" ]; then
            echo -e "Status:   \033[32m● ONLINE\033[0m"
        else
            echo -e "Status:   \033[31m● OFFLINE\033[0m"
        fi
        
        echo "Version:  $VERSION"
        
        # Конвертация uptime в читаемый формат
        if [ -n "$UPTIME" ] && [ "$UPTIME" != "null" ]; then
            HOURS=$(echo "$UPTIME / 3600" | bc)
            MINUTES=$(echo "($UPTIME % 3600) / 60" | bc)
            SECONDS=$(echo "$UPTIME % 60" | bc)
            echo "Uptime:   ${HOURS}h ${MINUTES}m ${SECONDS}s"
        fi
    else
        echo -e "Status:   \033[31m● OFFLINE\033[0m"
        echo "Cannot connect to server"
    fi
    
    echo ""
    
    # 2. System Resources
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "SYSTEM RESOURCES"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # CPU
    if command -v top &> /dev/null; then
        CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')
        echo "CPU:      ${CPU_USAGE}%"
    fi
    
    # Memory
    if command -v free &> /dev/null; then
        MEM_INFO=$(free -m | awk 'NR==2{printf "%.1f%%", $3*100/$2 }')
        echo "Memory:   $MEM_INFO"
    fi
    
    # Disk
    if command -v df &> /dev/null; then
        DISK_USAGE=$(df -h / | awk 'NR==2{print $5}')
        echo "Disk:     $DISK_USAGE"
    fi
    
    echo ""
    
    # 3. Process Info
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "PROCESS INFO"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    PROCESS=$(ps aux | grep "node.*src/index.js" | grep -v grep | head -1)
    
    if [ -n "$PROCESS" ]; then
        PID=$(echo $PROCESS | awk '{print $2}')
        CPU=$(echo $PROCESS | awk '{print $3}')
        MEM=$(echo $PROCESS | awk '{print $4}')
        TIME=$(echo $PROCESS | awk '{print $10}')
        
        echo "PID:      $PID"
        echo "CPU:      ${CPU}%"
        echo "Memory:   ${MEM}%"
        echo "Runtime:  $TIME"
    else
        echo "Process not found"
    fi
    
    echo ""
    
    # 4. Network Connections
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "NETWORK CONNECTIONS"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if command -v netstat &> /dev/null; then
        CONNECTIONS=$(netstat -an 2>/dev/null | grep ":3001" | grep ESTABLISHED | wc -l)
        LISTEN=$(netstat -an 2>/dev/null | grep ":3001" | grep LISTEN | wc -l)
        
        echo "Active:   $CONNECTIONS"
        echo "Listen:   $LISTEN"
    elif command -v ss &> /dev/null; then
        CONNECTIONS=$(ss -tan 2>/dev/null | grep ":3001" | grep ESTAB | wc -l)
        LISTEN=$(ss -tan 2>/dev/null | grep ":3001" | grep LISTEN | wc -l)
        
        echo "Active:   $CONNECTIONS"
        echo "Listen:   $LISTEN"
    else
        echo "Network tools not available"
    fi
    
    echo ""
    
    # 5. Database Stats
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "DATABASE STATS"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    TEMPLATES=$(curl -s "$SERVER/api/templates" 2>/dev/null | jq -r '.data | length' 2>/dev/null)
    MEDIA=$(curl -s "$SERVER/api/media" 2>/dev/null | jq -r '.data | length' 2>/dev/null)
    DEVICES=$(curl -s "$SERVER/api/devices" 2>/dev/null | jq -r '.data | length' 2>/dev/null)
    ONLINE=$(curl -s "$SERVER/api/devices?status=online" 2>/dev/null | jq -r '.data | length' 2>/dev/null)
    
    if [ -n "$TEMPLATES" ] && [ "$TEMPLATES" != "null" ]; then
        echo "Templates:  $TEMPLATES"
    fi
    
    if [ -n "$MEDIA" ] && [ "$MEDIA" != "null" ]; then
        echo "Media:      $MEDIA"
    fi
    
    if [ -n "$DEVICES" ] && [ "$DEVICES" != "null" ]; then
        echo "Devices:    $DEVICES total"
        
        if [ -n "$ONLINE" ] && [ "$ONLINE" != "null" ]; then
            OFFLINE=$((DEVICES - ONLINE))
            echo "            \033[32m$ONLINE online\033[0m / \033[31m$OFFLINE offline\033[0m"
        fi
    fi
    
    echo ""
    
    # 6. Recent Logs (если systemd)
    if command -v journalctl &> /dev/null; then
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "RECENT LOGS (last 5)"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        sudo journalctl -u kiosk-server -n 5 --no-pager 2>/dev/null | tail -5
        
        echo ""
    fi
    
    # Очистка остатков экрана
    tput ed
    
    # Ожидание
    sleep $INTERVAL
done
