/**
 * Error Handler Middleware
 */

const logger = require('../utils/logger');

class AppError extends Error {
  constructor(message, statusCode, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Not Found Handler
function notFoundHandler(req, res, next) {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    path: req.originalUrl
  });
}

// Global Error Handler
function errorHandler(err, req, res, next) {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log error (skip refresh token errors to avoid spam)
  const skipLogging = err.message?.includes('refresh token') || 
                      err.message?.includes('Invalid token') ||
                      err.code === 'TOKEN_INVALID';
  
  if (!skipLogging) {
    logger.error({
      message: err.message,
      stack: err.stack,
      statusCode: err.statusCode,
      path: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userId: req.user?.id
    });
  }

  // Development error response
  if (process.env.NODE_ENV === 'development') {
    return res.status(err.statusCode).json({
      error: err.status,
      message: err.message,
      code: err.code,
      stack: err.stack
    });
  }

  // Production error response
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      error: err.status,
      message: err.message,
      code: err.code
    });
  }

  // Programming or unknown error: don't leak details
  return res.status(500).json({
    error: 'error',
    message: 'Something went wrong'
  });
}

// Async handler wrapper
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Validation error handler
function handleValidationError(errors) {
  const messages = errors.array().map(err => ({
    field: err.path,
    message: err.msg
  }));

  throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
}

module.exports = {
  AppError,
  notFoundHandler,
  errorHandler,
  asyncHandler,
  handleValidationError
};
