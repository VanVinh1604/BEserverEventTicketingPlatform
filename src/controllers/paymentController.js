const stripe = require('../config/stripe');
const payos = require('../config/payos');
const Order = require('../models/Order');


// 1. TẠO SESSION STRIPE
exports.createCheckoutSession = async (req, res) => {
    try {
        const { orderId } = req.body;
        const order = await Order.findById(orderId).populate('event');
        
        if (!order) {
            return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
        }

        // ✅ VALIDATE: Stripe yêu cầu tối thiểu 50 cents (~12,500 VND)
        const STRIPE_MIN_AMOUNT = 12500; // 12,500 VND
        
        if (order.totalAmount < STRIPE_MIN_AMOUNT) {
            return res.status(400).json({ 
                message: `Stripe yêu cầu số tiền tối thiểu ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(STRIPE_MIN_AMOUNT)}. Vui lòng sử dụng phương thức PayOS cho đơn hàng nhỏ.`,
                suggestPayOS: true
            });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'vnd',
                    product_data: { 
                        name: `Vé sự kiện: ${order.event?.title || 'Sự kiện'}` 
                    },
                    unit_amount: order.totalAmount,
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${process.env.CLIENT_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.CLIENT_URL}/payment-fail`,
            metadata: { orderId: order._id.toString() },
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error("❌ Stripe Error:", error);
        res.status(500).json({ error: error.message });
    }
};

// 2. TẠO LINK PAYOS (V2 - CÚ PHÁP ĐÚNG)
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

        // Tạo mã orderCode 6 chữ số
        const orderCode = Number(String(Date.now()).slice(-6));

        // Payload cho PayOS v2
        const paymentData = {
            orderCode: orderCode,
            amount: order.totalAmount,
            description: `DH ${orderId.slice(-8)}`, // Tối đa 25 ký tự
            returnUrl: `${process.env.CLIENT_URL}/payment-success`,
            cancelUrl: `${process.env.CLIENT_URL}/payment-fail`,
        };

        console.log("📤 Đang gửi request tới PayOS:", paymentData);

        // ✅ CÚ PHÁP ĐÚNG V2: payos.paymentRequests.create()
        const paymentLink = await payos.paymentRequests.create(paymentData);

        console.log("✅ PayOS Response:", paymentLink);

        // Lưu paymentCode vào order
        const updatedOrder = await Order.findByIdAndUpdate(orderId, { 
            paymentCode: orderCode 
        }, { new: true });

        console.log("💾 Order sau khi lưu paymentCode:", {
            orderId: updatedOrder._id,
            paymentCode: updatedOrder.paymentCode,
            status: updatedOrder.status
        });

        // Trả về checkout URL
        res.json({ 
            url: paymentLink.checkoutUrl,
            orderCode: orderCode
        });

    } catch (error) {
        console.error("❌ LỖI PAYOS:", error);
        console.error("Stack:", error.stack);
        res.status(500).json({ 
            error: error.message,
            details: error.stack 
        });
    }
};

// 3. WEBHOOK PAYOS
exports.handlePayOSWebhook = async (req, res) => {
    try {
        // Respond ngay để PayOS không retry
        res.status(200).json({ success: true }); 

        const webhookData = req.body;
        console.log("📨 Nhận webhook từ PayOS:", JSON.stringify(webhookData, null, 2));

        if (webhookData.code === "00") {
            const data = webhookData.data;
            const orderCode = data.orderCode;

            console.log(`🔍 Đang tìm order với paymentCode: ${orderCode}`);

            // Tìm order
            const order = await Order.findOne({ paymentCode: orderCode })
                .populate('event')
                .populate({ path: 'tickets', populate: { path: 'ticketType' } });

            if (!order) {
                console.log(`⚠️ PayOS: Không tìm thấy order với paymentCode ${orderCode}`);
                console.log(`📋 Tất cả orders hiện có:`, await Order.find({}).select('_id paymentCode status'));
                return;
            }

            console.log(`✅ Tìm thấy order: ${order._id}, status hiện tại: ${order.status}`);

            // Update status
            order.status = 'paid';
            await order.save();

            console.log(`✅ PayOS: Đơn hàng ${order._id} (paymentCode: ${orderCode}) đã được cập nhật thành PAID!`);

            // ✅ GỬI EMAIL SAU KHI THANH TOÁN THÀNH CÔNG
            if (order.customerInfo?.email) {
                try {
                    const { generateTicketEmail } = require('../utils/emailTemplates');
                    const sendEmail = require('../utils/sendEmail');

                    await sendEmail({
                        email: order.customerInfo.email,
                        subject: '🎉 Xác nhận đặt vé thành công - TicketHub',
                        html: generateTicketEmail(order),
                    });

                    console.log(`📧 Đã gửi email xác nhận đến ${order.customerInfo.email}`);
                } catch (emailError) {
                    console.error('❌ Lỗi gửi email:', emailError.message);
                }
            }
        } else {
            console.log(`⚠️ Webhook không thành công. Code: ${webhookData.code}`);
        }
    } catch (error) {
        console.error("❌ Webhook PayOS Error:", error.message);
        console.error("Stack:", error.stack);
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

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const orderId = session.metadata.orderId;

        const order = await Order.findByIdAndUpdate(orderId, { status: 'paid' }, { new: true })
            .populate('event')
            .populate({ path: 'tickets', populate: { path: 'ticketType' } });

        console.log(`✅ Stripe: Đơn hàng ${orderId} đã thanh toán!`);

        // ✅ GỬI EMAIL SAU KHI THANH TOÁN THÀNH CÔNG
        if (order && order.customerInfo?.email) {
            try {
                const { generateTicketEmail } = require('../utils/emailTemplates');
                const sendEmail = require('../utils/sendEmail');

                await sendEmail({
                    email: order.customerInfo.email,
                    subject: '🎉 Xác nhận đặt vé thành công - TicketHub',
                    html: generateTicketEmail(order),
                });

                console.log(`📧 Đã gửi email xác nhận đến ${order.customerInfo.email}`);
            } catch (emailError) {
                console.error('❌ Lỗi gửi email:', emailError.message);
            }
        }
    }
    
    res.json({ received: true });
};
// Thêm vào paymentController.js

/// 5. VERIFY STRIPE SESSION VÀ UPDATE ORDER
exports.verifyStripeSession = async (req, res) => {
    try {
        const { session_id } = req.body;
        
        console.log("🔍 Đang verify Stripe session:", session_id);
        
        if (!session_id) {
            return res.status(400).json({ message: "Thiếu session_id" });
        }

        // Lấy thông tin session từ Stripe
        const session = await stripe.checkout.sessions.retrieve(session_id);
        
        console.log("📋 Stripe Session:", {
            id: session.id,
            payment_status: session.payment_status,
            amount_total: session.amount_total,
            metadata: session.metadata
        });

        // Kiểm tra payment_status
        if (session.payment_status === 'paid') {
            const orderId = session.metadata.orderId;
            
            if (!orderId) {
                return res.status(400).json({ message: "Không tìm thấy orderId trong metadata" });
            }

            console.log(`💾 Đang update order ${orderId} thành paid...`);

            // Update order status
            const updatedOrder = await Order.findByIdAndUpdate(
                orderId,
                { status: 'paid' },
                { new: true }
            ).populate('event').populate({ path: 'tickets', populate: { path: 'ticketType' } });

            if (!updatedOrder) {
                return res.status(404).json({ message: "Không tìm thấy order" });
            }

            console.log(`✅ Stripe: Order ${orderId} đã được verify và update thành paid!`);

            // ✅ GỬI EMAIL SAU KHI VERIFY THÀNH CÔNG
            if (updatedOrder.customerInfo?.email) {
                try {
                    const { generateTicketEmail } = require('../utils/emailTemplates');
                    const sendEmail = require('../utils/sendEmail');

                    await sendEmail({
                        email: updatedOrder.customerInfo.email,
                        subject: '🎉 Xác nhận đặt vé thành công - TicketHub',
                        html: generateTicketEmail(updatedOrder),
                    });

                    console.log(`📧 Đã gửi email xác nhận đến ${updatedOrder.customerInfo.email}`);
                } catch (emailError) {
                    console.error('❌ Lỗi gửi email:', emailError.message);
                }
            }

            return res.json({ 
                success: true, 
                message: "Thanh toán thành công",
                data: updatedOrder 
            });
        } else {
            console.log(`⚠️ Payment status: ${session.payment_status}`);
            return res.status(400).json({ 
                success: false,
                message: "Thanh toán chưa hoàn tất",
                payment_status: session.payment_status 
            });
        }

    } catch (error) {
        console.error("❌ Verify Stripe Error:", error.message);
        console.error("Stack:", error.stack);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
};