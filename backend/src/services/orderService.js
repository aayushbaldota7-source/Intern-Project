/**
 * orderService.js
 * ---------------
 * All database interactions for the orders table.
 * Uses the shared pg.Pool for connection reuse.
 */

import { pool } from '../config/database.js';

// ── Fetch all orders ─────────────────────────────────────────
export async function getAllOrders() {
  const { rows } = await pool.query(
    'SELECT * FROM orders ORDER BY updated_at DESC',
  );
  return rows;
}

// ── Fetch one order by ID ────────────────────────────────────
export async function getOrderById(id) {
  const { rows } = await pool.query(
    'SELECT * FROM orders WHERE id = $1',
    [id],
  );
  return rows[0] || null;
}

// ── Create a new order ───────────────────────────────────────
export async function createOrder({ customer_name, product_name, status = 'pending' }) {
  const { rows } = await pool.query(
    `INSERT INTO orders (customer_name, product_name, status, updated_at)
     VALUES ($1, $2, $3, NOW())
     RETURNING *`,
    [customer_name, product_name, status],
  );
  return rows[0];
}

// ── Update an existing order ─────────────────────────────────
export async function updateOrder(id, { customer_name, product_name, status }) {
  // Build a dynamic SET clause so callers can patch individual fields
  const fields  = [];
  const values  = [];
  let   idx     = 1;

  if (customer_name !== undefined) { fields.push(`customer_name = $${idx++}`); values.push(customer_name); }
  if (product_name  !== undefined) { fields.push(`product_name  = $${idx++}`); values.push(product_name); }
  if (status        !== undefined) { fields.push(`status        = $${idx++}`); values.push(status); }

  if (fields.length === 0) throw Object.assign(new Error('No fields to update'), { status: 400 });

  // Always bump updated_at
  fields.push(`updated_at = NOW()`);
  values.push(id);

  const { rows } = await pool.query(
    `UPDATE orders SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values,
  );
  return rows[0] || null;
}

// ── Delete an order ──────────────────────────────────────────
export async function deleteOrder(id) {
  const { rows } = await pool.query(
    'DELETE FROM orders WHERE id = $1 RETURNING *',
    [id],
  );
  return rows[0] || null;
}
