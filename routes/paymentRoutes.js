import express from 'express';
import {
    checkPaymentStatus,
    createPayment,
    getMerchantUPI,
    paymentWebhook,
    simulatePayment,
    verifyPayment
} from '../controllers/paymentController.js';

const router = express.Router();

router.post('/create', createPayment);
router.get('/status/:tid', checkPaymentStatus);
router.post('/verify', verifyPayment);
router.get('/merchant-upi', getMerchantUPI);

// Webhook for real-time updates
router.post('/webhook', paymentWebhook);

// Testing endpoint (Remove in production)
router.post('/simulate', simulatePayment);

export default router;
