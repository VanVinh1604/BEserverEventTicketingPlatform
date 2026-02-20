const TicketType = require("../models/TicketType");
const Ticket = require("../models/Ticket"); // 👉 Thêm model Ticket để check-in
const AppError = require("../utils/AppError");

exports.createTicketType = async (req, res, next) => {
  try {
    const { event, name, price, quantity } = req.body;

    if (!event || !name) {
      throw new AppError("Missing fields", 400);
    }

    const ticketType = await TicketType.create({
      event,
      name,
      price,
      quantity,
      remaining: quantity,
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
    // Lấy tất cả danh sách loại vé từ Database
    // Dùng populate để lấy luôn thông tin cơ bản của Sự kiện đính kèm
    const ticketTypes = await TicketType.find().populate("event", "title location startDate");
    
    // Trả về cho Frontend
    res.status(200).json({
      success: true,
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