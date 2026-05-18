/**
 * logger.js
 * ---------
 * Provides two exports:
 *   logger       – Winston structured logger for application events
 *   morganMiddleware – Morgan HTTP request logger (writes via Winston)
 */

import winston from 'winston';
import morgan from 'morgan';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// ── Custom log format ────────────────────────────────────────
const logFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} [${level}]: ${stack || message}${metaStr}`;
});

// ── Winston logger instance ──────────────────────────────────
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    logFormat,
  ),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: 'HH:mm:ss' }), logFormat),
    }),
  ],
});

// ── Morgan HTTP middleware ───────────────────────────────────
// Pipes Morgan output through Winston so all logs stay in one place.
const morganStream = {
  write: (message) => logger.http(message.trim()),
};

export const morganMiddleware = morgan(
  ':method :url :status :res[content-length] - :response-time ms',
  { stream: morganStream },
);
