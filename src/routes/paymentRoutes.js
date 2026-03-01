const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// Stripe
router.post('/create-checkout-session', paymentController.createCheckoutSession);
router.post('/webhook', express.raw({type: 'application/json'}), paymentController.handleWebhook);
router.post('/verify-stripe-session', paymentController.verifyStripeSession);
// PayOS (Banking & MoMo)
router.post('/create-payos-link', paymentController.createPayOSLink);
// Trong file routes của bạn
router.post('/payos-webhook', paymentController.handlePayOSWebhook);
module.exports = router;