const express = require("express");
const router = express.Router();

const TicketType = require("../models/TicketType");
const Event = require("../models/Event");
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
    const { event, name, price, quantity, remaining, description, isActive } = req.body || {};

    if (!event || !name) {
      return res.status(400).json({ success: false, message: "Thiếu event hoặc name" });
    }

    const parsedPrice = Number(price);
    const parsedQuantity = Number(quantity);
    const parsedRemaining =
      remaining !== undefined ? Number(remaining) : parsedQuantity;

    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ success: false, message: "Giá vé không hợp lệ" });
    }
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      return res.status(400).json({ success: false, message: "Số lượng vé không hợp lệ" });
    }

    const ticket = await TicketType.create({
      event,
      name: String(name).trim(),
      description: typeof description === "string" ? description : "",
      price: parsedPrice,
      quantity: parsedQuantity,
      remaining: Number.isFinite(parsedRemaining) ? Math.max(0, parsedRemaining) : parsedQuantity,
      isActive: isActive !== false,
    });

    await Event.findByIdAndUpdate(event, { $addToSet: { ticketTypes: ticket._id } });

    res.status(201).json({ success: true, data: ticket });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// GET ALL
router.get("/", async (req, res) => {
  const tickets = await TicketType.find().populate("event");
  res.json(tickets);
});

// UPDATE
router.put("/:id", async (req, res) => {
  const existing = await TicketType.findById(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, message: "Không tìm thấy loại vé" });
  }

  const updateData = {};
  const { event, name, description, price, quantity, remaining, isActive } = req.body || {};

  if (event !== undefined) updateData.event = event;
  if (name !== undefined) updateData.name = String(name).trim();
  if (description !== undefined) updateData.description = typeof description === "string" ? description : "";

  if (price !== undefined) {
    const parsedPrice = Number(price);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ success: false, message: "Giá vé không hợp lệ" });
    }
    updateData.price = parsedPrice;
  }

  if (quantity !== undefined) {
    const parsedQuantity = Number(quantity);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      return res.status(400).json({ success: false, message: "Số lượng vé không hợp lệ" });
    }
    updateData.quantity = parsedQuantity;
  }

  if (remaining !== undefined) {
    const parsedRemaining = Number(remaining);
    if (!Number.isFinite(parsedRemaining) || parsedRemaining < 0) {
      return res.status(400).json({ success: false, message: "Số vé còn lại không hợp lệ" });
    }
    updateData.remaining = parsedRemaining;
  }

  if (isActive !== undefined) updateData.isActive = isActive !== false;

  // Nếu admin đổi quantity mà không gửi remaining, giữ lại số vé đã bán.
  if (updateData.quantity !== undefined && updateData.remaining === undefined) {
    const sold = Math.max(0, (Number(existing.quantity) || 0) - (Number(existing.remaining) || 0));
    updateData.remaining = Math.max(0, updateData.quantity - sold);
  }

  const ticket = await TicketType.findByIdAndUpdate(
    req.params.id,
    { $set: updateData },
    { new: true, runValidators: true }
  );

  const oldEventId = existing.event ? String(existing.event) : "";
  const newEventId = ticket?.event ? String(ticket.event) : "";
  if (oldEventId && newEventId && oldEventId !== newEventId) {
    await Event.findByIdAndUpdate(oldEventId, { $pull: { ticketTypes: existing._id } });
    await Event.findByIdAndUpdate(newEventId, { $addToSet: { ticketTypes: existing._id } });
  }

  res.json({ success: true, data: ticket });
});

// DELETE
router.delete("/:id", async (req, res) => {
  const deleted = await TicketType.findByIdAndDelete(req.params.id);
  if (deleted?.event) {
    await Event.findByIdAndUpdate(deleted.event, { $pull: { ticketTypes: deleted._id } });
  }
  res.json({ success: true, message: "Deleted" });
});

module.exports = router;
