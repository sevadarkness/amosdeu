/**
 * 🧠 SmartBot AI Plus Routes
 * 
 * API endpoints para os 13 sistemas avançados de IA
 * 
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const { SmartBotAIPlusService } = require('../ai/services/SmartBotAIPlusService');

// Initialize service
let service = null;

const getService = () => {
  if (!service) {
    service = new SmartBotAIPlusService();
    service.init();
  }
  return service;
};

// ============================================================
// KNOWLEDGE BASE (RAG)
// ============================================================

// Add document to knowledge base
router.post('/knowledge/documents', async (req, res) => {
  try {
    const { docId, content, metadata } = req.body;
    if (!docId || !content) {
      return res.status(400).json({ error: 'docId and content are required' });
    }
    const result = await getService().knowledgeBase.addDocument(docId, content, metadata);
    res.json({ success: true, document: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove document
router.delete('/knowledge/documents/:docId', async (req, res) => {
  try {
    const result = await getService().knowledgeBase.removeDocument(req.params.docId);
    res.json({ success: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search knowledge base
router.post('/knowledge/search', async (req, res) => {
  try {
    const { query, maxResults, threshold } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }
    const results = getService().knowledgeBase.search(query, { maxResults, threshold });
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get context for AI
router.post('/knowledge/context', async (req, res) => {
  try {
    const { query, maxTokens } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }
    const context = getService().knowledgeBase.getContextForQuery(query, maxTokens);
    res.json(context);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List documents
router.get('/knowledge/documents', async (req, res) => {
  try {
    const documents = getService().knowledgeBase.listDocuments();
    res.json({ documents, stats: getService().knowledgeBase.getStats() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// CONVERSATION SUMMARIZER
// ============================================================

// Summarize conversation
router.post('/summarizer/summarize', async (req, res) => {
  try {
    const { chatId, messages, maxTokens } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }
    const result = getService().summarizer.prepareContext(chatId, messages, maxTokens);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check if needs summary
router.post('/summarizer/needs-summary', async (req, res) => {
  try {
    const { messages } = req.body;
    const needsSummary = getService().summarizer.needsSummary(messages || []);
    res.json({ needsSummary });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear cache
router.delete('/summarizer/cache/:chatId?', async (req, res) => {
  try {
    getService().summarizer.clearCache(req.params.chatId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// LEAD SCORING
// ============================================================

// Score contact
router.post('/leads/score', async (req, res) => {
  try {
    const { chatId, data } = req.body;
    if (!chatId) {
      return res.status(400).json({ error: 'chatId is required' });
    }
    const result = getService().leadScoring.scoreContact(chatId, data || {});
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Analyze message for signals
router.post('/leads/analyze-message', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }
    const signals = getService().leadScoring.analyzeMessage(text);
    res.json(signals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get top leads
router.get('/leads/top', async (req, res) => {
  try {
    const { limit, classification } = req.query;
    const leads = getService().leadScoring.getTopLeads(
      parseInt(limit) || 10,
      classification || null
    );
    res.json({ leads, stats: getService().leadScoring.getStats() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get lead score
router.get('/leads/:chatId', async (req, res) => {
  try {
    const score = getService().leadScoring.getScore(req.params.chatId);
    res.json(score || { error: 'Lead not found' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Apply decay
router.post('/leads/decay', async (req, res) => {
  try {
    getService().leadScoring.applyDecay();
    res.json({ success: true, stats: getService().leadScoring.getStats() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// AUTO TAGGER
// ============================================================

// Analyze and tag
router.post('/tags/analyze', async (req, res) => {
  try {
    const { chatId, messages } = req.body;
    if (!chatId || !messages) {
      return res.status(400).json({ error: 'chatId and messages are required' });
    }
    const result = getService().autoTagger.analyzeAndTag(chatId, messages);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add manual tag
router.post('/tags/:chatId', async (req, res) => {
  try {
    const { tagId } = req.body;
    if (!tagId) {
      return res.status(400).json({ error: 'tagId is required' });
    }
    const tags = getService().autoTagger.addTag(req.params.chatId, tagId);
    res.json({ tags });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove tag
router.delete('/tags/:chatId/:tagId', async (req, res) => {
  try {
    const tags = getService().autoTagger.removeTag(req.params.chatId, req.params.tagId);
    res.json({ tags });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get chat tags
router.get('/tags/:chatId', async (req, res) => {
  try {
    const tags = getService().autoTagger.getTags(req.params.chatId);
    res.json({ tags });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get chats by tag
router.get('/tags/by-tag/:tagId', async (req, res) => {
  try {
    const chats = getService().autoTagger.getChatsByTag(req.params.tagId);
    res.json({ chats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get tag definitions
router.get('/tags/definitions/all', async (req, res) => {
  try {
    const definitions = getService().autoTagger.getAllTagDefinitions();
    res.json({ definitions, stats: getService().autoTagger.getStats() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add tag definition
router.post('/tags/definitions', async (req, res) => {
  try {
    const { id, name, keywords, color } = req.body;
    if (!id || !name || !keywords) {
      return res.status(400).json({ error: 'id, name, and keywords are required' });
    }
    getService().autoTagger.addTagDefinition(id, name, keywords, color);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// RESPONSE QUALITY SCORER
// ============================================================

// Score response
router.post('/quality/score', async (req, res) => {
  try {
    const { input, response, context } = req.body;
    if (!input || !response) {
      return res.status(400).json({ error: 'input and response are required' });
    }
    const result = getService().qualityScorer.scoreResponse(input, response, context || {});
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get recent scores
router.get('/quality/recent', async (req, res) => {
  try {
    const { limit } = req.query;
    const scores = getService().qualityScorer.getRecentScores(parseInt(limit) || 20);
    res.json({ scores, stats: getService().qualityScorer.getStats() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// PROACTIVE ENGAGEMENT
// ============================================================

// Analyze chat for suggestions
router.post('/proactive/analyze', async (req, res) => {
  try {
    const { chatId, chatData } = req.body;
    if (!chatId || !chatData) {
      return res.status(400).json({ error: 'chatId and chatData are required' });
    }
    const result = getService().proactiveEngagement.analyzeChat(chatId, chatData);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get suggestions for chat
router.get('/proactive/:chatId', async (req, res) => {
  try {
    const suggestions = getService().proactiveEngagement.getSuggestions(req.params.chatId);
    res.json({ suggestions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all pending suggestions
router.get('/proactive', async (req, res) => {
  try {
    const suggestions = getService().proactiveEngagement.getAllPendingSuggestions();
    res.json({ suggestions, stats: getService().proactiveEngagement.getStats() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Accept suggestion
router.post('/proactive/:chatId/accept', async (req, res) => {
  try {
    const { triggerId } = req.body;
    getService().proactiveEngagement.acceptSuggestion(req.params.chatId, triggerId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dismiss suggestion
router.post('/proactive/:chatId/dismiss', async (req, res) => {
  try {
    const { triggerId } = req.body;
    getService().proactiveEngagement.dismissSuggestion(req.params.chatId, triggerId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// SMART SCHEDULER
// ============================================================

// Record response
router.post('/scheduler/record', async (req, res) => {
  try {
    const { chatId, timestamp } = req.body;
    if (!chatId) {
      return res.status(400).json({ error: 'chatId is required' });
    }
    getService().smartScheduler.recordResponse(chatId, timestamp);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get best times
router.get('/scheduler/best-times/:chatId?', async (req, res) => {
  try {
    const bestTimes = getService().smartScheduler.getBestTimes(req.params.chatId);
    res.json(bestTimes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get next best time
router.get('/scheduler/next/:chatId?', async (req, res) => {
  try {
    const nextTime = getService().smartScheduler.getNextBestTime(req.params.chatId);
    res.json(nextTime);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// A/B TESTING
// ============================================================

// Create test
router.post('/abtests', async (req, res) => {
  try {
    const { testId, config } = req.body;
    if (!testId || !config) {
      return res.status(400).json({ error: 'testId and config are required' });
    }
    const test = getService().abTesting.createTest(testId, config);
    res.json(test);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get variant for chat
router.get('/abtests/:testId/variant/:chatId', async (req, res) => {
  try {
    const variant = getService().abTesting.getVariant(req.params.testId, req.params.chatId);
    res.json({ variant });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Record conversion
router.post('/abtests/:testId/conversion', async (req, res) => {
  try {
    const { chatId, value } = req.body;
    if (!chatId) {
      return res.status(400).json({ error: 'chatId is required' });
    }
    getService().abTesting.recordConversion(req.params.testId, chatId, value);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Analyze test
router.get('/abtests/:testId/analysis', async (req, res) => {
  try {
    const analysis = getService().abTesting.analyzeTest(req.params.testId);
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// End test
router.post('/abtests/:testId/end', async (req, res) => {
  try {
    const result = getService().abTesting.endTest(req.params.testId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List tests
router.get('/abtests', async (req, res) => {
  try {
    const { status } = req.query;
    const tests = getService().abTesting.listTests(status);
    res.json({ tests, stats: getService().abTesting.getStats() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// LANGUAGE DETECTOR
// ============================================================

// Detect language
router.post('/language/detect', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }
    const result = getService().languageDetector.detect(text);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Detect and set for chat
router.post('/language/detect-chat', async (req, res) => {
  try {
    const { chatId, text } = req.body;
    if (!chatId || !text) {
      return res.status(400).json({ error: 'chatId and text are required' });
    }
    const result = getService().languageDetector.detectAndSetChatLanguage(chatId, text);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get chat language
router.get('/language/:chatId', async (req, res) => {
  try {
    const language = getService().languageDetector.getChatLanguage(req.params.chatId);
    res.json({ language });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get greeting/closing
router.get('/language/:chatId/greeting', async (req, res) => {
  try {
    const { formal } = req.query;
    const greeting = getService().languageDetector.getGreeting(req.params.chatId, formal === 'true');
    const closing = getService().languageDetector.getClosing(req.params.chatId, formal === 'true');
    res.json({ greeting, closing });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Detect tone
router.post('/language/tone', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }
    const tone = getService().languageDetector.detectTone(text);
    res.json({ tone });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get supported languages
router.get('/language/supported/all', async (req, res) => {
  try {
    const languages = getService().languageDetector.getSupportedLanguages();
    res.json({ languages, stats: getService().languageDetector.getStats() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// RESPONSE CACHE
// ============================================================

// Get from cache
router.post('/cache/get', async (req, res) => {
  try {
    const { input } = req.body;
    if (!input) {
      return res.status(400).json({ error: 'input is required' });
    }
    const cached = getService().responseCache.get(input);
    res.json({ cached, found: !!cached });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set in cache
router.post('/cache/set', async (req, res) => {
  try {
    const { input, response, ttl } = req.body;
    if (!input || !response) {
      return res.status(400).json({ error: 'input and response are required' });
    }
    getService().responseCache.set(input, response, ttl);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Invalidate cache
router.delete('/cache/:input', async (req, res) => {
  try {
    const result = getService().responseCache.invalidate(decodeURIComponent(req.params.input));
    res.json({ success: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear all cache
router.delete('/cache', async (req, res) => {
  try {
    getService().responseCache.clear();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cleanup expired
router.post('/cache/cleanup', async (req, res) => {
  try {
    const cleaned = getService().responseCache.cleanup();
    res.json({ cleaned, stats: getService().responseCache.getStats() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// HISTORY COMPRESSOR
// ============================================================

// Compress history
router.post('/compressor/compress', async (req, res) => {
  try {
    const { messages, maxTokens } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }
    const result = getService().historyCompressor.compress(messages, maxTokens);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Prepare for AI
router.post('/compressor/prepare', async (req, res) => {
  try {
    const { messages, maxTokens } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }
    const result = getService().historyCompressor.prepareForAI(messages, maxTokens);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// BATCH PROCESSOR
// ============================================================

// Get queue status
router.get('/batch/status', async (req, res) => {
  try {
    res.json(getService().batchProcessor.getStats());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Flush queue
router.post('/batch/flush', async (req, res) => {
  try {
    await getService().batchProcessor.flush();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear queue
router.delete('/batch', async (req, res) => {
  try {
    getService().batchProcessor.clear();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// LAZY LOADER
// ============================================================

// List modules
router.get('/modules', async (req, res) => {
  try {
    const modules = getService().lazyLoader.listModules();
    res.json({ modules, stats: getService().lazyLoader.getStats() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Preload high priority
router.post('/modules/preload', async (req, res) => {
  try {
    await getService().lazyLoader.preloadHighPriority();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// PROCESS MESSAGE (ALL-IN-ONE)
// ============================================================

// Process message with all systems
router.post('/process', async (req, res) => {
  try {
    const { chatId, message, context } = req.body;
    if (!chatId || !message) {
      return res.status(400).json({ error: 'chatId and message are required' });
    }
    const result = await getService().processMessage(chatId, message, context || {});
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Prepare AI context
router.post('/prepare-context', async (req, res) => {
  try {
    const { chatId, messages, maxTokens } = req.body;
    if (!chatId || !messages) {
      return res.status(400).json({ error: 'chatId and messages are required' });
    }
    const result = getService().prepareAIContext(chatId, messages, maxTokens);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Evaluate response
router.post('/evaluate', async (req, res) => {
  try {
    const { input, response, context } = req.body;
    if (!input || !response) {
      return res.status(400).json({ error: 'input and response are required' });
    }
    const result = getService().evaluateResponse(input, response, context || {});
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// STATS & EXPORT
// ============================================================

// Get all stats
router.get('/stats', async (req, res) => {
  try {
    const stats = getService().getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export all data
router.get('/export', async (req, res) => {
  try {
    const data = getService().exportData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', initialized: !!service?.initialized, timestamp: Date.now() });
});

module.exports = router;
