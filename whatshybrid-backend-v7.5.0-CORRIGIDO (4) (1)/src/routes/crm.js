/**
 * CRM Routes (Deals & Pipeline)
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

const db = require('../utils/database');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');

// ===== DEALS =====

router.get('/deals', authenticate, asyncHandler(async (req, res) => {
  const { stage, assigned_to, contact_id } = req.query;
  let sql = `SELECT d.*, c.name as contact_name, c.phone as contact_phone FROM deals d LEFT JOIN contacts c ON d.contact_id = c.id WHERE d.workspace_id = ?`;
  const params = [req.workspaceId];
  if (stage) { sql += ' AND d.stage = ?'; params.push(stage); }
  if (assigned_to) { sql += ' AND d.assigned_to = ?'; params.push(assigned_to); }
  if (contact_id) { sql += ' AND d.contact_id = ?'; params.push(contact_id); }
  sql += ' ORDER BY d.created_at DESC';
  const deals = db.all(sql, params).map(d => ({ ...d, tags: JSON.parse(d.tags || '[]'), custom_fields: JSON.parse(d.custom_fields || '{}') }));
  res.json({ deals });
}));

router.get('/deals/:id', authenticate, asyncHandler(async (req, res) => {
  const deal = db.get('SELECT d.*, c.name as contact_name FROM deals d LEFT JOIN contacts c ON d.contact_id = c.id WHERE d.id = ? AND d.workspace_id = ?', [req.params.id, req.workspaceId]);
  if (!deal) throw new AppError('Deal not found', 404);
  deal.tags = JSON.parse(deal.tags || '[]');
  deal.custom_fields = JSON.parse(deal.custom_fields || '{}');
  const tasks = db.all('SELECT * FROM tasks WHERE deal_id = ? ORDER BY due_date ASC', [deal.id]);
  res.json({ deal, tasks });
}));

router.post('/deals', authenticate, asyncHandler(async (req, res) => {
  const { contact_id, title, description, value, stage, probability, expected_close_date, assigned_to, tags, custom_fields } = req.body;
  const id = uuidv4();
  db.run(
    `INSERT INTO deals (id, workspace_id, contact_id, title, description, value, stage, probability, expected_close_date, assigned_to, tags, custom_fields, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, req.workspaceId, contact_id, title, description, value || 0, stage || 'lead', probability || 0, expected_close_date, assigned_to, JSON.stringify(tags || []), JSON.stringify(custom_fields || {}), req.userId]
  );
  const deal = db.get('SELECT * FROM deals WHERE id = ?', [id]);
  const io = req.app.get('io');
  io.to(`workspace:${req.workspaceId}`).emit('deal:created', deal);
  res.status(201).json({ deal });
}));

router.put('/deals/:id', authenticate, asyncHandler(async (req, res) => {
  const { title, description, value, stage, probability, expected_close_date, assigned_to, tags, custom_fields } = req.body;
  const updates = [], values = [];
  if (title) { updates.push('title = ?'); values.push(title); }
  if (description !== undefined) { updates.push('description = ?'); values.push(description); }
  if (value !== undefined) { updates.push('value = ?'); values.push(value); }
  if (stage) { updates.push('stage = ?'); values.push(stage); }
  if (probability !== undefined) { updates.push('probability = ?'); values.push(probability); }
  if (expected_close_date) { updates.push('expected_close_date = ?'); values.push(expected_close_date); }
  if (assigned_to) { updates.push('assigned_to = ?'); values.push(assigned_to); }
  if (tags) { updates.push('tags = ?'); values.push(JSON.stringify(tags)); }
  if (custom_fields) { updates.push('custom_fields = ?'); values.push(JSON.stringify(custom_fields)); }
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(req.params.id, req.workspaceId);
  db.run(`UPDATE deals SET ${updates.join(', ')} WHERE id = ? AND workspace_id = ?`, values);
  const deal = db.get('SELECT * FROM deals WHERE id = ?', [req.params.id]);
  const io = req.app.get('io');
  io.to(`workspace:${req.workspaceId}`).emit('deal:updated', deal);
  res.json({ deal });
}));

router.delete('/deals/:id', authenticate, asyncHandler(async (req, res) => {
  db.run('DELETE FROM deals WHERE id = ? AND workspace_id = ?', [req.params.id, req.workspaceId]);
  res.json({ message: 'Deal deleted' });
}));

// ===== PIPELINE STAGES =====

router.get('/pipeline', authenticate, asyncHandler(async (req, res) => {
  const stages = db.all('SELECT * FROM pipeline_stages WHERE workspace_id = ? ORDER BY position', [req.workspaceId]);
  res.json({ stages });
}));

router.post('/pipeline/stages', authenticate, asyncHandler(async (req, res) => {
  const { name, color, position } = req.body;
  const id = uuidv4();
  db.run('INSERT INTO pipeline_stages (id, workspace_id, name, color, position) VALUES (?, ?, ?, ?, ?)', [id, req.workspaceId, name, color, position || 0]);
  const stage = db.get('SELECT * FROM pipeline_stages WHERE id = ?', [id]);
  res.status(201).json({ stage });
}));

router.put('/pipeline/stages/:id', authenticate, asyncHandler(async (req, res) => {
  const { name, color, position } = req.body;
  const updates = [], values = [];
  if (name) { updates.push('name = ?'); values.push(name); }
  if (color) { updates.push('color = ?'); values.push(color); }
  if (position !== undefined) { updates.push('position = ?'); values.push(position); }
  values.push(req.params.id, req.workspaceId);
  db.run(`UPDATE pipeline_stages SET ${updates.join(', ')} WHERE id = ? AND workspace_id = ?`, values);
  const stage = db.get('SELECT * FROM pipeline_stages WHERE id = ?', [req.params.id]);
  res.json({ stage });
}));

router.delete('/pipeline/stages/:id', authenticate, asyncHandler(async (req, res) => {
  db.run('DELETE FROM pipeline_stages WHERE id = ? AND workspace_id = ?', [req.params.id, req.workspaceId]);
  res.json({ message: 'Stage deleted' });
}));

// ===== LABELS =====

router.get('/labels', authenticate, asyncHandler(async (req, res) => {
  const labels = db.all('SELECT * FROM labels WHERE workspace_id = ?', [req.workspaceId]);
  res.json({ labels });
}));

router.post('/labels', authenticate, asyncHandler(async (req, res) => {
  const { name, color, description } = req.body;
  const id = uuidv4();
  db.run('INSERT INTO labels (id, workspace_id, name, color, description) VALUES (?, ?, ?, ?, ?)', [id, req.workspaceId, name, color, description]);
  const label = db.get('SELECT * FROM labels WHERE id = ?', [id]);
  res.status(201).json({ label });
}));

router.put('/labels/:id', authenticate, asyncHandler(async (req, res) => {
  const { name, color, description } = req.body;
  db.run('UPDATE labels SET name = COALESCE(?, name), color = COALESCE(?, color), description = COALESCE(?, description) WHERE id = ? AND workspace_id = ?', [name, color, description, req.params.id, req.workspaceId]);
  const label = db.get('SELECT * FROM labels WHERE id = ?', [req.params.id]);
  res.json({ label });
}));

router.delete('/labels/:id', authenticate, asyncHandler(async (req, res) => {
  db.run('DELETE FROM labels WHERE id = ? AND workspace_id = ?', [req.params.id, req.workspaceId]);
  res.json({ message: 'Label deleted' });
}));

module.exports = router;
