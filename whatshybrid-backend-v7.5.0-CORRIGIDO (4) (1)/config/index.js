/**
 * Configuration
 */

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  
  database: {
    path: process.env.DATABASE_PATH || './data/whatshybrid.db'
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100
  },
  
  cors: {
    origin: process.env.CORS_ORIGIN || '*'
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  },
  
  ai: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      defaultModel: 'gpt-4o-mini'
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      defaultModel: 'claude-3-5-sonnet-20241022'
    },
    venice: {
      apiKey: process.env.VENICE_API_KEY,
      defaultModel: 'llama-3.3-70b'
    },
    groq: {
      apiKey: process.env.GROQ_API_KEY,
      defaultModel: 'llama-3.3-70b-versatile'
    },
    google: {
      apiKey: process.env.GOOGLE_API_KEY,
      defaultModel: 'gemini-2.0-flash-exp'
    }
  },
  
  webhook: {
    secret: process.env.WEBHOOK_SECRET || 'webhook-secret'
  },
  
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM
  }
};
