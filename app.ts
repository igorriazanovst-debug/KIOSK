// packages/server/src/app.ts
// Полный Express сервер с API для Итерации 2

import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { connectDatabase } from './config/database';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Routes
import licenseRoutes from './routes/license.routes';
import adminRoutes from './routes/admin.routes';

// Загрузка переменных окружения
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());

// CORS
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({
  origin: corsOrigin.split(',').map(o => o.trim()),
  credentials: true
}));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

// Применить rate limiting ко всем запросам
app.use('/api/', limiter);

// Более строгий rate limit для sensitive endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many authentication attempts, please try again later.'
});

app.use('/api/admin/login', authLimiter);

// Trust proxy (для корректного определения IP за Nginx)
app.set('trust proxy', 1);

// Health check endpoint (без rate limiting)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Kiosk License Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Kiosk License Server',
    version: '1.0.0',
    status: 'operational',
    endpoints: {
      health: '/health',
      license: {
        activate: 'POST /api/license/activate',
        refresh: 'POST /api/license/refresh',
        validate: 'POST /api/license/validate',
        deactivate: 'POST /api/license/deactivate'
      },
      admin: {
        login: 'POST /api/admin/login',
        licenses: 'GET/POST /api/admin/licenses',
        devices: 'GET/DELETE /api/admin/devices',
        stats: 'GET /api/admin/stats',
        audit: 'GET /api/admin/audit'
      }
    }
  });
});

// API Routes
app.use('/api/license', licenseRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler (должен быть последним)
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    // Connect to database
    await connectDatabase();
    console.log('✅ Database connected');

    // Start listening
    app.listen(PORT, () => {
      console.log('');
      console.log('╔════════════════════════════════════════════════╗');
      console.log('║   Kiosk License Server - Iteration 2          ║');
      console.log('║   Full API with Authentication                ║');
      console.log('╚════════════════════════════════════════════════╝');
      console.log('');
      console.log(`📍 Server:      http://localhost:${PORT}`);
      console.log(`🏥 Health:      http://localhost:${PORT}/health`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('');
      console.log('📡 API Endpoints:');
      console.log('   License API:');
      console.log('   • POST /api/license/activate');
      console.log('   • POST /api/license/refresh');
      console.log('   • POST /api/license/validate');
      console.log('   • POST /api/license/deactivate');
      console.log('');
      console.log('   Admin API:');
      console.log('   • POST /api/admin/login');
      console.log('   • GET  /api/admin/licenses');
      console.log('   • POST /api/admin/licenses');
      console.log('   • GET  /api/admin/devices');
      console.log('   • GET  /api/admin/stats');
      console.log('   • GET  /api/admin/audit');
      console.log('');
      console.log('🔐 Rate Limits:');
      console.log('   • General:       100 req / 15 min');
      console.log('   • Admin login:   5 req / 15 min');
      console.log('');
      console.log('Press Ctrl+C to stop');
      console.log('');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();
