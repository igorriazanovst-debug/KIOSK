import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { unlinkSync, existsSync } from 'fs';
import db from '../database/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

const MEDIA_PATH = process.env.MEDIA_PATH || join(__dirname, '../../data/media');

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, MEDIA_PATH);
  },
  filename: (req, file, cb) => {
    const id = uuidv4();
    const ext = extname(file.originalname);
    cb(null, `${id}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100 MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/', 'video/', 'audio/'];
    if (allowedTypes.some(type => file.mimetype.startsWith(type))) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Получить все медиа
router.get('/', (req, res) => {
  try {
    const { type, search } = req.query;
    
    let query = 'SELECT * FROM media';
    const params = [];
    
    if (type) {
      query += ' WHERE type = ?';
      params.push(type);
    }
    
    if (search) {
      query += type ? ' AND' : ' WHERE';
      query += ' name LIKE ?';
      params.push(`%${search}%`);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const media = db.prepare(query).all(...params);
    
    res.json({
      success: true,
      data: media.map(m => ({
        ...m,
        tags: m.tags ? JSON.parse(m.tags) : [],
        url: `/media/${m.file_path.split('/').pop()}`
      }))
    });
  } catch (error) {
    console.error('Error fetching media:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Получить одно медиа
router.get('/:id', (req, res) => {
  try {
    const media = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id);
    
    if (!media) {
      return res.status(404).json({ success: false, error: 'Media not found' });
    }
    
    res.json({
      success: true,
      data: {
        ...media,
        tags: media.tags ? JSON.parse(media.tags) : [],
        url: `/media/${media.file_path.split('/').pop()}`
      }
    });
  } catch (error) {
    console.error('Error fetching media:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Загрузить медиа
router.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    
    const { name, tags } = req.body;
    const id = uuidv4();
    
    const type = req.file.mimetype.split('/')[0]; // 'image', 'video', 'audio'
    
    const stmt = db.prepare(`
      INSERT INTO media (id, name, type, file_path, file_size, mime_type, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      name || req.file.originalname,
      type,
      req.file.path,
      req.file.size,
      req.file.mimetype,
      tags ? JSON.stringify(JSON.parse(tags)) : null
    );
    
    res.json({
      success: true,
      data: {
        id,
        name: name || req.file.originalname,
        type,
        file_size: req.file.size,
        mime_type: req.file.mimetype,
        url: `/media/${req.file.filename}`
      }
    });
  } catch (error) {
    console.error('Error uploading media:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Удалить медиа
router.delete('/:id', (req, res) => {
  try {
    const media = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id);
    
    if (!media) {
      return res.status(404).json({ success: false, error: 'Media not found' });
    }
    
    // Удаляем файл
    if (existsSync(media.file_path)) {
      unlinkSync(media.file_path);
    }
    
    // Удаляем запись из БД
    const stmt = db.prepare('DELETE FROM media WHERE id = ?');
    stmt.run(req.params.id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting media:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
