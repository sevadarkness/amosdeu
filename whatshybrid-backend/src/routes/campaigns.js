/**
 * Campaigns Routes
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('../utils/uuid-wrapper');

const db = require('../utils/database');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, asyncHandler(async (req, res) => {
  const campaigns = db.all(
    `SELECT * FROM campaigns WHERE workspace_id = ? ORDER BY created_at DESC`,
    [req.workspaceId]
  ).map(c => ({ ...c, target_contacts: JSON.parse(c.target_contacts || '[]'), settings: JSON.parse(c.settings || '{}') }));
  res.json({ campaigns });
}));

router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const campaign = db.get('SELECT * FROM campaigns WHERE id = ? AND workspace_id = ?', [req.params.id, req.workspaceId]);
  if (!campaign) throw new AppError('Campaign not found', 404);
  campaign.target_contacts = JSON.parse(campaign.target_contacts || '[]');
  campaign.settings = JSON.parse(campaign.settings || '{}');
  res.json({ campaign });
}));

router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { name, description, type, template_id, target_contacts, settings, scheduled_at } = req.body;
  const id = uuidv4();
  db.run(
    `INSERT INTO campaigns (id, workspace_id, name, description, type, template_id, target_contacts, settings, scheduled_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, req.workspaceId, name, description, type || 'broadcast', template_id, JSON.stringify(target_contacts || []), JSON.stringify(settings || {}), scheduled_at, req.userId]
  );
  const campaign = db.get('SELECT * FROM campaigns WHERE id = ?', [id]);
  const io = req.app.get('io');
  io.to(`workspace:${req.workspaceId}`).emit('campaign:created', campaign);
  res.status(201).json({ campaign });
}));

router.put('/:id', authenticate, asyncHandler(async (req, res) => {
  const { status, sent_count, delivered_count, read_count, failed_count } = req.body;
  const updates = [], values = [];
  if (status) { updates.push('status = ?'); values.push(status); if (status === 'running') updates.push('started_at = CURRENT_TIMESTAMP'); if (status === 'completed') updates.push('completed_at = CURRENT_TIMESTAMP'); }
  if (sent_count !== undefined) { updates.push('sent_count = ?'); values.push(sent_count); }
  if (delivered_count !== undefined) { updates.push('delivered_count = ?'); values.push(delivered_count); }
  if (read_count !== undefined) { updates.push('read_count = ?'); values.push(read_count); }
  if (failed_count !== undefined) { updates.push('failed_count = ?'); values.push(failed_count); }
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(req.params.id, req.workspaceId);
  db.run(`UPDATE campaigns SET ${updates.join(', ')} WHERE id = ? AND workspace_id = ?`, values);
  const campaign = db.get('SELECT * FROM campaigns WHERE id = ?', [req.params.id]);
  const io = req.app.get('io');
  io.to(`workspace:${req.workspaceId}`).emit('campaign:updated', campaign);
  res.json({ campaign });
}));

router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  db.run('DELETE FROM campaigns WHERE id = ? AND workspace_id = ?', [req.params.id, req.workspaceId]);
  res.json({ message: 'Campaign deleted' });
}));

module.exports = router;
