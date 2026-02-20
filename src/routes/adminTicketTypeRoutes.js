const express = require("express");
const router = express.Router();

const TicketType = require("../models/TicketType");
const Ticket = require("../models/Ticket"); // 👉 Phải import bảng Vé vào mới quét được vé
const { protect, authorize } = require("../middleware/authMiddleware");

// ==========================================
// API QUÉT MÃ QR CHECK-IN (Đã fix chuẩn theo cột isCheckedIn của MongoDB)
// ==========================================
router.post("/checkin", protect, async (req, res) => {
  try {
    const { qrCode } = req.body;

    if (!qrCode) {
      return res.status(400).json({ success: false, message: "Vui lòng cung cấp mã vé (QR Code)!" });
    }

    // 1. Tìm vé trong Database
    const ticket = await Ticket.findOne({
      $or: [{ qrCode: qrCode }, { _id: qrCode.length === 24 ? qrCode : null }]
    }).populate("event ticketType user");

    // 2. Các lớp bảo vệ
    if (!ticket) {
      return res.status(404).json({ success: false, message: "❌ Vé không hợp lệ! Không tìm thấy dữ liệu trên hệ thống." });
    }
    
    // 👉 ĐÃ SỬA THÀNH isCheckedIn
    if (ticket.isCheckedIn === true) {
      return res.status(400).json({ success: false, message: "⚠️ Vé này ĐÃ ĐƯỢC SỬ DỤNG trước đó!" });
    }

    // 3. Đánh dấu vé đã check-in
    ticket.isCheckedIn = true; // 👉 ĐÃ SỬA THÀNH isCheckedIn
    await ticket.save();

    // 4. Báo thành công
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
    console.error("Lỗi API Check-in:", err);
    res.status(500).json({ success: false, message: "Lỗi Server: " + err.message });
  }
});

// ==========================================
// RBAC CHO TOÀN BỘ ROUTE BÊN DƯỚI (Chỉ Admin mới được Tạo/Sửa/Xóa loại vé)
// ==========================================
router.use(protect, authorize("admin"));

// CREATE
router.post("/", async (req, res) => {
  try {
    const ticket = await TicketType.create(req.body);
    res.status(201).json(ticket);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// GET ALL
router.get("/", async (req, res) => {
  const tickets = await TicketType.find().populate("event");
  res.json(tickets);
});

// UPDATE
router.put("/:id", async (req, res) => {
  const ticket = await TicketType.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );
  res.json(ticket);
});

// DELETE
router.delete("/:id", async (req, res) => {
  await TicketType.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

module.exports = router;