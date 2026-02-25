const express = require("express");
const router = express.Router();

const TicketType = require("../models/TicketType");
const Ticket = require("../models/Ticket");

const { protect, authorize } = require("../middleware/authMiddleware");
const { validate } = require("../middleware/validate");
const { createTicketTypeSchema } = require("../validators/ticketTypeValidator");
const { idParamSchema } = require("../validators/commonValidator");


// =====================================================
// 🎫 CHECK-IN (Admin hoặc Staff)
// =====================================================
router.post(
  "/checkin",
  protect,
  authorize("admin", "staff"),
  async (req, res) => {
    try {
      const { qrCode } = req.body;

      if (!qrCode) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng cung cấp QR Code",
        });
      }

      const ticket = await Ticket.findOne({
        $or: [
          { qrCode },
          { _id: qrCode.length === 24 ? qrCode : null },
        ],
      }).populate("event ticketType user");

      if (!ticket) {
        return res.status(404).json({
          success: false,
          message: "Vé không hợp lệ hoặc không tồn tại",
        });
      }

      if (ticket.isCheckedIn) {
        return res.status(400).json({
          success: false,
          message: "Vé đã được sử dụng trước đó",
        });
      }

      ticket.isCheckedIn = true;
      ticket.checkedInAt = new Date();
      await ticket.save();

      res.status(200).json({
        success: true,
        message: "Check-in thành công",
        data: {
          ticketId: ticket._id,
          eventName: ticket.event?.title || ticket.event?.name,
          ticketType: ticket.ticketType?.name,
          customerName: ticket.user?.name,
          checkedInAt: ticket.checkedInAt,
        },
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  }
);


// =====================================================
// 🌍 PUBLIC - GET ALL TICKET TYPES
// =====================================================
router.get("/", async (req, res) => {
  try {
    const tickets = await TicketType.find().populate("event");
    res.json({ success: true, data: tickets });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});


// =====================================================
// 🔐 ADMIN ONLY ROUTES
// =====================================================
router.use(protect, authorize("admin"));


// ➕ CREATE TICKET TYPE
router.post("/", validate(createTicketTypeSchema), async (req, res) => {
  try {
    const { event, name, price, quantity } = req.body;

    const ticket = await TicketType.create({
      event,
      name,
      price,
      quantity,
      remaining: quantity, // luôn set remaining = quantity ban đầu
    });

    res.status(201).json({
      success: true,
      data: ticket,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});


// ✏ UPDATE TICKET TYPE
router.put(
  "/:id",
  validate(idParamSchema, "params"),
  async (req, res) => {
    try {
      const ticket = await TicketType.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );

      if (!ticket) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy loại vé",
        });
      }

      res.json({
        success: true,
        data: ticket,
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  }
);


// ❌ DELETE TICKET TYPE
router.delete(
  "/:id",
  validate(idParamSchema, "params"),
  async (req, res) => {
    try {
      const ticket = await TicketType.findByIdAndDelete(req.params.id);

      if (!ticket) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy loại vé",
        });
      }

      res.json({
        success: true,
        message: "Deleted successfully",
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  }
);

module.exports = router;