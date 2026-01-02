/**
 * 🤖 AI Routes - Endpoints de IA
 * WhatsHybrid Pro v7.1.0
 */

const express = require('express');
const router = express.Router();
const { authenticate, checkWorkspace } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// AI Services
let AIRouter, CopilotEngine;
try {
  AIRouter = require('../ai/services/AIRouterService');
  CopilotEngine = require('../ai/engines/CopilotEngine');
} catch (e) {
  console.warn('[AI Routes] AI modules not fully loaded:', e.message);
}

/**
 * GET /api/v1/ai/providers
 * Lista providers configurados
 */
router.get('/providers', authenticate, asyncHandler(async (req, res) => {
  if (!AIRouter) {
    return res.status(503).json({ error: 'AI Router not available' });
  }
  
  const providers = AIRouter.getConfiguredProviders();
  res.json({ providers });
}));

/**
 * GET /api/v1/ai/models
 * Lista todos os modelos disponíveis
 */
router.get('/models', authenticate, asyncHandler(async (req, res) => {
  if (!AIRouter) {
    return res.status(503).json({ error: 'AI Router not available' });
  }
  
  const models = AIRouter.getAllModels();
  res.json({ models });
}));

/**
 * POST /api/v1/ai/complete
 * Chat completion
 */
router.post('/complete', authenticate, asyncHandler(async (req, res) => {
  if (!AIRouter) {
    return res.status(503).json({ error: 'AI Router not available' });
  }
  
  const { messages, provider, model, temperature, maxTokens, systemPrompt } = req.body;
  
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array is required' });
  }
  
  // Add system prompt if provided
  const fullMessages = systemPrompt 
    ? [{ role: 'system', content: systemPrompt }, ...messages]
    : messages;
  
  const result = await AIRouter.complete(fullMessages, {
    provider,
    model,
    temperature,
    maxTokens
  });
  
  // Log usage
  // TODO: Track AI usage in database
  
  res.json({
    content: result.content,
    provider: result.provider,
    model: result.model,
    usage: result.usage,
    latency: result.latency,
    cost: result.cost,
    cached: result.cached || false
  });
}));

/**
 * POST /api/v1/ai/analyze
 * Análise de mensagem (intent, sentiment, entities)
 */
router.post('/analyze', authenticate, asyncHandler(async (req, res) => {
  if (!CopilotEngine) {
    return res.status(503).json({ error: 'Copilot Engine not available' });
  }
  
  const { message, context } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }
  
  const analysis = await CopilotEngine.analyze(message, context || {});
  res.json(analysis);
}));

/**
 * POST /api/v1/ai/replies
 * Gera sugestões de resposta
 */
router.post('/replies', authenticate, asyncHandler(async (req, res) => {
  if (!CopilotEngine) {
    return res.status(503).json({ error: 'Copilot Engine not available' });
  }
  
  const { message, context, count } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }
  
  const result = await CopilotEngine.generateReplies(message, context || {}, count || 3);
  res.json(result);
}));

/**
 * POST /api/v1/ai/score
 * Lead scoring
 */
router.post('/score', authenticate, asyncHandler(async (req, res) => {
  if (!CopilotEngine) {
    return res.status(503).json({ error: 'Copilot Engine not available' });
  }
  
  const { messages, contactData } = req.body;
  
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array is required' });
  }
  
  const score = await CopilotEngine.scoreContact(messages, contactData || {});
  res.json(score);
}));

/**
 * POST /api/v1/ai/summarize
 * Resumo de conversa
 */
router.post('/summarize', authenticate, asyncHandler(async (req, res) => {
  if (!CopilotEngine) {
    return res.status(503).json({ error: 'Copilot Engine not available' });
  }
  
  const { messages } = req.body;
  
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array is required' });
  }
  
  const summary = await CopilotEngine.summarize(messages);
  res.json(summary);
}));

/**
 * POST /api/v1/ai/translate
 * Tradução de texto
 */
