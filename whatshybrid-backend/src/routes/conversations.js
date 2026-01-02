/**
 * Conversations Routes
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('../utils/uuid-wrapper');

const db = require('../utils/database');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');

/**
 * @route GET /api/v1/conversations
 */
router.get('/',
  authenticate,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, status, assigned_to } = req.query;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT c.*, ct.name as contact_name, ct.phone as contact_phone, ct.avatar as contact_avatar
      FROM conversations c
      LEFT JOIN contacts ct ON c.contact_id = ct.id
      WHERE c.workspace_id = ?
    `;
    const params = [req.workspaceId];

    if (status) {
      sql += ` AND c.status = ?`;
      params.push(status);
    }

    if (assigned_to) {
      sql += ` AND c.assigned_to = ?`;
      params.push(assigned_to);
    }

    sql += ` ORDER BY c.last_message_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const conversations = db.all(sql, params).map(c => ({
      ...c,
      tags: JSON.parse(c.tags || '[]'),
      metadata: JSON.parse(c.metadata || '{}')
    }));

    res.json({ conversations });
  })
);

/**
 * @route GET /api/v1/conversations/:id
 */
router.get('/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const conversation = db.get(
      `SELECT c.*, ct.name as contact_name, ct.phone as contact_phone
       FROM conversations c
       LEFT JOIN contacts ct ON c.contact_id = ct.id
       WHERE c.id = ? AND c.workspace_id = ?`,
      [req.params.id, req.workspaceId]
    );

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    conversation.tags = JSON.parse(conversation.tags || '[]');
    conversation.metadata = JSON.parse(conversation.metadata || '{}');

    // Get messages
    const messages = db.all(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
      [conversation.id]
    ).map(m => ({ ...m, metadata: JSON.parse(m.metadata || '{}') }));

    res.json({ conversation, messages });
  })
);

/**
 * @route POST /api/v1/conversations/:id/messages
 */
router.post('/:id/messages',
  authenticate,
  asyncHandler(async (req, res) => {
    const { content, message_type = 'text', media_url } = req.body;

    const conversation = db.get(
      'SELECT id FROM conversations WHERE id = ? AND workspace_id = ?',
      [req.params.id, req.workspaceId]
    );

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    const messageId = uuidv4();

    db.run(
      `INSERT INTO messages (id, conversation_id, sender_type, sender_id, content, message_type, media_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [messageId, req.params.id, 'user', req.userId, content, message_type, media_url]
    );

    db.run(
      'UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?',
      [req.params.id]
    );

    const message = db.get('SELECT * FROM messages WHERE id = ?', [messageId]);

    // Emit via Socket.IO
    const io = req.app.get('io');
    io.to(`workspace:${req.workspaceId}`).emit('message:created', message);

    res.status(201).json({ message });
  })
);

/**
 * @route PUT /api/v1/conversations/:id
 */
router.put('/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const { status, assigned_to, tags } = req.body;

    const updates = [];
    const values = [];

    if (status) { updates.push('status = ?'); values.push(status); }
    if (assigned_to) { updates.push('assigned_to = ?'); values.push(assigned_to); }
    if (tags) { updates.push('tags = ?'); values.push(JSON.stringify(tags)); }

    if (updates.length === 0) {
      throw new AppError('No fields to update', 400);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.params.id, req.workspaceId);

    db.run(
      `UPDATE conversations SET ${updates.join(', ')} WHERE id = ? AND workspace_id = ?`,
      values
    );

    const conversation = db.get('SELECT * FROM conversations WHERE id = ?', [req.params.id]);

    res.json({ conversation });
  })
);

module.exports = router;
