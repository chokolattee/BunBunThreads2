const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order');

// Create a new order
router.post('/', orderController.createOrder);

// Get orders by customer ID
router.get('/customer/:customerId', orderController.getOrdersByCustomer);
router.get('/shipping', orderController.getShippingOptions);

// Admin
router.get('/admin', orderController.getAllOrders);
router.get('/admin/:orderId', orderController.getOrderById);
router.put('/admin/:orderId/status', orderController.updateOrderStatus);
module.exports = router;
