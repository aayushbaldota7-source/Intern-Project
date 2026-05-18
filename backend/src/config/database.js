/**
 * database.js
 * -----------
 * Exports a shared pg.Pool for REST queries and a factory function
 * that creates a dedicated pg.Client used exclusively for LISTEN.
 *
 * Two separate connections are intentional:
 *  - pool  : connection pooling for concurrent REST requests
 *  - listen client : a long-lived connection that stays in LISTEN mode
 *                    (pg.Pool recycles connections and would drop LISTEN state)
 */

import pg from 'pg';
import { logger } from '../middleware/logger.js';

const { Pool, Client } = pg;

// ── Connection config (from environment variables) ──────────
const dbConfig = {
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME     || 'ordersdb',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
};

// ── Shared query pool ────────────────────────────────────────
export const pool = new Pool({
  ...dbConfig,
  max:              10,   // maximum pool size
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  logger.error('Unexpected pg pool error', { error: err.message });
});

// ── LISTEN client factory ────────────────────────────────────
/**
 * Creates and connects a fresh pg.Client dedicated to LISTEN/NOTIFY.
 * The caller is responsible for connecting and ending it.
 */
export function createListenClient() {
  return new Client(dbConfig);
}

// ── Health check ─────────────────────────────────────────────
export async function testConnection() {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    logger.info('✅ Database connection successful');
  } finally {
    client.release();
  }
}
