/**
 * orderController.js
 * ------------------
 * Thin HTTP request/response layer.
 * All business logic lives in orderService.js.
 */

import * as orderService from '../services/orderService.js';
import { logger } from '../middleware/logger.js';

// ── GET /orders ───────────────────────────────────────────────
export async function getOrders(req, res, next) {
  try {
    const orders = await orderService.getAllOrders();
    res.json({ success: true, data: orders, count: orders.length });
  } catch (err) {
    next(err);
  }
}

// ── POST /orders ──────────────────────────────────────────────
export async function createOrder(req, res, next) {
  try {
    const { customer_name, product_name, status } = req.body;

    if (!customer_name || !product_name) {
      return res.status(400).json({
        success: false,
        error: { message: 'customer_name and product_name are required', status: 400 },
      });
    }

    const order = await orderService.createOrder({ customer_name, product_name, status });
    logger.info('Order created', { orderId: order.id });
    res.status(201).json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}

// ── PUT /orders/:id ───────────────────────────────────────────
export async function updateOrder(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid order ID', status: 400 } });
    }

    const order = await orderService.updateOrder(id, req.body);
    if (!order) {
      return res.status(404).json({ success: false, error: { message: `Order ${id} not found`, status: 404 } });
    }

    logger.info('Order updated', { orderId: id });
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /orders/:id ────────────────────────────────────────
export async function deleteOrder(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid order ID', status: 400 } });
    }

    const order = await orderService.deleteOrder(id);
    if (!order) {
      return res.status(404).json({ success: false, error: { message: `Order ${id} not found`, status: 404 } });
    }

    logger.info('Order deleted', { orderId: id });
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}
