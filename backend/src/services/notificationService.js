/**
 * notificationService.js
 * ----------------------
 * Bridges PostgreSQL LISTEN/NOTIFY with Socket.IO WebSockets.
 *
 * Flow:
 *   PostgreSQL trigger
 *     → pg_notify('orders_channel', payload)
 *       → pg.Client 'notification' event (this file)
 *         → Socket.IO broadcast to all connected clients
 *
 * The service holds a reference to the Socket.IO server (io) that
 * is injected once at startup via `init(io)`.
 */

import { createListenClient } from '../config/database.js';
import { logger } from '../middleware/logger.js';

const CHANNEL = 'orders_channel';
const RECONNECT_DELAY_MS = 5_000;

let io        = null; // Socket.IO server instance
let pgClient  = null; // Dedicated LISTEN pg.Client

// ── Initialise ────────────────────────────────────────────────
/**
 * Call once at app startup, passing the Socket.IO server.
 * Starts the LISTEN loop immediately.
 */
export function init(socketIoServer) {
  io = socketIoServer;
  startListening();
}

// ── Broadcast helper ─────────────────────────────────────────
/**
 * Emit an order-change event to every connected Socket.IO client.
 * @param {object} payload  Parsed JSON from the pg NOTIFY payload
 */
export function broadcastOrderChange(payload) {
  if (!io) {
    logger.warn('notificationService: Socket.IO server not initialised');
    return;
  }
  io.emit('order:change', payload);
  logger.info('📢 Broadcasted order:change', {
    operation: payload.operation,
    orderId:   payload.data?.id,
  });
}

// ── LISTEN loop ───────────────────────────────────────────────
async function startListening() {
  // Clean up any previous client
  if (pgClient) {
    try { await pgClient.end(); } catch (_) { /* ignore */ }
    pgClient = null;
  }

  pgClient = createListenClient();

  try {
    await pgClient.connect();
    await pgClient.query(`LISTEN ${CHANNEL}`);
    logger.info(`👂 Listening on PostgreSQL channel "${CHANNEL}"`);

    // ── Handle incoming notifications ──
    pgClient.on('notification', (msg) => {
      if (msg.channel !== CHANNEL) return;

      try {
        const payload = JSON.parse(msg.payload);
        broadcastOrderChange(payload);
      } catch (err) {
        logger.error('Failed to parse notification payload', { error: err.message, raw: msg.payload });
      }
    });

    // ── Handle unexpected disconnects ──
    pgClient.on('error', (err) => {
      logger.error('LISTEN client error — will reconnect', { error: err.message });
      scheduleReconnect();
    });

    pgClient.on('end', () => {
      logger.warn('LISTEN client disconnected — will reconnect');
      scheduleReconnect();
    });

  } catch (err) {
    logger.error('Failed to start LISTEN client', { error: err.message });
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  logger.info(`🔄 Reconnecting to "${CHANNEL}" in ${RECONNECT_DELAY_MS / 1000}s…`);
  setTimeout(startListening, RECONNECT_DELAY_MS);
}
