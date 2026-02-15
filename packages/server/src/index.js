import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, existsSync } from 'fs';
import db, { initDatabase } from './database/db.js';

// Routes
import templatesRouter from './routes/templates.js';
import mediaRouter from './routes/media.js';
import devicesRouter from './routes/devices.js';
import buildsRouter from './routes/builds.js';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const MEDIA_PATH = process.env.MEDIA_PATH || join(__dirname, '../data/media');

// Создаём директории
if (!existsSync(MEDIA_PATH)) {
  mkdirSync(MEDIA_PATH, { recursive: true });
}

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Статические файлы (медиа)
app.use('/media', express.static(MEDIA_PATH));

// API Routes
app.use('/api/templates', templatesRouter);
app.use('/api/media', mediaRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/builds', buildsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: '3.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Инициализация базы данных
initDatabase();

// Запуск HTTP сервера
const server = app.listen(PORT, HOST, () => {
  console.log(`
╔═══════════════════════════════════════════════╗
║   🚀 KIOSK CONTENT PLATFORM SERVER v3.0      ║
╚═══════════════════════════════════════════════╝

📡 Server running on: http://${HOST}:${PORT}
🗄️  Database: ${process.env.DATABASE_PATH || './data/kiosk.db'}
📁 Media path: ${MEDIA_PATH}

API Endpoints:
  GET    /api/health          - Health check
  
  GET    /api/templates       - List templates
  POST   /api/templates       - Create template
  GET    /api/templates/:id   - Get template
  PUT    /api/templates/:id   - Update template
  DELETE /api/templates/:id   - Delete template
  
  GET    /api/media           - List media
  POST   /api/media/upload    - Upload media
  GET    /api/media/:id       - Get media
  DELETE /api/media/:id       - Delete media
  
  GET    /api/devices         - List devices
  POST   /api/devices/register - Register device
  GET    /api/devices/:id     - Get device
  PUT    /api/devices/:id     - Update device
  DELETE /api/devices/:id     - Delete device
  POST   /api/devices/:id/deploy - Deploy project

  POST   /api/builds             - Start build
  GET    /api/builds             - List builds
  GET    /api/builds/:id         - Build status
  GET    /api/builds/download/:f - Download installer
  DELETE /api/builds/:id         - Delete build

WebSocket: ws://${HOST}:${PORT}

Press Ctrl+C to stop
  `);
});

// WebSocket сервер
const wss = new WebSocketServer({ server });

// Хранилище подключений устройств
const deviceConnections = new Map();

wss.on('connection', (ws, req) => {
  console.log('📱 New WebSocket connection');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      switch (data.type) {
        case 'device:register':
          handleDeviceRegister(ws, data);
          break;
        case 'device:heartbeat':
          handleDeviceHeartbeat(data);
          break;
        case 'device:log':
          handleDeviceLog(data);
          break;
        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });

  ws.on('close', () => {
    // Убираем устройство из активных подключений
    for (const [deviceId, connection] of deviceConnections.entries()) {
      if (connection === ws) {
        deviceConnections.delete(deviceId);
        updateDeviceStatus(deviceId, 'offline');
        broadcast({ type: 'device:disconnected', deviceId });
        console.log(`📱 Device ${deviceId} disconnected`);
        break;
      }
    }
  });
});

function handleDeviceRegister(ws, data) {
  const { deviceId, name, os, version, ipAddress } = data;
  
  deviceConnections.set(deviceId, ws);
  
  // Обновляем статус устройства в БД
  const stmt = db.prepare(`
    INSERT INTO devices (id, name, os, version, ip_address, status, last_seen)
    VALUES (?, ?, ?, ?, ?, 'online', CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      name = ?,
      os = ?,
      version = ?,
      ip_address = ?,
      status = 'online',
      last_seen = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
  `);
  
  stmt.run(deviceId, name, os, version, ipAddress, name, os, version, ipAddress);
  
  broadcast({ type: 'device:connected', deviceId, name, status: 'online' });
  console.log(`✅ Device registered: ${name} (${deviceId})`);
}

function handleDeviceHeartbeat(data) {
  const { deviceId } = data;
  updateDeviceStatus(deviceId, 'online');
}

function handleDeviceLog(data) {
  const { deviceId, level, message, logData } = data;
  
  const stmt = db.prepare(`
    INSERT INTO device_logs (device_id, level, message, data)
    VALUES (?, ?, ?, ?)
  `);
  
  stmt.run(deviceId, level, message, logData ? JSON.stringify(logData) : null);
}

function updateDeviceStatus(deviceId, status) {
  const stmt = db.prepare(`
    UPDATE devices 
    SET status = ?, last_seen = CURRENT_TIMESTAMP 
    WHERE id = ?
  `);
  stmt.run(status, deviceId);
}

function broadcast(data) {
  const message = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(message);
    }
  });
}

// Экспорт для использования в других модулях
export { wss, deviceConnections, broadcast };

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  db.close();
  server.close(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});
