/**
 * Contacts Routes
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { body, query, validationResult } = require('express-validator');

const db = require('../utils/database');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');

/**
 * @route GET /api/v1/contacts
 * @desc Get all contacts with pagination and filters
 */
router.get('/',
  authenticate,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, search, tags, labels, status } = req.query;
    const offset = (page - 1) * limit;

    let sql = `SELECT * FROM contacts WHERE workspace_id = ?`;
    const params = [req.workspaceId];

    if (search) {
      sql += ` AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }

    // Count total
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
    const { total } = db.get(countSql, params);

    // Get paginated results
    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const contacts = db.all(sql, params).map(c => ({
      ...c,
      tags: JSON.parse(c.tags || '[]'),
      labels: JSON.parse(c.labels || '[]'),
      custom_fields: JSON.parse(c.custom_fields || '{}')
    }));

    res.json({
      contacts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  })
);

/**
 * @route GET /api/v1/contacts/:id
 * @desc Get contact by ID
 */
router.get('/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const contact = db.get(
      'SELECT * FROM contacts WHERE id = ? AND workspace_id = ?',
      [req.params.id, req.workspaceId]
    );

    if (!contact) {
      throw new AppError('Contact not found', 404);
    }

    contact.tags = JSON.parse(contact.tags || '[]');
    contact.labels = JSON.parse(contact.labels || '[]');
    contact.custom_fields = JSON.parse(contact.custom_fields || '{}');

    // Get conversations
    const conversations = db.all(
      'SELECT * FROM conversations WHERE contact_id = ? ORDER BY last_message_at DESC LIMIT 10',
      [contact.id]
    );

    // Get deals
    const deals = db.all(
      'SELECT * FROM deals WHERE contact_id = ? ORDER BY created_at DESC',
      [contact.id]
    );

    // Get tasks
    const tasks = db.all(
      'SELECT * FROM tasks WHERE contact_id = ? AND status != "completed" ORDER BY due_date ASC',
      [contact.id]
    );

    res.json({ contact, conversations, deals, tasks });
  })
);

/**
 * @route POST /api/v1/contacts
 * @desc Create new contact
 */
router.post('/',
  authenticate,
  [
    body('phone').notEmpty().trim()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { phone, name, email, avatar, tags, labels, custom_fields, source } = req.body;

    // Check if contact exists
    const existing = db.get(
      'SELECT id FROM contacts WHERE phone = ? AND workspace_id = ?',
      [phone, req.workspaceId]
    );

    if (existing) {
      throw new AppError('Contact with this phone already exists', 400, 'CONTACT_EXISTS');
    }

    const id = uuidv4();

    db.run(
      `INSERT INTO contacts (id, workspace_id, phone, name, email, avatar, tags, labels, custom_fields, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        req.workspaceId,
        phone,
        name || null,
        email || null,
        avatar || null,
        JSON.stringify(tags || []),
        JSON.stringify(labels || []),
        JSON.stringify(custom_fields || {}),
        source || 'manual'
      ]
    );

    const contact = db.get('SELECT * FROM contacts WHERE id = ?', [id]);
    contact.tags = JSON.parse(contact.tags);
    contact.labels = JSON.parse(contact.labels);
    contact.custom_fields = JSON.parse(contact.custom_fields);

    // Emit event via Socket.IO
    const io = req.app.get('io');
    io.to(`workspace:${req.workspaceId}`).emit('contact:created', contact);

    res.status(201).json({ message: 'Contact created', contact });
  })
);

/**
 * @route PUT /api/v1/contacts/:id
 * @desc Update contact
 */
router.put('/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const contact = db.get(
      'SELECT id FROM contacts WHERE id = ? AND workspace_id = ?',
      [req.params.id, req.workspaceId]
    );

    if (!contact) {
      throw new AppError('Contact not found', 404);
    }

    const { name, email, avatar, tags, labels, custom_fields, status } = req.body;

    const updates = [];
    const values = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (email !== undefined) { updates.push('email = ?'); values.push(email); }
    if (avatar !== undefined) { updates.push('avatar = ?'); values.push(avatar); }
    if (tags !== undefined) { updates.push('tags = ?'); values.push(JSON.stringify(tags)); }
    if (labels !== undefined) { updates.push('labels = ?'); values.push(JSON.stringify(labels)); }
    if (custom_fields !== undefined) { updates.push('custom_fields = ?'); values.push(JSON.stringify(custom_fields)); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }

    if (updates.length === 0) {
      throw new AppError('No fields to update', 400);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.params.id);

    db.run(
      `UPDATE contacts SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const updatedContact = db.get('SELECT * FROM contacts WHERE id = ?', [req.params.id]);
    updatedContact.tags = JSON.parse(updatedContact.tags);
    updatedContact.labels = JSON.parse(updatedContact.labels);
    updatedContact.custom_fields = JSON.parse(updatedContact.custom_fields);

    // Emit event
    const io = req.app.get('io');
    io.to(`workspace:${req.workspaceId}`).emit('contact:updated', updatedContact);

    res.json({ message: 'Contact updated', contact: updatedContact });
  })
);

/**
 * @route DELETE /api/v1/contacts/:id
 * @desc Delete contact
 */
router.delete('/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const contact = db.get(
      'SELECT id FROM contacts WHERE id = ? AND workspace_id = ?',
      [req.params.id, req.workspaceId]
    );

    if (!contact) {
      throw new AppError('Contact not found', 404);
    }

    db.run('DELETE FROM contacts WHERE id = ?', [req.params.id]);

    // Emit event
    const io = req.app.get('io');
    io.to(`workspace:${req.workspaceId}`).emit('contact:deleted', { id: req.params.id });

    res.json({ message: 'Contact deleted' });
  })
);

/**
 * @route POST /api/v1/contacts/import
 * @desc Bulk import contacts
 */
router.post('/import',
  authenticate,
  asyncHandler(async (req, res) => {
    const { contacts } = req.body;

    if (!Array.isArray(contacts) || contacts.length === 0) {
      throw new AppError('Contacts array required', 400);
    }

    const results = { created: 0, updated: 0, errors: [] };

    db.transaction(() => {
      for (const contact of contacts) {
        try {
          if (!contact.phone) {
            results.errors.push({ contact, error: 'Phone required' });
            continue;
          }

          const existing = db.get(
            'SELECT id FROM contacts WHERE phone = ? AND workspace_id = ?',
            [contact.phone, req.workspaceId]
          );

          if (existing) {
            // Update
            db.run(
              `UPDATE contacts SET name = COALESCE(?, name), email = COALESCE(?, email), 
               updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
              [contact.name, contact.email, existing.id]
            );
            results.updated++;
          } else {
            // Create
            db.run(
              `INSERT INTO contacts (id, workspace_id, phone, name, email, source)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [uuidv4(), req.workspaceId, contact.phone, contact.name, contact.email, 'import']
            );
            results.created++;
          }
        } catch (error) {
          results.errors.push({ contact, error: error.message });
        }
      }
    });

    res.json({
      message: 'Import completed',
      results
    });
  })
);

module.exports = router;
