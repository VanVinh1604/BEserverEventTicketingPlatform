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

    // ── Validate items trước khi làm bất cứ điều gì ─────────────────────────
    if (!items || items.length === 0) {
      return next(new AppError("Không có vé nào được chọn!", 400));
    }

    for (const item of items) {
      if (!item.ticketTypeId) {
        return next(new AppError("Thiếu ticketTypeId trong danh sách vé!", 400));
      }
      if (!item.quantity || item.quantity < 1) {
        return next(new AppError("Số lượng vé không hợp lệ!", 400));
      }
    }

    // ── Tính toán trước, tạo Order sau (tránh tạo order rỗng khi lỗi) ───────
    let totalAmount = 0;
    let finalEventId = eventId;
    const ticketDataList = []; // Lưu dữ liệu tạm để tạo ticket sau

    for (const item of items) {
      const ticketType = await TicketType.findById(item.ticketTypeId);
      if (!ticketType) {
        return next(new AppError(`Không tìm thấy loại vé: ${item.ticketTypeId}`, 404));
      }

      // Bug 2 fix: đảm bảo remaining luôn là số
      const remaining = typeof ticketType.remaining === "number"
        ? ticketType.remaining
        : ticketType.quantity;

      if (remaining < item.quantity) {
        return next(new AppError(`Vé "${ticketType.name}" không đủ số lượng! Còn lại: ${remaining}`, 400));
      }

      finalEventId = ticketType.event; // Lấy eventId từ ticketType (đáng tin hơn client)
      totalAmount += ticketType.price * item.quantity;

      ticketDataList.push({ ticketType, quantity: item.quantity, remaining });
    }

    // ── Tạo Order với đầy đủ thông tin ──────────────────────────────────────
    const order = await Order.create({
      user: userId,
      event: finalEventId,   // Dùng eventId lấy từ ticketType (chắc chắn hợp lệ)
      customerInfo,
      totalAmount,
      status: "paid",
    });

    // ── Tạo Ticket và trừ số lượng ──────────────────────────────────────────
    const createdTicketIds = [];

    for (const { ticketType, quantity, remaining } of ticketDataList) {
      ticketType.remaining = remaining - quantity;
      await ticketType.save();

      for (let i = 0; i < quantity; i++) {
        const ticket = await Ticket.create({
          order: order._id,
          user: userId,
          event: finalEventId,
          ticketType: ticketType._id,
          price: ticketType.price,
          qrCode: uuidv4(),
          status: "active",
        });
        createdTicketIds.push(ticket._id);
      }
    }

    order.tickets = createdTicketIds;
    await order.save();

    const populatedOrder = await Order.findById(order._id)
      .populate("event")
      .populate({ path: "tickets", populate: { path: "ticketType" } });

    // ── Gửi email xác nhận ───────────────────────────────────────────────────
    if (customerInfo?.email) {
      try {
        const eventTitle = populatedOrder.event?.title || populatedOrder.event?.name || "Sự kiện";
        await sendEmail({
          email: customerInfo.email,
          subject: "TicketHub - Xác nhận đặt vé thành công!",
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
              <h2 style="color: #ea580c;">🎉 Đặt vé thành công!</h2>
              <p>Chào <b>${customerInfo.fullName || "Khách hàng"}</b>,</p>
              <p>Mã đơn hàng: <b>${order._id}</b></p>
              <p>Sự kiện: <b>${eventTitle}</b></p>
              <p>Số lượng: <b>${createdTicketIds.length} vé</b></p>
              <p>Vui lòng vào mục <b>Vé của tôi</b> để lấy mã QR.</p>
            </div>
          `,
        });
      } catch (e) {
        console.error("Email error:", e); // Không throw, không ảnh hưởng response
      }
    }

    res.json({ success: true, message: "Đặt vé thành công!", data: populatedOrder });
  } catch (err) {
    next(err);
  }
};

exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id })
      .populate("event")
      .populate({ path: "tickets", populate: { path: "ticketType" } })
      .sort({ createdAt: -1 });
    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAllOrdersAdmin = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("event")
      .populate("user")
      .populate("tickets")
      .sort({ createdAt: -1 });
    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};