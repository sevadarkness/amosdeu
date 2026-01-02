/**
 * Tasks Routes
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('../utils/uuid-wrapper');

const db = require('../utils/database');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { status, priority, assigned_to, contact_id, deal_id, due_before } = req.query;
  let sql = 'SELECT t.*, c.name as contact_name FROM tasks t LEFT JOIN contacts c ON t.contact_id = c.id WHERE t.workspace_id = ?';
  const params = [req.workspaceId];
  if (status) { sql += ' AND t.status = ?'; params.push(status); }
  if (priority) { sql += ' AND t.priority = ?'; params.push(priority); }
  if (assigned_to) { sql += ' AND t.assigned_to = ?'; params.push(assigned_to); }
  if (contact_id) { sql += ' AND t.contact_id = ?'; params.push(contact_id); }
  if (deal_id) { sql += ' AND t.deal_id = ?'; params.push(deal_id); }
  if (due_before) { sql += ' AND t.due_date <= ?'; params.push(due_before); }
  sql += ' ORDER BY t.due_date ASC NULLS LAST, t.priority DESC';
  const tasks = db.all(sql, params);
  res.json({ tasks });
}));

router.get('/overdue', authenticate, asyncHandler(async (req, res) => {
  const tasks = db.all(
    `SELECT t.*, c.name as contact_name FROM tasks t 
     LEFT JOIN contacts c ON t.contact_id = c.id 
     WHERE t.workspace_id = ? AND t.status != 'completed' AND t.due_date < datetime('now')
     ORDER BY t.due_date ASC`,
    [req.workspaceId]
  );
  res.json({ tasks });
}));

router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const task = db.get('SELECT * FROM tasks WHERE id = ? AND workspace_id = ?', [req.params.id, req.workspaceId]);
  if (!task) throw new AppError('Task not found', 404);
  res.json({ task });
}));

router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { title, description, type, priority, due_date, contact_id, deal_id, assigned_to } = req.body;
  const id = uuidv4();
  db.run(
    `INSERT INTO tasks (id, workspace_id, title, description, type, priority, due_date, contact_id, deal_id, assigned_to, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, req.workspaceId, title, description, type || 'todo', priority || 'medium', due_date, contact_id, deal_id, assigned_to || req.userId, req.userId]
  );
  const task = db.get('SELECT * FROM tasks WHERE id = ?', [id]);
  const io = req.app.get('io');
  io.to(`workspace:${req.workspaceId}`).emit('task:created', task);
  res.status(201).json({ task });
}));

router.put('/:id', authenticate, asyncHandler(async (req, res) => {
  const { title, description, type, priority, status, due_date, assigned_to } = req.body;
  const updates = [], values = [];
  if (title) { updates.push('title = ?'); values.push(title); }
  if (description !== undefined) { updates.push('description = ?'); values.push(description); }
  if (type) { updates.push('type = ?'); values.push(type); }
  if (priority) { updates.push('priority = ?'); values.push(priority); }
  if (status) { 
    updates.push('status = ?'); 
    values.push(status); 
    if (status === 'completed') updates.push('completed_at = CURRENT_TIMESTAMP');
  }
  if (due_date) { updates.push('due_date = ?'); values.push(due_date); }
  if (assigned_to) { updates.push('assigned_to = ?'); values.push(assigned_to); }
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(req.params.id, req.workspaceId);
  db.run(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ? AND workspace_id = ?`, values);
  const task = db.get('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  const io = req.app.get('io');
  io.to(`workspace:${req.workspaceId}`).emit('task:updated', task);
  res.json({ task });
}));

router.post('/:id/complete', authenticate, asyncHandler(async (req, res) => {
  db.run('UPDATE tasks SET status = "completed", completed_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ?', [req.params.id, req.workspaceId]);
  const task = db.get('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  const io = req.app.get('io');
  io.to(`workspace:${req.workspaceId}`).emit('task:completed', task);
  res.json({ task });
}));

router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  db.run('DELETE FROM tasks WHERE id = ? AND workspace_id = ?', [req.params.id, req.workspaceId]);
  res.json({ message: 'Task deleted' });
}));

module.exports = router;
