const stripe = require('../config/stripe');
const payos = require('../config/payos');
const Order = require('../models/Order');
const { fulfillOrder, cancelOrder } = require('./orderController');

const normalizeBaseUrl = (url, fallback) => {
  const base = String(url || fallback || "").trim();
  return base.endsWith("/") ? base.slice(0, -1) : base;
};

const CLIENT_URL = normalizeBaseUrl(process.env.CLIENT_URL, "http://localhost:3000");
const SERVER_URL =
  normalizeBaseUrl(
    process.env.SERVER_URL || process.env.RENDER_EXTERNAL_URL,
    `http://localhost:${process.env.PORT || 8000}`
  );

const getServerBaseUrl = (req) => {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim();
  const forwardedHost = String(req.headers["x-forwarded-host"] || "").trim();
  const host = forwardedHost || req.get("host");

  if (!host) return SERVER_URL;
  const protocol = forwardedProto || req.protocol || "https";
  return `${protocol}://${host}`;
};

const buildCancelReturnUrl = (req, orderId, source) =>
  `${getServerBaseUrl(req)}/api/payments/cancel-return?order_id=${orderId}&source=${source}`;

const markOrderAsCancelledOnGateway = async (orderId) => {
  if (!orderId) return null;

  try {
    return await Order.findOneAndUpdate(
      { _id: orderId, status: "pending" },
      { $set: { paymentCancelledAt: new Date() } },
      { new: true }
    );
  } catch {
    return null;
  }
};

// 1. TẠO SESSION STRIPE
exports.createCheckoutSession = async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ message: "Thiếu orderId" });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({
        message: "Server chưa cấu hình STRIPE_SECRET_KEY",
      });
    }

    const order = await Order.findById(orderId).populate('event');

    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    if (order.status !== "pending") {
      return res.status(400).json({
        message: `Đơn hàng đang ở trạng thái ${order.status}, không thể tạo phiên thanh toán`,
      });
    }

    const STRIPE_MIN_AMOUNT = 12500;
    if (order.totalAmount < STRIPE_MIN_AMOUNT) {
      return res.status(400).json({
        message: `Stripe yêu cầu tối thiểu ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(STRIPE_MIN_AMOUNT)}. Vui lòng dùng PayOS.`,
        suggestPayOS: true
      });
    }

    const unitAmount = Math.round(Number(order.totalAmount));
    if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
      return res.status(400).json({ message: "Tổng tiền đơn hàng không hợp lệ" });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'vnd',
          product_data: { name: `Vé sự kiện: ${order.event?.title || 'Sự kiện'}` },
          unit_amount: unitAmount,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${CLIENT_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: buildCancelReturnUrl(req, orderId, "stripe"),
      metadata: { orderId: order._id.toString() },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 phút
    });

    await Order.findByIdAndUpdate(orderId, {
      paymentInitiatedAt: new Date(),
      paymentCancelledAt: null,
      paymentMethod: order.paymentMethod || "credit_card",
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("❌ Stripe Error:", error);
    res.status(500).json({
      message: "Không tạo được phiên thanh toán Stripe",
      error: error.message,
      code: error.code || null,
      type: error.type || null,
    });
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

    if (order.status !== "pending") {
      return res.status(400).json({
        message: `Đơn hàng đang ở trạng thái ${order.status}, không thể tạo link thanh toán`,
      });
    }

    const orderCode = Number(String(Date.now()).slice(-6));

    const amount = Math.round(Number(order.totalAmount));
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: "Tổng tiền đơn hàng không hợp lệ" });
    }

    const paymentData = {
      orderCode,
      amount,
      description: `DH ${orderId.slice(-8)}`,
      returnUrl: `${CLIENT_URL}/payment-success`,
      cancelUrl: buildCancelReturnUrl(req, orderId, "payos"),
    };

    const paymentLink = await payos.paymentRequests.create(paymentData);
    await Order.findByIdAndUpdate(orderId, {
      paymentCode: orderCode,
      paymentInitiatedAt: new Date(),
      paymentCancelledAt: null,
      paymentMethod: order.paymentMethod || "e_wallet",
    });

    res.json({ url: paymentLink.checkoutUrl, orderCode });
  } catch (error) {
    console.error("❌ LỖI PAYOS:", error);
    res.status(500).json({
      message: "Không tạo được link thanh toán PayOS",
      error: error.message,
      code: error.code || null,
    });
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

      let fulfilledOrder = null;
      try {
        fulfilledOrder = await fulfillOrder(order._id.toString());
        console.log(`✅ PayOS: Order ${order._id} fulfilled!`);
      } catch (fulfillError) {
        console.error(`❌ PayOS fulfill thất bại cho order ${order._id}:`, fulfillError.message);
        return;
      }

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
          await cancelOrder(order._id.toString(), "payos_payment_failed");
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
      await cancelOrder(orderId, "stripe_session_expired");
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

      let fulfilledOrder = null;
      try {
        // fulfillOrder tự xử lý idempotent
        fulfilledOrder = await fulfillOrder(orderId);
        console.log(`✅ Stripe verify: Order ${orderId} fulfilled!`);
      } catch (fulfillError) {
        if (String(fulfillError.message || "").includes("không ở trạng thái pending")) {
          return res.status(409).json({
            success: false,
            message: "Đơn hàng đã hết hạn hoặc đã bị huỷ, không thể xác nhận thanh toán",
          });
        }
        throw fulfillError;
      }

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

exports.handlePaymentCancelReturn = async (req, res) => {
  try {
    const orderId = req.query.order_id || req.query.orderId;
    const source = req.query.source || "gateway";

    if (orderId) {
      await markOrderAsCancelledOnGateway(orderId);
    }

    const params = new URLSearchParams();
    if (orderId) params.set("order_id", orderId);
    params.set("source", source);
    const redirectUrl = `${CLIENT_URL}/payment-fail?${params.toString()}`;

    return res.redirect(302, redirectUrl);
  } catch (error) {
    console.error("❌ Payment cancel return error:", error.message);
    return res.redirect(302, `${CLIENT_URL}/payment-fail`);
  }
};

exports.markPaymentCancelled = async (req, res) => {
  try {
    const orderId = req.body?.orderId || req.query?.order_id || req.query?.orderId;
    if (!orderId) {
      return res.status(400).json({ success: false, message: "Thiếu orderId" });
    }

    const updatedOrder = await markOrderAsCancelledOnGateway(orderId);
    if (!updatedOrder) {
      return res.status(200).json({
        success: true,
        message: "Không cập nhật được hoặc đơn không còn pending",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Đã ghi nhận huỷ thanh toán, vé sẽ hoàn lại sau khoảng 30 giây",
      data: { orderId: updatedOrder._id, status: updatedOrder.status },
    });
  } catch (error) {
    console.error("❌ Mark cancel error:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};
