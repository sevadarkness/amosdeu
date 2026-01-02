/**
 * Authentication Middleware
 */

const jwt = require('jsonwebtoken');
const config = require('../../config');
const db = require('../utils/database');

/**
 * Verify JWT token
 */
function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided'
      });
    }

    const token = authHeader.split(' ')[1];
    
    const decoded = jwt.verify(token, config.jwt.secret);
    
    // Get user from database
    const user = db.get(
      'SELECT id, email, name, role, workspace_id, status FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found'
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Account is not active'
      });
    }

    req.user = user;
    req.userId = user.id;
    req.workspaceId = user.workspace_id;
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token expired'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token'
      });
    }

    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed'
    });
  }
}

/**
 * Optional authentication (sets user if token present)
 */
function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, config.jwt.secret);
      
      const user = db.get(
        'SELECT id, email, name, role, workspace_id FROM users WHERE id = ?',
        [decoded.userId]
      );
      
      if (user) {
        req.user = user;
        req.userId = user.id;
        req.workspaceId = user.workspace_id;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
}

/**
 * Check if user has required role
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions'
      });
    }

    next();
  };
}

/**
 * Check workspace access
 */
function checkWorkspace(req, res, next) {
  const workspaceId = req.params.workspaceId || req.body.workspace_id || req.workspaceId;
  
  if (!workspaceId) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Workspace ID required'
    });
  }

  // Admin can access any workspace
  if (req.user.role === 'admin') {
    req.workspaceId = workspaceId;
    return next();
  }

  // User can only access their workspace
  if (req.user.workspace_id !== workspaceId) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'No access to this workspace'
    });
  }

  req.workspaceId = workspaceId;
  next();
}

/**
 * API Key authentication (for webhooks)
 */
function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API key required'
    });
  }

  // Find workspace by API key
  const workspace = db.get(
    "SELECT id, name, settings FROM workspaces WHERE json_extract(settings, '$.apiKey') = ?",
    [apiKey]
  );

  if (!workspace) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key'
    });
  }

  req.workspaceId = workspace.id;
  req.workspace = workspace;
  
  next();
}

module.exports = {
  authenticate,
  optionalAuth,
  authorize,
  checkWorkspace,
  apiKeyAuth
};
