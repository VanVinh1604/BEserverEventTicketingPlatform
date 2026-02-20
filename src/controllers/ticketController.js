const Ticket = require("../models/Ticket");
const Checkin = require("../models/Checkin");
const AppError = require("../utils/AppError");
const mongoose = require("mongoose");


exports.checkInTicket = async (req, res, next) => {
  try {
    const { qrCode } = req.body; 

    // Tìm vé theo QR hoặc ID
    const ticket = await Ticket.findOne({
      $or: [
        { qrCode: qrCode },
        { _id: mongoose.Types.ObjectId.isValid(qrCode) ? qrCode : new mongoose.Types.ObjectId() }
      ]
    });

    // Kiểm tra nếu không thấy vé
    if (!ticket) {
      return res.status(400).json({ success: false, message: "Vé không tồn tại!" });
    }

    // Kiểm tra nếu vé đã dùng rồi
    if (ticket.status === "used") {
      return res.status(400).json({ success: false, message: "Vé này đã được check-in trước đó!" });
    }

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