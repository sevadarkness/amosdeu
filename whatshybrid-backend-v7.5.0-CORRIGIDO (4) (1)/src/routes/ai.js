/**
 * AI Routes - Proxy para providers de IA
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

const config = require('../../config');
const db = require('../utils/database');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');

const PROVIDERS = {
  openai: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    getHeaders: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' })
  },
  anthropic: {
    endpoint: 'https://api.anthropic.com/v1/messages',
    getHeaders: (apiKey) => ({ 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' })
  },
  venice: {
    endpoint: 'https://api.venice.ai/api/v1/chat/completions',
    getHeaders: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' })
  },
  groq: {
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    getHeaders: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' })
  }
};

// Get workspace AI credits
function getCredits(workspaceId) {
  const workspace = db.get('SELECT credits FROM workspaces WHERE id = ?', [workspaceId]);
  return workspace?.credits || 0;
}

// Deduct credits
function deductCredits(workspaceId, amount = 1) {
  db.run('UPDATE workspaces SET credits = credits - ? WHERE id = ? AND credits >= ?', [amount, workspaceId, amount]);
  return getCredits(workspaceId);
}

router.use(aiLimiter);

/**
 * @route POST /api/v1/ai/complete
 * @desc AI completion (proxied)
 */
router.post('/complete', authenticate, asyncHandler(async (req, res) => {
  let { provider, model, messages, temperature, max_tokens } = req.body;
  
  // Detecta provider disponível automaticamente se não especificado
  if (!provider) {
    // Prioridade: groq > openai > anthropic > venice
    if (config.ai.groq?.apiKey) {
      provider = 'groq';
    } else if (config.ai.openai?.apiKey) {
      provider = 'openai';
    } else if (config.ai.anthropic?.apiKey) {
      provider = 'anthropic';
    } else if (config.ai.venice?.apiKey) {
      provider = 'venice';
    } else {
      throw new AppError('No AI provider configured. Please set an API key in .env', 400);
    }
  }
  
  // Check credits
  const credits = getCredits(req.workspaceId);
  if (credits <= 0) {
    throw new AppError('Insufficient AI credits', 402, 'INSUFFICIENT_CREDITS');
  }

  const providerConfig = PROVIDERS[provider];
  if (!providerConfig) {
    throw new AppError('Invalid provider', 400);
  }

  // Get API key (from workspace settings or config)
  const workspace = db.get('SELECT settings FROM workspaces WHERE id = ?', [req.workspaceId]);
  const settings = JSON.parse(workspace?.settings || '{}');
  const apiKey = settings.aiKeys?.[provider] || config.ai[provider]?.apiKey;

  if (!apiKey) {
    throw new AppError(`API key not configured for ${provider}`, 400);
  }

  try {
    const startTime = Date.now();
    
    let requestBody;
    if (provider === 'anthropic') {
      const systemMsg = messages.find(m => m.role === 'system');
      const otherMsgs = messages.filter(m => m.role !== 'system');
      requestBody = {
        model: model || config.ai.anthropic.defaultModel,
        max_tokens: max_tokens || 1000,
        ...(systemMsg && { system: systemMsg.content }),
        messages: otherMsgs.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
        ...(temperature && { temperature })
      };
    } else {
      requestBody = {
        model: model || config.ai[provider]?.defaultModel || 'gpt-4o-mini',
        messages,
        temperature: temperature ?? 0.7,
        max_tokens: max_tokens || 1000
      };
    }

    const response = await axios.post(
      providerConfig.endpoint,
      requestBody,
      { headers: providerConfig.getHeaders(apiKey), timeout: 60000 }
    );

    const latency = Date.now() - startTime;

    // Parse response
    let content, usage;
    if (provider === 'anthropic') {
      content = response.data.content?.[0]?.text || '';
      usage = { prompt_tokens: response.data.usage?.input_tokens, completion_tokens: response.data.usage?.output_tokens };
    } else {
      content = response.data.choices?.[0]?.message?.content || '';
      usage = response.data.usage;
    }

    // Deduct credits
    const creditCost = Math.ceil((usage?.prompt_tokens + usage?.completion_tokens) / 1000) || 1;
    const remainingCredits = deductCredits(req.workspaceId, creditCost);

    // Log usage
    db.run(
      'INSERT INTO analytics_events (id, workspace_id, event_type, event_data, user_id) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), req.workspaceId, 'ai:completion', JSON.stringify({ provider, model, tokens: usage, latency, cost: creditCost }), req.userId]
    );

    res.json({
      content,
      provider,
      model: requestBody.model,
      usage,
      latency,
      credits: remainingCredits
    });

  } catch (error) {
    logger.error('AI completion error:', error.response?.data || error.message);
    throw new AppError(error.response?.data?.error?.message || 'AI request failed', error.response?.status || 500);
  }
}));

