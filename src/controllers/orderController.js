const { v4: uuidv4 } = require("uuid");
const TicketType = require("../models/TicketType");
const Order = require("../models/Order");
const Ticket = require("../models/Ticket");
const AppError = require("../utils/AppError");
const sendEmail = require("../utils/sendEmail");

exports.buyTickets = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { tickets, ticketTypeId, quantity, eventId, customerInfo } = req.body;
    
    let items = Array.isArray(tickets) ? tickets : [{ ticketTypeId, quantity }];
    let totalAmount = 0;
    const createdTicketIds = [];
    let finalEventId = eventId;

    const order = await Order.create({
      user: userId,
      event: finalEventId,
      customerInfo: customerInfo, 
      totalAmount: 0,
      status: "paid",
    });

    for (const item of items) {
      const ticketType = await TicketType.findById(item.ticketTypeId);
      if (!ticketType) throw new AppError("Không tìm thấy loại vé!", 404);

      const remaining = ticketType.remaining ?? ticketType.quantity;
      if (remaining < item.quantity) {
        throw new AppError(`Vé ${ticketType.name} không đủ số lượng!`, 400);
      }

      ticketType.remaining = remaining - item.quantity;
      await ticketType.save();

      finalEventId = ticketType.event;
      totalAmount += ticketType.price * item.quantity;

      for (let i = 0; i < item.quantity; i++) {
        const ticket = await Ticket.create({
          order: order._id,
          user: userId,
          event: finalEventId,
          ticketType: ticketType._id,
          price: ticketType.price,
          qrCode: uuidv4(),
          status: "active" // Đảm bảo vé mới tạo ở trạng thái active để check-in được
        });
        createdTicketIds.push(ticket._id);
      }
    }

    order.totalAmount = totalAmount;
    order.tickets = createdTicketIds;
    order.event = finalEventId;
    await order.save();

    const populatedOrder = await Order.findById(order._id)
      .populate("event")
      .populate({ path: "tickets", populate: { path: "ticketType" } });

    if (customerInfo?.email) {
      try {
        const eventTitle = populatedOrder.event?.title || populatedOrder.event?.name || "Sự kiện";
        const emailContent = `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
            <h2 style="color: #ea580c;">🎉 Đặt vé thành công!</h2>
            <p>Chào <b>${customerInfo.fullName || "Khách hàng"}</b>,</p>
            <p>Mã đơn hàng: ${order._id}</p>
            <p>Sự kiện: ${eventTitle}</p>
            <p>Số lượng: ${createdTicketIds.length} vé</p>
            <p>Vui lòng vào mục <b>Vé của tôi</b> để lấy mã QR.</p>
          </div>
        `;
        await sendEmail({
          email: customerInfo.email,
          subject: "TicketHub - Xác nhận đặt vé thành công!",
          html: emailContent,
        });
      } catch (e) { console.error("Email error:", e); }
    }

    res.json({ success: true, message: "Đặt vé thành công!", data: populatedOrder });
  } catch (err) { next(err); }
};

exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id })
      .populate("event")
      .populate({ path: "tickets", populate: { path: "ticketType" } });
    res.json({ success: true, data: orders });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getAllOrdersAdmin = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("event")
      .populate("user")
      .populate("tickets") // Thêm cái này để Admin dashboard đếm được số vé
      .sort({ createdAt: -1 });
    res.json({ success: true, data: orders });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};