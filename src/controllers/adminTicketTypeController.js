const TicketType = require("../models/TicketType");
const Ticket = require("../models/Ticket"); // 👉 Thêm model Ticket để check-in
const AppError = require("../utils/AppError");
const mongoose = require("mongoose");

exports.createTicketType = async (req, res, next) => {
  try {
    const { event, name, price, quantity, description, isActive, remaining } = req.body;

    if (!event || !name) {
      throw new AppError("Missing fields", 400);
    }

    const parsedQuantity = Number(quantity);
    const parsedRemaining = remaining !== undefined ? Number(remaining) : parsedQuantity;

    const ticketType = await TicketType.create({
      event,
      name: String(name).trim(),
      description: typeof description === "string" ? description : "",
      price: Number(price) || 0,
      quantity: Number.isFinite(parsedQuantity) ? parsedQuantity : 0,
      remaining: Number.isFinite(parsedRemaining) ? parsedRemaining : 0,
      isActive: isActive !== false,
    });

    res.json(ticketType);
  } catch (err) {
    next(err);
  }
};

exports.updateTicketType = async (req, res, next) => {
  try {
    const ticketType = await TicketType.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(ticketType);
  } catch (err) {
    next(err);
  }
};

exports.deleteTicketType = async (req, res, next) => {
  try {
    await TicketType.findByIdAndDelete(req.params.id);
    res.json({ message: "TicketType deleted" });
  } catch (err) {
    next(err);
  }
};

exports.getTicketTypes = async (req, res, next) => {
  try {
    const eventId = req.params?.eventId || req.query?.event;
    const includeInactive = String(req.query?.includeInactive || "").toLowerCase() === "true";

    const query = {};
    if (eventId) {
      if (!mongoose.Types.ObjectId.isValid(eventId)) {
        return res.status(400).json({
          success: false,
          message: "event id không hợp lệ",
        });
      }
      query.event = eventId;
    }
    if (!includeInactive) {
      query.isActive = { $ne: false };
    }

    // Lấy danh sách loại vé + thông tin sự kiện cơ bản, ưu tiên thứ tự giá tăng dần.
    const ticketTypes = await TicketType.find(query)
      .populate("event", "title location startDate endDate status")
      .sort({ price: 1, name: 1 });
    
    res.status(200).json({
      success: true,
      results: ticketTypes.length,
      data: ticketTypes
    });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// THÊM MỚI: HÀM QUÉT MÃ QR CHECK-IN VÉ
// ==========================================
// ==========================================
// ĐOẠN CODE ĐÃ ĐƯỢC CẬP NHẬT THEO ĐÚNG CỘT isCheckedIn
// ==========================================
exports.checkInTicket = async (req, res, next) => {
  try {
    const { qrCode } = req.body;

    if (!qrCode) {
      return res.status(400).json({ success: false, message: "Vui lòng cung cấp mã vé (QR Code)!" });
    }

    const ticket = await Ticket.findOne({
      $or: [{ qrCode: qrCode }, { _id: qrCode.length === 24 ? qrCode : null }]
    }).populate("event ticketType user");

    if (!ticket) {
      return res.status(404).json({ success: false, message: "❌ Vé không hợp lệ! Không tìm thấy dữ liệu trên hệ thống." });
    }

    // 👉 SỬA Ở ĐÂY: Dùng cột isCheckedIn của bạn thay vì status
    if (ticket.isCheckedIn === true) {
      return res.status(400).json({ success: false, message: "⚠️ Vé này ĐÃ ĐƯỢC SỬ DỤNG trước đó!" });
    }

    // 👉 SỬA Ở ĐÂY: Đổi isCheckedIn thành true
    ticket.isCheckedIn = true;
    await ticket.save();

    res.status(200).json({
      success: true,
      message: "✅ Check-in thành công! Mời khách vào cổng.",
      data: {
        ticketId: ticket._id,
        eventName: ticket.event?.title || ticket.event?.name,
        ticketType: ticket.ticketType?.name,
        customerName: ticket.user ? ticket.user.name : "Khách vãng lai"
      }
    });

  } catch (err) {
    next(err);
  }
};
// Thêm vào controllers/adminTicketController.js
exports.approveOrder = async (req, res) => {
    const { orderId } = req.params;
    await Order.findByIdAndUpdate(orderId, { status: 'paid' });
    res.json({ message: "Đã duyệt đơn hàng thành công!" });
};
