/**
 * Rate Limiter Middleware
 */

const rateLimit = require('express-rate-limit');
const config = require('../../config');

// General rate limiter
const rateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: Math.ceil(config.rateLimit.windowMs / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user?.id || req.ip;
  }
});

// Strict rate limiter for auth endpoints
// Aumentado para desenvolvimento - em produção, usar valores mais baixos
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute (was 15 minutes)
  max: 50, // 50 attempts (was 5)
  message: {
    error: 'Too Many Requests',
    message: 'Too many login attempts. Please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// API rate limiter (per workspace)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: {
    error: 'Too Many Requests',
    message: 'API rate limit exceeded.'
  },
  keyGenerator: (req) => {
    return req.workspaceId || req.ip;
  }
});

// AI rate limiter (expensive operations)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 AI requests per minute
  message: {
    error: 'Too Many Requests',
    message: 'AI rate limit exceeded. Please wait before making more AI requests.'
  },
  keyGenerator: (req) => {
    return req.workspaceId || req.user?.id || req.ip;
  }
});

// Webhook rate limiter
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 webhook calls per minute
  message: {
    error: 'Too Many Requests',
    message: 'Webhook rate limit exceeded.'
  }
});

module.exports = {
  rateLimiter,
  authLimiter,
  apiLimiter,
  aiLimiter,
  webhookLimiter
};
