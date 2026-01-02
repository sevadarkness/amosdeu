/**
 * Users Routes
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('../utils/uuid-wrapper');
const { body, validationResult } = require('express-validator');

const db = require('../utils/database');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @route GET /api/v1/users
 * @desc Get all users in workspace
 */
router.get('/',
  authenticate,
  asyncHandler(async (req, res) => {
    const users = db.all(
      `SELECT id, email, name, avatar, role, status, created_at
       FROM users WHERE workspace_id = ?`,
      [req.workspaceId]
    );

    res.json({ users });
  })
);

/**
 * @route GET /api/v1/users/:id
 * @desc Get user by ID
 */
router.get('/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = db.get(
      `SELECT id, email, name, avatar, phone, role, status, settings, created_at
       FROM users WHERE id = ? AND workspace_id = ?`,
      [req.params.id, req.workspaceId]
    );

    if (!user) {
      throw new AppError('User not found', 404);
    }

    user.settings = JSON.parse(user.settings || '{}');

    res.json({ user });
  })
);

/**
 * @route PUT /api/v1/users/:id
 * @desc Update user
 */
router.put('/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    // Users can only update themselves unless admin/owner
    if (req.params.id !== req.userId && !['admin', 'owner'].includes(req.user.role)) {
      throw new AppError('Not authorized to update this user', 403);
    }

    const { name, avatar, phone, settings } = req.body;

    const updates = [];
    const values = [];

    if (name) { updates.push('name = ?'); values.push(name); }
    if (avatar) { updates.push('avatar = ?'); values.push(avatar); }
    if (phone) { updates.push('phone = ?'); values.push(phone); }
    if (settings) { updates.push('settings = ?'); values.push(JSON.stringify(settings)); }

    if (updates.length === 0) {
      throw new AppError('No fields to update', 400);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.params.id);

    db.run(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const user = db.get('SELECT id, email, name, avatar, phone, role, settings FROM users WHERE id = ?', [req.params.id]);
    user.settings = JSON.parse(user.settings || '{}');

    res.json({ message: 'User updated', user });
  })
);

/**
 * @route DELETE /api/v1/users/:id
 * @desc Delete user (owner only)
 */
router.delete('/:id',
  authenticate,
  authorize('owner', 'admin'),
  asyncHandler(async (req, res) => {
    if (req.params.id === req.userId) {
      throw new AppError('Cannot delete yourself', 400);
    }

    const user = db.get(
      'SELECT id FROM users WHERE id = ? AND workspace_id = ?',
      [req.params.id, req.workspaceId]
    );

    if (!user) {
      throw new AppError('User not found', 404);
    }

    db.run('DELETE FROM users WHERE id = ?', [req.params.id]);

    res.json({ message: 'User deleted' });
  })
);

module.exports = router;