router.post('/translate', authenticate, asyncHandler(async (req, res) => {
  if (!CopilotEngine) {
    return res.status(503).json({ error: 'Copilot Engine not available' });
  }
  
  const { text, targetLang } = req.body;
  
  if (!text) {
    return res.status(400).json({ error: 'text is required' });
  }
  
  const result = await CopilotEngine.translate(text, targetLang || 'pt-BR');
  res.json(result);
}));

/**
 * POST /api/v1/ai/correct
 * Correção gramatical
 */
router.post('/correct', authenticate, asyncHandler(async (req, res) => {
  if (!CopilotEngine) {
    return res.status(503).json({ error: 'Copilot Engine not available' });
  }
  
  const { text } = req.body;
  
  if (!text) {
    return res.status(400).json({ error: 'text is required' });
  }
  
  const result = await CopilotEngine.correct(text);
  res.json(result);
}));

/**
 * GET /api/v1/ai/personas
 * Lista personas disponíveis
 */
router.get('/personas', authenticate, asyncHandler(async (req, res) => {
  if (!CopilotEngine) {
    return res.status(503).json({ error: 'Copilot Engine not available' });
  }
  
  const personas = CopilotEngine.getPersonas();
  res.json({ personas });
}));

/**
 * POST /api/v1/ai/persona
 * Define persona ativa
 */
router.post('/persona', authenticate, asyncHandler(async (req, res) => {
  if (!CopilotEngine) {
    return res.status(503).json({ error: 'Copilot Engine not available' });
  }
  
  const { personaId } = req.body;
  
  if (!personaId) {
    return res.status(400).json({ error: 'personaId is required' });
  }
  
  const success = CopilotEngine.setPersona(personaId);
  if (!success) {
    return res.status(400).json({ error: 'Invalid persona' });
  }
  
  res.json({ success: true, persona: personaId });
}));

/**
 * GET /api/v1/ai/health
 * Health check de todos os providers
 */
router.get('/health', authenticate, asyncHandler(async (req, res) => {
  if (!AIRouter) {
    return res.status(503).json({ error: 'AI Router not available' });
  }
  
  const health = await AIRouter.healthCheck();
  res.json({ health });
}));

/**
 * GET /api/v1/ai/metrics
 * Métricas de uso
 */
router.get('/metrics', authenticate, asyncHandler(async (req, res) => {
  if (!AIRouter) {
    return res.status(503).json({ error: 'AI Router not available' });
  }
  
  const metrics = AIRouter.getMetrics();
  res.json(metrics);
}));

/**
 * POST /api/v1/ai/configure
 * Configura um provider
 */
router.post('/configure', authenticate, asyncHandler(async (req, res) => {
  if (!AIRouter) {
    return res.status(503).json({ error: 'AI Router not available' });
  }
  
  const { provider, apiKey, model, baseUrl } = req.body;
  
  if (!provider || !apiKey) {
    return res.status(400).json({ error: 'provider and apiKey are required' });
  }
  
  try {
    AIRouter.setProvider(provider, { apiKey, model, baseUrl });
    res.json({ success: true, provider });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

/**
 * POST /api/v1/ai/knowledge
 * Adiciona item à knowledge base
 */
router.post('/knowledge', authenticate, asyncHandler(async (req, res) => {
  if (!CopilotEngine) {
    return res.status(503).json({ error: 'Copilot Engine not available' });
  }
  
  const { question, answer, content, tags } = req.body;
  
  if (!question && !content) {
    return res.status(400).json({ error: 'question or content is required' });
  }
  
  CopilotEngine.addKnowledge({ question, answer, content, tags });
  res.json({ success: true });
}));

/**
 * GET /api/v1/ai/knowledge/search
 * Busca na knowledge base
 */
router.get('/knowledge/search', authenticate, asyncHandler(async (req, res) => {
  if (!CopilotEngine) {
    return res.status(503).json({ error: 'Copilot Engine not available' });
  }
  
  const { q } = req.query;
  
  if (!q) {
    return res.status(400).json({ error: 'q query param is required' });
  }
  
  const results = CopilotEngine.searchKnowledge(q);
  res.json({ results });
}));

module.exports = router;
