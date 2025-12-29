import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database/db.js';
import { broadcast } from '../index.js';

const router = express.Router();

// Получить все устройства
router.get('/', (req, res) => {
  try {
    const { status } = req.query;
    
    let query = 'SELECT * FROM devices';
    const params = [];
    
    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY name ASC';
    
    const devices = db.prepare(query).all(...params);
    
    res.json({
      success: true,
      data: devices.map(d => ({
        ...d,
        settings: d.settings ? JSON.parse(d.settings) : {}
      }))
    });
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Получить одно устройство
router.get('/:id', (req, res) => {
  try {
    const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id);
    
    if (!device) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    
    res.json({
      success: true,
      data: {
        ...device,
        settings: device.settings ? JSON.parse(device.settings) : {}
      }
    });
  } catch (error) {
    console.error('Error fetching device:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Регистрация устройства (из плеера)
router.post('/register', (req, res) => {
  try {
    const { id, name, os, version, ipAddress } = req.body;
    
    if (!id || !name) {
      return res.status(400).json({ success: false, error: 'ID and name are required' });
    }
    
    const deviceId = id || uuidv4();
    
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
    
    res.json({
      success: true,
      data: { id: deviceId, name, status: 'online' }
    });
  } catch (error) {
    console.error('Error registering device:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Обновить устройство
router.put('/:id', (req, res) => {
  try {
    const { name, settings, current_project_id } = req.body;
    
    const updates = [];
    const params = [];
    
    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (settings !== undefined) {
      updates.push('settings = ?');
      params.push(JSON.stringify(settings));
    }
    if (current_project_id !== undefined) {
      updates.push('current_project_id = ?');
      params.push(current_project_id);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(req.params.id);
    
    const stmt = db.prepare(`
      UPDATE devices 
      SET ${updates.join(', ')}
      WHERE id = ?
    `);
    
    const result = stmt.run(...params);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    
    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    console.error('Error updating device:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Удалить устройство
router.delete('/:id', (req, res) => {
  try {
    // Удаляем логи устройства
    db.prepare('DELETE FROM device_logs WHERE device_id = ?').run(req.params.id);
    
    // Удаляем задачи деплоя
    db.prepare('DELETE FROM deployment_tasks WHERE device_id = ?').run(req.params.id);
    
    // Удаляем устройство
    const stmt = db.prepare('DELETE FROM devices WHERE id = ?');
    const result = stmt.run(req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting device:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Получить логи устройства
router.get('/:id/logs', (req, res) => {
  try {
    const { limit = 100, level } = req.query;
    
    let query = 'SELECT * FROM device_logs WHERE device_id = ?';
    const params = [req.params.id];
    
    if (level) {
      query += ' AND level = ?';
      params.push(level);
    }
    
    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(parseInt(limit));
    
    const logs = db.prepare(query).all(...params);
    
    res.json({
      success: true,
      data: logs.map(log => ({
        ...log,
        data: log.data ? JSON.parse(log.data) : null
      }))
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Отправить проект на устройство
router.post('/:id/deploy', (req, res) => {
  try {
    const { projectId, projectName, projectData } = req.body;
    
    if (!projectData) {
      return res.status(400).json({ success: false, error: 'Project data is required' });
    }
    
    const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id);
    
    if (!device) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    
    if (device.status !== 'online') {
      return res.status(400).json({ success: false, error: 'Device is offline' });
    }
    
    const taskId = uuidv4();
    
    // Создаём задачу деплоя
    const stmt = db.prepare(`
      INSERT INTO deployment_tasks (id, project_id, project_name, device_id, status, progress)
      VALUES (?, ?, ?, ?, 'pending', 0)
    `);
    
    stmt.run(taskId, projectId || uuidv4(), projectName || 'Untitled', req.params.id);
    
    // Отправляем через WebSocket
    broadcast({
      type: 'deployment:start',
      taskId,
      deviceId: req.params.id,
      projectData
    });
    
    res.json({
      success: true,
      data: { taskId, status: 'pending' }
    });
  } catch (error) {
    console.error('Error deploying project:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Получить статус деплоя
router.get('/:id/deploy/:taskId', (req, res) => {
  try {
    const task = db.prepare('SELECT * FROM deployment_tasks WHERE id = ? AND device_id = ?')
      .get(req.params.taskId, req.params.id);
    
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    
    res.json({ success: true, data: task });
  } catch (error) {
    console.error('Error fetching deployment task:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
