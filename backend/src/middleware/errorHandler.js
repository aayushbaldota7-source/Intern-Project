/**
 * errorHandler.js
 * ---------------
 * Global Express error-handling middleware.
 * Must have 4 parameters so Express recognises it as an error handler.
 */

import { logger } from './logger.js';

/**
 * Handle 404 – attach to the end of route definitions
 * before the global error handler.
 */
export function notFoundHandler(req, res, next) {
  const err = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  err.status = 404;
  next(err);
}

/**
 * Global error handler.
 * Returns a consistent JSON error shape:
 *   { error: { message, status, ...(stack in dev) } }
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status  = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  logger.error('Request error', {
    method:  req.method,
    url:     req.originalUrl,
    status,
    message,
    stack:   err.stack,
  });

  const body = {
    error: {
      message,
      status,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
  };

  res.status(status).json(body);
}
