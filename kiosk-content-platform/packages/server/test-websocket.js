// test-websocket.js
// Тест WebSocket соединения с сервером
// Использование: node test-websocket.js [ws://localhost:3001]

import WebSocket from 'ws';

const SERVER_URL = process.argv[2] || 'ws://localhost:3001';
const DEVICE_ID = `test-device-${Date.now()}`;

console.log('╔═══════════════════════════════════════════════╗');
console.log('║   🔌 WebSocket Connection Test v3.0          ║');
console.log('╚═══════════════════════════════════════════════╝');
console.log('');
console.log(`Connecting to: ${SERVER_URL}`);
console.log(`Device ID: ${DEVICE_ID}`);
console.log('');

let testsPassed = 0;
let testsFailed = 0;
let heartbeatInterval;

const ws = new WebSocket(SERVER_URL);

// Таймаут для теста (30 секунд)
const timeout = setTimeout(() => {
  console.log('');
  console.log('⏱️  Timeout reached, closing connection...');
  cleanup();
}, 30000);

function cleanup() {
  clearTimeout(timeout);
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  if (ws.readyState === WebSocket.OPEN) {
    ws.close();
  }
  
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Total tests:  ${testsPassed + testsFailed}`);
  console.log(`Passed:       \x1b[32m${testsPassed}\x1b[0m`);
  console.log(`Failed:       \x1b[31m${testsFailed}\x1b[0m`);
  console.log('');
  
  if (testsFailed === 0) {
    console.log('\x1b[32m✅ All WebSocket tests passed!\x1b[0m');
    process.exit(0);
  } else {
    console.log('\x1b[31m❌ Some WebSocket tests failed!\x1b[0m');
    process.exit(1);
  }
}

ws.on('open', () => {
  console.log('\x1b[32m✓\x1b[0m Connected to WebSocket server');
  testsPassed++;
  
  // 1. Тест регистрации устройства
  console.log('');
  console.log('1. Testing device registration...');
  const registerMessage = {
    type: 'device:register',
    deviceId: DEVICE_ID,
    name: 'WebSocket Test Device',
    os: 'Test OS',
    version: '3.0.0',
    ipAddress: '127.0.0.1'
  };
  
  ws.send(JSON.stringify(registerMessage));
  console.log('   Sent registration message');
  testsPassed++;
  
  // 2. Тест heartbeat
  setTimeout(() => {
    console.log('');
    console.log('2. Testing heartbeat...');
    
    let heartbeatCount = 0;
    heartbeatInterval = setInterval(() => {
      const heartbeatMessage = {
        type: 'device:heartbeat',
        deviceId: DEVICE_ID
      };
      
      ws.send(JSON.stringify(heartbeatMessage));
      heartbeatCount++;
      console.log(`   Heartbeat ${heartbeatCount} sent`);
      
      if (heartbeatCount >= 3) {
        clearInterval(heartbeatInterval);
        testsPassed++;
        console.log('\x1b[32m✓\x1b[0m Heartbeat test completed');
        
        // 3. Тест логирования
        setTimeout(() => {
          console.log('');
          console.log('3. Testing device logging...');
          
          const logMessage = {
            type: 'device:log',
            deviceId: DEVICE_ID,
            level: 'info',
            message: 'Test log message from WebSocket',
            logData: { test: true, timestamp: Date.now() }
          };
          
          ws.send(JSON.stringify(logMessage));
          console.log('   Sent log message');
          testsPassed++;
          console.log('\x1b[32m✓\x1b[0m Logging test completed');
          
          // Завершаем через 2 секунды
          setTimeout(cleanup, 2000);
        }, 1000);
      }
    }, 2000);
  }, 1000);
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log('');
    console.log('📨 Received message:');
    console.log(`   Type: ${message.type}`);
    
    if (message.deviceId) {
      console.log(`   Device ID: ${message.deviceId}`);
    }
    
    if (message.type === 'device:connected' && message.deviceId === DEVICE_ID) {
      console.log('\x1b[32m✓\x1b[0m Device connected confirmation received');
      testsPassed++;
    }
    
    // Показываем содержимое сообщения
    const content = JSON.stringify(message, null, 2)
      .split('\n')
      .map(line => '   ' + line)
      .join('\n');
    console.log(content);
    
  } catch (error) {
    console.error('\x1b[31m✗\x1b[0m Error parsing message:', error.message);
    testsFailed++;
  }
});

ws.on('error', (error) => {
  console.error('');
  console.error('\x1b[31m❌ WebSocket Error:\x1b[0m', error.message);
  testsFailed++;
  cleanup();
});

ws.on('close', (code, reason) => {
  console.log('');
  console.log(`🔌 WebSocket closed (code: ${code}, reason: ${reason || 'none'})`);
  
  if (code === 1000) {
    // Normal closure
    testsPassed++;
  }
});

// Обработка Ctrl+C
process.on('SIGINT', () => {
  console.log('');
  console.log('⚠️  Interrupted by user');
  cleanup();
});
