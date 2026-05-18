/**
 * server.js
 * ---------
 * Application entry point.
 * Loads environment variables then delegates to app.js.
 */

import 'dotenv/config';
import { startApp } from './src/app.js';
import { logger } from './src/middleware/logger.js';

// ── Graceful shutdown ─────────────────────────────────────────
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception — shutting down', { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection — shutting down', { reason: String(reason) });
  process.exit(1);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received — shutting down gracefully');
  process.exit(0);
});

// ── Boot ──────────────────────────────────────────────────────
startApp().catch((err) => {
  logger.error('Failed to start application', { error: err.message });
  process.exit(1);
});
