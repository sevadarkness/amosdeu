/**
 * 🚀 WhatsHybrid Backend Server
 * Enterprise API for WhatsHybrid Pro
 * 
 * @version 7.2.0
 */

require('dotenv').config();

const express = require('express');
const recoverSyncRoutes = require("../routes/recover-sync");
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');

const config = require('../config');
const logger = require('./utils/logger');
const database = require('./utils/database');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { rateLimiter } = require('./middleware/rateLimiter');

// Routes
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const contactsRoutes = require('./routes/contacts');
const conversationsRoutes = require('./routes/conversations');
const campaignsRoutes = require('./routes/campaigns');
const analyticsRoutes = require('./routes/analytics');
const crmRoutes = require('./routes/crm');
const tasksRoutes = require('./routes/tasks');
const templatesRoutes = require('./routes/templates');
const webhooksRoutes = require('./routes/webhooks');
const aiRoutes = require('./routes/ai');
const settingsRoutes = require('./routes/settings');
const smartbotRoutes = require('./routes/smartbot');
const smartbotExtendedRoutes = require('./routes/smartbot-extended');
const smartbotAIPlusRoutes = require('./routes/smartbot-ai-plus');
const autopilotRoutes = require('./routes/autopilot');

const app = express();
const server = http.createServer(app);

// Socket.IO for real-time updates
const io = new Server(server, {
  cors: {
    origin: config.cors.origin,
    methods: ['GET', 'POST']
  }
});

// Make io available in routes
app.set('io', io);

// ============================================
// MIDDLEWARE
// ============================================

// Security
app.use(helmet());

// CORS
app.use(cors({
  origin: config.cors.origin,
  credentials: true
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (config.env !== 'test') {
  app.use(morgan('combined', { stream: logger.stream }));
}

// Rate limiting
app.use(rateLimiter);

// ============================================
// ROUTES
// ============================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '7.2.0',
    uptime: process.uptime()
  });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/contacts', contactsRoutes);
app.use('/api/v1/conversations', conversationsRoutes);
app.use('/api/v1/campaigns', campaignsRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/crm', crmRoutes);
app.use('/api/v1/tasks', tasksRoutes);
app.use('/api/v1/templates', templatesRoutes);
app.use('/api/v1/webhooks', webhooksRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/smartbot', smartbotRoutes);
app.use('/api/v1/smartbot-extended', smartbotExtendedRoutes);
app.use('/api/v1/smartbot-ai-plus', smartbotAIPlusRoutes);
app.use('/api/v1/autopilot', autopilotRoutes);

// API Documentation
app.get('/api', (req, res) => {
  res.json({
    name: 'WhatsHybrid API',
    version: '7.2.0',
    documentation: '/api/docs',
    endpoints: {
      auth: '/api/v1/auth',
      users: '/api/v1/users',
      contacts: '/api/v1/contacts',
      conversations: '/api/v1/conversations',
      campaigns: '/api/v1/campaigns',
      analytics: '/api/v1/analytics',
      crm: '/api/v1/crm',
      tasks: '/api/v1/tasks',
      templates: '/api/v1/templates',
      webhooks: '/api/v1/webhooks',
      ai: '/api/v1/ai',
      settings: '/api/v1/settings',
      smartbot: '/api/v1/smartbot',
      'smartbot-extended': '/api/v1/smartbot-extended',
      'smartbot-ai-plus': '/api/v1/smartbot-ai-plus',
      'autopilot': '/api/v1/autopilot'
    }
  });
});

// ============================================
// ERROR HANDLING
// ============================================

app.use(notFoundHandler);
app.use(errorHandler);

// ============================================
// SOCKET.IO EVENTS
// ============================================

io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id}`);

  socket.on('join:user', (userId) => {
    socket.join(`user:${userId}`);
    logger.debug(`User ${userId} joined room`);
  });

  socket.on('join:workspace', (workspaceId) => {
    socket.join(`workspace:${workspaceId}`);
    logger.debug(`Socket joined workspace ${workspaceId}`);
  });

  socket.on('disconnect', () => {
    logger.debug(`Socket disconnected: ${socket.id}`);
  });
});

// ============================================
// STARTUP
// ============================================

async function startServer() {
  try {
    // Initialize database
    await database.initialize();
    logger.info('Database initialized');

    // Start server
    const PORT = config.port;
    server.listen(PORT, () => {
      logger.info(`
╔══════════════════════════════════════════════════╗
║   🚀 WhatsHybrid Backend Server                  ║
║   Version: 7.2.0 (SmartBot IA)                   ║
║   Environment: ${config.env.padEnd(32)}║
║   Port: ${String(PORT).padEnd(39)}║
║   Database: SQLite                               ║
╚══════════════════════════════════════════════════╝
      `);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    database.close();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    database.close();
    process.exit(0);
  });
});

// Start
startServer();

module.exports = { app, server, io };
