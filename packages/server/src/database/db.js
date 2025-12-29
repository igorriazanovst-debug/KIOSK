import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = process.env.DATABASE_PATH || join(__dirname, '../../data/kiosk.db');
const DATA_DIR = dirname(DB_PATH);

// Создаём директорию если не существует
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Инициализация схемы
export function initDatabase() {
  // Таблица шаблонов
  db.exec(`
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      thumbnail TEXT,
      data TEXT NOT NULL,
      category TEXT,
      tags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Таблица медиа
  db.exec(`
    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER,
      mime_type TEXT,
      width INTEGER,
      height INTEGER,
      duration INTEGER,
      thumbnail TEXT,
      tags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Таблица устройств
  db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'player',
      os TEXT,
      version TEXT,
      ip_address TEXT,
      status TEXT DEFAULT 'offline',
      last_seen DATETIME,
      current_project_id TEXT,
      settings TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Таблица логов устройств
  db.exec(`
    CREATE TABLE IF NOT EXISTS device_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      data TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES devices(id)
    )
  `);

  // Таблица задач деплоя
  db.exec(`
    CREATE TABLE IF NOT EXISTS deployment_tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      project_name TEXT,
      device_id TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      progress INTEGER DEFAULT 0,
      error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (device_id) REFERENCES devices(id)
    )
  `);

  // Индексы
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
    CREATE INDEX IF NOT EXISTS idx_media_type ON media(type);
    CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
    CREATE INDEX IF NOT EXISTS idx_device_logs_device_id ON device_logs(device_id);
    CREATE INDEX IF NOT EXISTS idx_deployment_tasks_device_id ON deployment_tasks(device_id);
    CREATE INDEX IF NOT EXISTS idx_deployment_tasks_status ON deployment_tasks(status);
  `);

  console.log('✅ Database initialized successfully');
}

export default db;
