/**
 * 🧠 SmartBot IA Routes
 * 
 * API endpoints for SmartBot IA functionality
 */

const express = require('express');
const router = express.Router();
const { SmartBotIAService } = require('../ai/services/SmartBotIAService');

// Initialize service (in production, use dependency injection)
let smartBotService = null;

const getService = () => {
  if (!smartBotService) {
    smartBotService = new SmartBotIAService();
    smartBotService.init();
  }
  return smartBotService;
};

/**
 * POST /api/smartbot/analyze
 * Analyze a message with context
 */
router.post('/analyze', async (req, res) => {
  try {
    const { chatId, message, history } = req.body;
    
    if (!chatId || !message) {
      return res.status(400).json({
        success: false,
        error: 'chatId and message are required'
      });
    }
    
    const service = getService();
    const analysis = await service.analyzeMessage(chatId, message, history || []);
    
    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('[SmartBot Route] Analyze error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/smartbot/feedback
 * Record feedback for learning
 */
router.post('/feedback', async (req, res) => {
  try {
    const { input, response, rating, context } = req.body;
    
    if (!input || !response || rating === undefined) {
      return res.status(400).json({
        success: false,
        error: 'input, response, and rating are required'
      });
    }
    
    const service = getService();
    service.recordResponseFeedback(input, response, rating, context || {});
    
    res.json({
      success: true,
      message: 'Feedback recorded'
    });
  } catch (error) {
    console.error('[SmartBot Route] Feedback error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/smartbot/response-time
 * Record response time metrics
 */
router.post('/response-time', async (req, res) => {
  try {
    const { responseTime, isAI } = req.body;
    
    if (responseTime === undefined) {
      return res.status(400).json({
        success: false,
        error: 'responseTime is required'
      });
    }
    
    const service = getService();
    service.recordResponseTime(responseTime, isAI || false);
    
    res.json({
      success: true,
      message: 'Response time recorded'
    });
  } catch (error) {
    console.error('[SmartBot Route] Response time error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/smartbot/profile/:chatId
 * Get customer profile
 */
router.get('/profile/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    
    const service = getService();
    const profile = service.getCustomerProfile(chatId);
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found'
      });
    }
    
    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('[SmartBot Route] Profile error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/smartbot/profiles
 * Get all customer profiles
 */
router.get('/profiles', async (req, res) => {
  try {
    const service = getService();
    const profiles = service.getAllProfiles();
    
    res.json({
      success: true,
      data: profiles,
      count: profiles.length
    });
  } catch (error) {
    console.error('[SmartBot Route] Profiles error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/smartbot/metrics
 * Get current metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const service = getService();
    const metrics = service.getMetrics();
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('[SmartBot Route] Metrics error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/smartbot/learning/stats
 * Get learning system statistics
 */
router.get('/learning/stats', async (req, res) => {
  try {
    const service = getService();
    const stats = service.getLearningStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[SmartBot Route] Learning stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/smartbot/learning/flush
 * Force process learning buffer
 */
router.post('/learning/flush', async (req, res) => {
  try {
    const service = getService();
    await service.flushLearning();
    
    res.json({
      success: true,
      message: 'Learning buffer flushed'
    });
  } catch (error) {
    console.error('[SmartBot Route] Flush error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/smartbot/queue/status
 * Get priority queue status
 */
router.get('/queue/status', async (req, res) => {
  try {
    const service = getService();
    const status = service.getQueueStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('[SmartBot Route] Queue status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/smartbot/export
 * Export all SmartBot data
 */
router.get('/export', async (req, res) => {
  try {
    const service = getService();
    const data = await service.exportData();
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('[SmartBot Route] Export error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/smartbot/reset
 * Reset all SmartBot data (use with caution)
 */
router.post('/reset', async (req, res) => {
  try {
    const { confirm } = req.body;
    
    if (confirm !== 'RESET_ALL_DATA') {
      return res.status(400).json({
        success: false,
        error: 'Confirmation required. Send { confirm: "RESET_ALL_DATA" }'
      });
    }
    
    const service = getService();
    await service.resetAll();
    
    res.json({
      success: true,
      message: 'All SmartBot data has been reset'
    });
  } catch (error) {
    console.error('[SmartBot Route] Reset error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
