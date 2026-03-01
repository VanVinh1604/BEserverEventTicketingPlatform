const Stripe = require('stripe');

// Khởi tạo Stripe với Secret Key từ file .env
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = stripe;