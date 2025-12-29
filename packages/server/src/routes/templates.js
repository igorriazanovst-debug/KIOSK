import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database/db.js';

const router = express.Router();

// Получить все шаблоны
router.get('/', (req, res) => {
  try {
    const { category, search } = req.query;
    
    let query = 'SELECT * FROM templates';
    const params = [];
    
    if (category) {
      query += ' WHERE category = ?';
      params.push(category);
    }
    
    if (search) {
      query += category ? ' AND' : ' WHERE';
      query += ' (name LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    query += ' ORDER BY updated_at DESC';
    
    const templates = db.prepare(query).all(...params);
    
    res.json({
      success: true,
      data: templates.map(t => ({
        ...t,
        tags: t.tags ? JSON.parse(t.tags) : [],
        data: JSON.parse(t.data)
      }))
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Получить один шаблон
router.get('/:id', (req, res) => {
  try {
    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id);
    
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    
    res.json({
      success: true,
      data: {
        ...template,
        tags: template.tags ? JSON.parse(template.tags) : [],
        data: JSON.parse(template.data)
      }
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Создать шаблон
router.post('/', (req, res) => {
  try {
    const { name, description, thumbnail, data, category, tags } = req.body;
    
    if (!name || !data) {
      return res.status(400).json({ success: false, error: 'Name and data are required' });
    }
    
    const id = uuidv4();
    
    const stmt = db.prepare(`
      INSERT INTO templates (id, name, description, thumbnail, data, category, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      name,
      description || null,
      thumbnail || null,
      JSON.stringify(data),
      category || 'general',
      tags ? JSON.stringify(tags) : null
    );
    
    res.json({
      success: true,
      data: { id, name, description, category, tags }
    });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Обновить шаблон
router.put('/:id', (req, res) => {
  try {
    const { name, description, thumbnail, data, category, tags } = req.body;
    
    const stmt = db.prepare(`
      UPDATE templates 
      SET name = ?, description = ?, thumbnail = ?, data = ?, category = ?, tags = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    const result = stmt.run(
      name,
      description || null,
      thumbnail || null,
      data ? JSON.stringify(data) : null,
      category || 'general',
      tags ? JSON.stringify(tags) : null,
      req.params.id
    );
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    
    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Удалить шаблон
router.delete('/:id', (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM templates WHERE id = ?');
    const result = stmt.run(req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