/**
 * @route GET /api/v1/ai/credits
 * @desc Get AI credits
 */
router.get('/credits', authenticate, asyncHandler(async (req, res) => {
  const credits = getCredits(req.workspaceId);
  res.json({ credits });
}));

/**
 * @route GET /api/v1/ai/usage
 * @desc Get AI usage history
 */
router.get('/usage', authenticate, asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const usage = db.all(
    `SELECT event_data, created_at FROM analytics_events 
     WHERE workspace_id = ? AND event_type = 'ai:completion' AND created_at >= ?
     ORDER BY created_at DESC`,
    [req.workspaceId, startDate.toISOString()]
  ).map(e => ({ ...JSON.parse(e.event_data), timestamp: e.created_at }));

  const summary = {
    totalRequests: usage.length,
    totalTokens: usage.reduce((sum, u) => sum + (u.tokens?.prompt_tokens || 0) + (u.tokens?.completion_tokens || 0), 0),
    totalCost: usage.reduce((sum, u) => sum + (u.cost || 0), 0),
    byProvider: {}
  };

  usage.forEach(u => {
    if (!summary.byProvider[u.provider]) {
      summary.byProvider[u.provider] = { requests: 0, tokens: 0 };
    }
    summary.byProvider[u.provider].requests++;
    summary.byProvider[u.provider].tokens += (u.tokens?.prompt_tokens || 0) + (u.tokens?.completion_tokens || 0);
  });

  res.json({ usage: usage.slice(0, 100), summary });
}));

/**
 * @route POST /api/v1/ai/knowledge
 * @desc Add to knowledge base
 */
router.post('/knowledge', authenticate, asyncHandler(async (req, res) => {
  const { type, question, answer, content, tags } = req.body;
  const id = uuidv4();
  db.run(
    'INSERT INTO knowledge_base (id, workspace_id, type, question, answer, content, tags) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, req.workspaceId, type || 'faq', question, answer, content, JSON.stringify(tags || [])]
  );
  const item = db.get('SELECT * FROM knowledge_base WHERE id = ?', [id]);
  res.status(201).json({ item });
}));

/**
 * @route GET /api/v1/ai/knowledge
 * @desc Get knowledge base
 */
router.get('/knowledge', authenticate, asyncHandler(async (req, res) => {
  const { type, search } = req.query;
  let sql = 'SELECT * FROM knowledge_base WHERE workspace_id = ?';
  const params = [req.workspaceId];
  if (type) { sql += ' AND type = ?'; params.push(type); }
  if (search) { sql += ' AND (question LIKE ? OR answer LIKE ? OR content LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  sql += ' ORDER BY usage_count DESC, created_at DESC';
  const items = db.all(sql, params).map(i => ({ ...i, tags: JSON.parse(i.tags || '[]') }));
  res.json({ items });
}));

/**
 * @route DELETE /api/v1/ai/knowledge/:id
 */
router.delete('/knowledge/:id', authenticate, asyncHandler(async (req, res) => {
  db.run('DELETE FROM knowledge_base WHERE id = ? AND workspace_id = ?', [req.params.id, req.workspaceId]);
  res.json({ message: 'Knowledge item deleted' });
}));

module.exports = router;
