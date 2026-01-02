/**
 * Settings Routes
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('../utils/uuid-wrapper');
const crypto = require('crypto');

const db = require('../utils/database');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @route GET /api/v1/settings/workspace
 * @desc Get workspace settings
 */
router.get('/workspace', authenticate, asyncHandler(async (req, res) => {
  const workspace = db.get(
    'SELECT id, name, settings, plan, credits, created_at FROM workspaces WHERE id = ?',
    [req.workspaceId]
  );
  
  if (!workspace) {
    throw new AppError('Workspace not found', 404);
  }

  workspace.settings = JSON.parse(workspace.settings || '{}');
  
  // Hide sensitive data
  if (workspace.settings.aiKeys) {
    Object.keys(workspace.settings.aiKeys).forEach(key => {
      if (workspace.settings.aiKeys[key]) {
        workspace.settings.aiKeys[key] = '••••••••' + workspace.settings.aiKeys[key].slice(-4);
      }
    });
  }

  res.json({ workspace });
}));

/**
 * @route PUT /api/v1/settings/workspace
 * @desc Update workspace settings
 */
router.put('/workspace',
  authenticate,
  authorize('owner', 'admin'),
  asyncHandler(async (req, res) => {
    const { name, settings } = req.body;

    // Get current settings
    const current = db.get('SELECT settings FROM workspaces WHERE id = ?', [req.workspaceId]);
    const currentSettings = JSON.parse(current?.settings || '{}');

    // Merge settings (don't overwrite AI keys if masked)
    if (settings) {
      if (settings.aiKeys) {
        Object.keys(settings.aiKeys).forEach(key => {
          if (settings.aiKeys[key]?.startsWith('••••')) {
            settings.aiKeys[key] = currentSettings.aiKeys?.[key];
          }
        });
      }
    }

    const updates = [];
    const values = [];

    if (name) {
      updates.push('name = ?');
      values.push(name);
    }

    if (settings) {
      updates.push('settings = ?');
      values.push(JSON.stringify({ ...currentSettings, ...settings }));
    }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(req.workspaceId);
      db.run(`UPDATE workspaces SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    const workspace = db.get('SELECT id, name, settings, plan, credits FROM workspaces WHERE id = ?', [req.workspaceId]);
    workspace.settings = JSON.parse(workspace.settings || '{}');

    res.json({ workspace });
  })
);

/**
 * @route POST /api/v1/settings/workspace/api-key
 * @desc Generate API key for workspace
 */
router.post('/workspace/api-key',
  authenticate,
  authorize('owner', 'admin'),
  asyncHandler(async (req, res) => {
    const apiKey = 'whl_' + crypto.randomBytes(32).toString('hex');
    
    const current = db.get('SELECT settings FROM workspaces WHERE id = ?', [req.workspaceId]);
    const settings = JSON.parse(current?.settings || '{}');
    settings.apiKey = apiKey;
    
    db.run('UPDATE workspaces SET settings = ? WHERE id = ?', [JSON.stringify(settings), req.workspaceId]);

    res.json({ apiKey });
  })
);

/**
 * @route PUT /api/v1/settings/ai-keys
 * @desc Update AI provider API keys
 */
router.put('/ai-keys',
  authenticate,
  authorize('owner', 'admin'),
  asyncHandler(async (req, res) => {
    const { openai, anthropic, venice, groq, google } = req.body;

    const current = db.get('SELECT settings FROM workspaces WHERE id = ?', [req.workspaceId]);
    const settings = JSON.parse(current?.settings || '{}');
    
    settings.aiKeys = {
      ...(settings.aiKeys || {}),
      ...(openai && { openai }),
      ...(anthropic && { anthropic }),
      ...(venice && { venice }),
      ...(groq && { groq }),
      ...(google && { google })
    };

    db.run('UPDATE workspaces SET settings = ? WHERE id = ?', [JSON.stringify(settings), req.workspaceId]);

    res.json({ message: 'AI keys updated' });
  })
);

/**
 * @route GET /api/v1/settings/user
 * @desc Get user settings
 */
router.get('/user', authenticate, asyncHandler(async (req, res) => {
  const user = db.get('SELECT settings FROM users WHERE id = ?', [req.userId]);
  const settings = JSON.parse(user?.settings || '{}');
  res.json({ settings });
}));

/**
 * @route PUT /api/v1/settings/user
 * @desc Update user settings
 */
router.put('/user', authenticate, asyncHandler(async (req, res) => {
  const { settings } = req.body;
  
  const current = db.get('SELECT settings FROM users WHERE id = ?', [req.userId]);
  const currentSettings = JSON.parse(current?.settings || '{}');
  const newSettings = { ...currentSettings, ...settings };

  db.run('UPDATE users SET settings = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
    [JSON.stringify(newSettings), req.userId]
  );

  res.json({ settings: newSettings });
}));

/**
 * @route GET /api/v1/settings/billing
 * @desc Get billing info
 */
router.get('/billing', authenticate, asyncHandler(async (req, res) => {
  const workspace = db.get(
    'SELECT plan, credits, settings FROM workspaces WHERE id = ?',
    [req.workspaceId]
  );
  
  const settings = JSON.parse(workspace?.settings || '{}');
  
  res.json({
    plan: workspace?.plan || 'free',
    credits: workspace?.credits || 0,
    subscription: settings.subscription || null
  });
}));

/**
 * @route POST /api/v1/settings/credits/add
 * @desc Add credits to workspace (admin only)
 */
router.post('/credits/add',
  authenticate,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const { amount, workspaceId } = req.body;
    
    const targetWorkspace = workspaceId || req.workspaceId;
    
    db.run('UPDATE workspaces SET credits = credits + ? WHERE id = ?', [amount, targetWorkspace]);
    
    const workspace = db.get('SELECT credits FROM workspaces WHERE id = ?', [targetWorkspace]);

    res.json({ credits: workspace.credits });
  })
);

/**
 * @route GET /api/v1/settings/export
 * @desc Export workspace data
 */
router.get('/export',
  authenticate,
  authorize('owner', 'admin'),
  asyncHandler(async (req, res) => {
    const contacts = db.all('SELECT * FROM contacts WHERE workspace_id = ?', [req.workspaceId]);
    const deals = db.all('SELECT * FROM deals WHERE workspace_id = ?', [req.workspaceId]);
    const tasks = db.all('SELECT * FROM tasks WHERE workspace_id = ?', [req.workspaceId]);
    const templates = db.all('SELECT * FROM templates WHERE workspace_id = ?', [req.workspaceId]);
    const labels = db.all('SELECT * FROM labels WHERE workspace_id = ?', [req.workspaceId]);
    const knowledgeBase = db.all('SELECT * FROM knowledge_base WHERE workspace_id = ?', [req.workspaceId]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      workspaceId: req.workspaceId,
      data: {
        contacts,
        deals,
        tasks,
        templates,
        labels,
        knowledgeBase
      }
    };

    res.json(exportData);
  })
);

module.exports = router;
