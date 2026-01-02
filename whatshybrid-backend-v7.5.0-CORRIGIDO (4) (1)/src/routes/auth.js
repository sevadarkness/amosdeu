/**
 * Authentication Routes
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');

const config = require('../../config');
const db = require('../utils/database');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authLimiter } = require('../middleware/rateLimiter');
const { authenticate } = require('../middleware/auth');

// Generate tokens
function generateTokens(userId) {
  const accessToken = jwt.sign(
    { userId },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    config.jwt.secret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );

  // Store refresh token
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  db.run(
    'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
    [uuidv4(), userId, refreshToken, expiresAt.toISOString()]
  );

  return { accessToken, refreshToken };
}

/**
 * @route POST /api/v1/auth/register
 * @desc Register new user
 */
router.post('/register',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('name').trim().notEmpty()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, name } = req.body;

    // Check if user exists
    const existingUser = db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) {
      throw new AppError('Email already registered', 400, 'EMAIL_EXISTS');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create workspace
    const workspaceId = uuidv4();
    const userId = uuidv4();

    db.transaction(() => {
      // Create user
      db.run(
        `INSERT INTO users (id, email, password, name, role, workspace_id) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, email, hashedPassword, name, 'owner', workspaceId]
      );

      // Create workspace
      db.run(
        `INSERT INTO workspaces (id, name, owner_id, credits) 
         VALUES (?, ?, ?, ?)`,
        [workspaceId, `${name}'s Workspace`, userId, 100]
      );

      // Create default pipeline stages
      const stages = [
        { name: 'Lead', color: '#3b82f6', position: 0 },
        { name: 'Qualificado', color: '#8b5cf6', position: 1 },
        { name: 'Proposta', color: '#f59e0b', position: 2 },
        { name: 'Negociação', color: '#ef4444', position: 3 },
        { name: 'Fechado', color: '#10b981', position: 4 }
      ];

      stages.forEach(stage => {
        db.run(
          'INSERT INTO pipeline_stages (id, workspace_id, name, color, position) VALUES (?, ?, ?, ?, ?)',
          [uuidv4(), workspaceId, stage.name, stage.color, stage.position]
        );
      });

      // Create default labels
      const labels = [
        { name: 'VIP', color: '#fbbf24' },
        { name: 'Novo', color: '#3b82f6' },
        { name: 'Recorrente', color: '#10b981' },
        { name: 'Pendente', color: '#ef4444' }
      ];

      labels.forEach(label => {
        db.run(
          'INSERT INTO labels (id, workspace_id, name, color) VALUES (?, ?, ?, ?)',
          [uuidv4(), workspaceId, label.name, label.color]
        );
      });
    });

    // Generate tokens
    const tokens = generateTokens(userId);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: userId,
        email,
        name,
        workspaceId
      },
      ...tokens
    });
  })
);

/**
 * @route POST /api/v1/auth/login
 * @desc Login user
 */
router.post('/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const user = db.get(
      'SELECT id, email, password, name, role, workspace_id, status FROM users WHERE email = ?',
      [email]
    );

    if (!user) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    if (user.status !== 'active') {
      throw new AppError('Account is not active', 403, 'ACCOUNT_INACTIVE');
    }

    // Check password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    // Generate tokens
    const tokens = generateTokens(user.id);

    // Get workspace info
    const workspace = db.get(
      'SELECT id, name, plan, credits FROM workspaces WHERE id = ?',
      [user.workspace_id]
    );

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        workspaceId: user.workspace_id
      },
      workspace,
      ...tokens
    });
  })
);

/**
 * @route POST /api/v1/auth/refresh
 * @desc Refresh access token
 */
router.post('/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AppError('Refresh token required', 400);
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, config.jwt.secret);
    } catch (jwtError) {
      // Token inválido ou expirado - retornar erro sem logar muito
      throw new AppError('Invalid refresh token', 401, 'TOKEN_INVALID');
    }

    if (decoded.type !== 'refresh') {
      throw new AppError('Invalid token type', 400);
    }

    // Check if token exists in database
    const storedToken = db.get(
      'SELECT * FROM refresh_tokens WHERE token = ? AND user_id = ?',
      [refreshToken, decoded.userId]
    );

    if (!storedToken) {
      throw new AppError('Invalid refresh token', 401, 'TOKEN_INVALID');
    }

    // Check expiration
    if (new Date(storedToken.expires_at) < new Date()) {
      db.run('DELETE FROM refresh_tokens WHERE id = ?', [storedToken.id]);
      throw new AppError('Refresh token expired', 401);
    }

    // Delete old token
    db.run('DELETE FROM refresh_tokens WHERE id = ?', [storedToken.id]);

    // Generate new tokens
    const tokens = generateTokens(decoded.userId);

    res.json({
      message: 'Token refreshed',
      ...tokens
    });
  })
);

/**
 * @route POST /api/v1/auth/logout
 * @desc Logout user
 */
router.post('/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    // Delete all refresh tokens for user
    db.run('DELETE FROM refresh_tokens WHERE user_id = ?', [req.userId]);

    res.json({
      message: 'Logged out successfully'
    });
  })
);

/**
 * @route GET /api/v1/auth/me
 * @desc Get current user
 */
router.get('/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = db.get(
      `SELECT u.id, u.email, u.name, u.avatar, u.phone, u.role, u.workspace_id, u.settings,
              w.name as workspace_name, w.plan, w.credits
       FROM users u
       JOIN workspaces w ON u.workspace_id = w.id
       WHERE u.id = ?`,
      [req.userId]
    );

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        phone: user.phone,
        role: user.role,
        settings: JSON.parse(user.settings || '{}')
      },
      workspace: {
        id: user.workspace_id,
        name: user.workspace_name,
        plan: user.plan,
        credits: user.credits
      }
    });
  })
);

/**
 * @route PUT /api/v1/auth/password
 * @desc Change password
 */
router.put('/password',
  authenticate,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 })
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;

    const user = db.get('SELECT password FROM users WHERE id = ?', [req.userId]);

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      throw new AppError('Current password is incorrect', 400);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    db.run('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, req.userId]
    );

    // Invalidate all refresh tokens
    db.run('DELETE FROM refresh_tokens WHERE user_id = ?', [req.userId]);

    res.json({
      message: 'Password changed successfully'
    });
  })
);

module.exports = router;
