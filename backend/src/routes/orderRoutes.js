/**
 * orderRoutes.js
 * --------------
 * Defines REST endpoints for the orders resource.
 *
 *   GET    /orders        – list all orders
 *   POST   /orders        – create a new order
 *   PUT    /orders/:id    – update an order
 *   DELETE /orders/:id    – delete an order
 */

import { Router } from 'express';
import {
  getOrders,
  createOrder,
  updateOrder,
  deleteOrder,
} from '../controllers/orderController.js';

const router = Router();

router.get('/',     getOrders);
router.post('/',    createOrder);
router.put('/:id',  updateOrder);
router.delete('/:id', deleteOrder);

export default router;
