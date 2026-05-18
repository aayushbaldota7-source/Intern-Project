/**
 * app.js
 * ------
 * Bootstraps Express + Socket.IO and wires all middleware/routes.
 * Exported so server.js can attach it to the HTTP server.
 */

import express       from 'express';
import cors          from 'cors';
import { Server }    from 'socket.io';
import http          from 'http';
import path          from 'path';
import { fileURLToPath } from 'url';

import { morganMiddleware, logger } from './middleware/logger.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import orderRoutes   from './routes/orderRoutes.js';
import * as notificationService from './services/notificationService.js';
import { testConnection } from './config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Express app ──────────────────────────────────────────────
const app = express();

// ── HTTP server (needed to attach Socket.IO) ─────────────────
const httpServer = http.createServer(app);

// ── Socket.IO server ─────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin:  process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
  },
  // Automatically reconnect clients after brief network hiccups
  pingTimeout:  60_000,
  pingInterval: 25_000,
});

// ── Core middleware ───────────────────────────────────────────
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morganMiddleware);

// ── Health check ─────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── REST routes ───────────────────────────────────────────────
app.use('/orders', orderRoutes);

// ── Serve static frontend (optional - works without Docker) ──
const frontendPath = path.resolve(__dirname, '../../frontend');
app.use(express.static(frontendPath));

// ── 404 + global error handler ───────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── Socket.IO connection logging ──────────────────────────────
io.on('connection', (socket) => {
  logger.info('🔌 Client connected', { socketId: socket.id });

  socket.on('disconnect', (reason) => {
    logger.info('🔌 Client disconnected', { socketId: socket.id, reason });
  });
});

// ── Startup sequence ──────────────────────────────────────────
export async function startApp() {
  // 1. Verify database connectivity
  await testConnection();

  // 2. Start PostgreSQL LISTEN/NOTIFY service
  notificationService.init(io);

  // 3. Start listening on the configured port
  const PORT = parseInt(process.env.PORT || '3000', 10);
  httpServer.listen(PORT, () => {
    logger.info(`🚀 Server running on http://localhost:${PORT}`);
    logger.info(`📡 Socket.IO ready for connections`);
  });
}

export { app, httpServer, io };
