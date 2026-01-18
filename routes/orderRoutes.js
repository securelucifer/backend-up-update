import express from 'express';
import {
    createOrder,
    getAllOrders,
    getOrderById,
    updateOrderStatus,
    getOrderByNumber,
    deleteOrder
} from '../controllers/orderController.js';

const router = express.Router();

// Create new order
router.post('/createOrder', createOrder);

// Get all orders (with optional userId, status, pagination)
router.get('/orders/:userId', getAllOrders);

// Get all orders without userId
router.get('/orders', getAllOrders);

// Get single order by ID
router.get('/order/:id', getOrderById);

// Get order by order number
router.get('/order/number/:orderNumber', getOrderByNumber);

// Update order status
router.put('/order/:id/status', updateOrderStatus);

// Delete order
router.delete('/order/:id', deleteOrder);

export default router;
