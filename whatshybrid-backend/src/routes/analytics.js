/**
 * Analytics Routes
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('../utils/uuid-wrapper');

const db = require('../utils/database');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');

router.get('/dashboard', authenticate, asyncHandler(async (req, res) => {
  const { period = '7d' } = req.query;
  
  const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const stats = {
    contacts: db.get('SELECT COUNT(*) as total FROM contacts WHERE workspace_id = ?', [req.workspaceId]).total,
    conversations: db.get('SELECT COUNT(*) as total FROM conversations WHERE workspace_id = ?', [req.workspaceId]).total,
    messages: db.get('SELECT COUNT(*) as total FROM messages m JOIN conversations c ON m.conversation_id = c.id WHERE c.workspace_id = ?', [req.workspaceId]).total,
    campaigns: db.get('SELECT COUNT(*) as total FROM campaigns WHERE workspace_id = ?', [req.workspaceId]).total,
    deals: db.get('SELECT COUNT(*) as total, SUM(value) as total_value FROM deals WHERE workspace_id = ?', [req.workspaceId]),
    tasks: db.get('SELECT COUNT(*) as total, SUM(CASE WHEN status = "completed" THEN 1 ELSE 0 END) as completed FROM tasks WHERE workspace_id = ?', [req.workspaceId])
  };

  const messagesByDay = db.all(`
    SELECT DATE(m.created_at) as date, COUNT(*) as count, m.sender_type
    FROM messages m
    JOIN conversations c ON m.conversation_id = c.id
    WHERE c.workspace_id = ? AND m.created_at >= ?
    GROUP BY DATE(m.created_at), m.sender_type
    ORDER BY date
  `, [req.workspaceId, startDate.toISOString()]);

  const dealsByStage = db.all(`
    SELECT stage, COUNT(*) as count, SUM(value) as total_value
    FROM deals WHERE workspace_id = ?
    GROUP BY stage
  `, [req.workspaceId]);

  res.json({ stats, messagesByDay, dealsByStage, period });
}));

router.post('/events', authenticate, asyncHandler(async (req, res) => {
  const { event_type, event_data, session_id } = req.body;
  const id = uuidv4();
  db.run(
    'INSERT INTO analytics_events (id, workspace_id, event_type, event_data, user_id, session_id) VALUES (?, ?, ?, ?, ?, ?)',
    [id, req.workspaceId, event_type, JSON.stringify(event_data || {}), req.userId, session_id]
  );
  res.status(201).json({ id });
}));

router.get('/events', authenticate, asyncHandler(async (req, res) => {
  const { event_type, start_date, end_date, limit = 100 } = req.query;
  let sql = 'SELECT * FROM analytics_events WHERE workspace_id = ?';
  const params = [req.workspaceId];
  if (event_type) { sql += ' AND event_type = ?'; params.push(event_type); }
  if (start_date) { sql += ' AND created_at >= ?'; params.push(start_date); }
  if (end_date) { sql += ' AND created_at <= ?'; params.push(end_date); }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit));
  const events = db.all(sql, params).map(e => ({ ...e, event_data: JSON.parse(e.event_data) }));
  res.json({ events });
}));

module.exports = router;
