const stripe = require('../config/stripe');
const payos = require('../config/payos');
const Order = require('../models/Order');
const { fulfillOrder, cancelOrder } = require('./orderController');

// 1. TẠO SESSION STRIPE
exports.createCheckoutSession = async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId).populate('event');

    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    const STRIPE_MIN_AMOUNT = 12500;
    if (order.totalAmount < STRIPE_MIN_AMOUNT) {
      return res.status(400).json({
        message: `Stripe yêu cầu tối thiểu ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(STRIPE_MIN_AMOUNT)}. Vui lòng dùng PayOS.`,
        suggestPayOS: true
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'vnd',
          product_data: { name: `Vé sự kiện: ${order.event?.title || 'Sự kiện'}` },
          unit_amount: order.totalAmount,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.CLIENT_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/payment-fail?order_id=${orderId}`,
      metadata: { orderId: order._id.toString() },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 phút
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("❌ Stripe Error:", error);
    res.status(500).json({ error: error.message });
  }
};

// 2. TẠO LINK PAYOS
exports.createPayOSLink = async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: "Thiếu orderId" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    const orderCode = Number(String(Date.now()).slice(-6));

    const paymentData = {
      orderCode,
      amount: order.totalAmount,
      description: `DH ${orderId.slice(-8)}`,
      returnUrl: `${process.env.CLIENT_URL}/payment-success`,
      cancelUrl: `${process.env.CLIENT_URL}/payment-fail?order_id=${orderId}`,
    };

    const paymentLink = await payos.paymentRequests.create(paymentData);
    await Order.findByIdAndUpdate(orderId, { paymentCode: orderCode });

    res.json({ url: paymentLink.checkoutUrl, orderCode });
  } catch (error) {
    console.error("❌ LỖI PAYOS:", error);
    res.status(500).json({ error: error.message });
  }
};

// 3. WEBHOOK PAYOS
exports.handlePayOSWebhook = async (req, res) => {
  try {
    res.status(200).json({ success: true });

    const webhookData = req.body;
    console.log("📨 PayOS webhook:", JSON.stringify(webhookData, null, 2));

    if (webhookData.code === "00") {
      const orderCode = webhookData.data?.orderCode;
      const order = await Order.findOne({ paymentCode: orderCode });

      if (!order) {
        console.log(`⚠️ Không tìm thấy order với paymentCode: ${orderCode}`);
        return;
      }

      const fulfilledOrder = await fulfillOrder(order._id.toString());
      console.log(`✅ PayOS: Order ${order._id} fulfilled!`);

      if (fulfilledOrder?.customerInfo?.email) {
        try {
          const { generateTicketEmail } = require('../utils/emailTemplates');
          const sendEmail = require('../utils/sendEmail');
          await sendEmail({
            email: fulfilledOrder.customerInfo.email,
            subject: '🎉 Xác nhận đặt vé thành công - TicketHub',
            html: generateTicketEmail(fulfilledOrder),
          });
          console.log(`📧 Email gửi đến ${fulfilledOrder.customerInfo.email}`);
        } catch (emailError) {
          console.error('❌ Lỗi gửi email:', emailError.message);
        }
      }
    } else {
      // Thanh toán thất bại → release vé
      const orderCode = webhookData.data?.orderCode;
      if (orderCode) {
        const order = await Order.findOne({ paymentCode: orderCode });
        if (order) {
          await cancelOrder(order._id.toString());
          console.log(`🔄 PayOS: Order ${order._id} cancelled`);
        }
      }
    }
  } catch (error) {
    console.error("❌ Webhook PayOS Error:", error.message);
  }
};

// 4. WEBHOOK STRIPE
exports.handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Stripe Webhook Error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Thanh toán thành công
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const orderId = session.metadata.orderId;

    if (session.payment_status === 'paid') {
      try {
        const fulfilledOrder = await fulfillOrder(orderId);
        console.log(`✅ Stripe: Order ${orderId} fulfilled!`);

        if (fulfilledOrder?.customerInfo?.email) {
          const { generateTicketEmail } = require('../utils/emailTemplates');
          const sendEmail = require('../utils/sendEmail');
          await sendEmail({
            email: fulfilledOrder.customerInfo.email,
            subject: '🎉 Xác nhận đặt vé thành công - TicketHub',
            html: generateTicketEmail(fulfilledOrder),
          });
          console.log(`📧 Email gửi đến ${fulfilledOrder.customerInfo.email}`);
        }
      } catch (err) {
        console.error("❌ fulfillOrder error:", err.message);
      }
    }
  }

  // Session hết hạn → release vé
  if (event.type === 'checkout.session.expired') {
    const session = event.data.object;
    const orderId = session.metadata.orderId;
    if (orderId) {
      await cancelOrder(orderId);
      console.log(`🔄 Stripe session expired: Order ${orderId} cancelled`);
    }
  }

  res.json({ received: true });
};

// 5. VERIFY STRIPE SESSION (fallback nếu webhook chưa kịp)
exports.verifyStripeSession = async (req, res) => {
  try {
    const { session_id } = req.body;

    if (!session_id) {
      return res.status(400).json({ message: "Thiếu session_id" });
    }

    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status === 'paid') {
      const orderId = session.metadata.orderId;

      if (!orderId) {
        return res.status(400).json({ message: "Không tìm thấy orderId" });
      }

      // fulfillOrder tự xử lý idempotent
      const fulfilledOrder = await fulfillOrder(orderId);
      console.log(`✅ Stripe verify: Order ${orderId} fulfilled!`);

      if (fulfilledOrder?.customerInfo?.email) {
        try {
          const { generateTicketEmail } = require('../utils/emailTemplates');
          const sendEmail = require('../utils/sendEmail');
          await sendEmail({
            email: fulfilledOrder.customerInfo.email,
            subject: '🎉 Xác nhận đặt vé thành công - TicketHub',
            html: generateTicketEmail(fulfilledOrder),
          });
        } catch (emailError) {
          console.error('❌ Lỗi gửi email:', emailError.message);
        }
      }

      return res.json({
        success: true,
        message: "Thanh toán thành công",
        data: fulfilledOrder
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Thanh toán chưa hoàn tất",
        payment_status: session.payment_status
      });
    }
  } catch (error) {
    console.error("❌ Verify Stripe Error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};