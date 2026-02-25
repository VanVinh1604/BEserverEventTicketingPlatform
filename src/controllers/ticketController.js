const mongoose = require("mongoose");
const Ticket = require("../models/Ticket");
const Checkin = require("../models/Checkin");

exports.checkInTicket = async (req, res, next) => {
  try {
    const { qrCode } = req.body; 

    // Tìm vé theo QR hoặc ID
    const ticket = await Ticket.findOne({
      $or: [
        { qrCode: qrCode },
        { _id: mongoose.Types.ObjectId.isValid(qrCode) ? qrCode : new mongoose.Types.ObjectId() }
      ]
    }).populate("event", "startDate date title"); // ← thêm populate để lấy ngày sự kiện

    // Kiểm tra nếu không thấy vé
    if (!ticket) {
      return res.status(400).json({ success: false, message: "Vé không tồn tại!" });
    }

    // Kiểm tra nếu vé đã dùng rồi
    if (ticket.status === "used") {
      return res.status(400).json({ success: false, message: "Vé này đã được check-in trước đó!" });
    }

    // ── Kiểm tra ngày sự kiện ──────────────────────────────────────────────
    const eventDate = ticket.event?.startDate || ticket.event?.date;
    if (eventDate) {
      const evDay = new Date(new Date(eventDate).toDateString());
      const today = new Date(new Date().toDateString());

      if (evDay < today) {
        return res.status(400).json({
          success: false,
          message: `Sự kiện đã kết thúc ngày ${evDay.toLocaleDateString("vi-VN")}. Không thể check-in.`,
        });
      }

      if (evDay > today) {
        return res.status(400).json({
          success: false,
          message: `Sự kiện chưa diễn ra (${evDay.toLocaleDateString("vi-VN")}). Chỉ được check-in đúng ngày.`,
        });
      }
    }
    // ── Hết kiểm tra ngày ─────────────────────────────────────────────────

    // Cập nhật vé thành 'used'
    ticket.status = "used";
    ticket.checkedInAt = new Date();
    await ticket.save();

    // TẠO DÒNG DỮ LIỆU MỚI VÀO BẢNG CHECKINS
    await Checkin.create({
      ticket: ticket._id,
      event: ticket.event,
      user: ticket.user,
      checkInTime: new Date()
    });

    res.status(200).json({
      success: true,
      message: "Check-in thành công!",
      data: ticket
    });
  } catch (error) {
    next(error);
  }
};