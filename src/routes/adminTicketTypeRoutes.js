const express = require("express");
const router = express.Router();

const TicketType = require("../models/TicketType");
const Ticket = require("../models/Ticket");

const { protect, authorize } = require("../middleware/authMiddleware");
const { validate } = require("../middleware/validate");
const { createTicketTypeSchema } = require("../validators/ticketTypeValidator");
const { idParamSchema } = require("../validators/commonValidator");


// ==========================================
// CHECK-IN ROUTE (Admin hoặc Staff)
// ==========================================
router.post("/checkin", protect, authorize("admin", "staff"), async (req, res) => {
  try {
    const { qrCode } = req.body;

    if (!qrCode) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp QR Code"
      });
    }

    const ticket = await Ticket.findOne({
      $or: [
        { qrCode },
        { _id: qrCode.length === 24 ? qrCode : null }
      ]
    }).populate("event ticketType user");

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Vé không hợp lệ hoặc không tồn tại"
      });
    }

    if (ticket.isCheckedIn) {
      return res.status(400).json({
        success: false,
        message: "Vé đã được sử dụng trước đó"
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
        eventName: ticket.event?.title,
        ticketType: ticket.ticketType?.name,
        customerName: ticket.user?.name,
        checkedInAt: ticket.checkedInAt
      }
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});


// ==========================================
// PUBLIC ROUTE - GET ALL TICKET TYPES
// ==========================================
router.get("/", async (req, res) => {
  const tickets = await TicketType.find().populate("event");
  res.json(tickets);
});


// ==========================================
// ADMIN ONLY ROUTES
// ==========================================
router.use(protect, authorize("admin"));

router.post("/", validate(createTicketTypeSchema), async (req, res) => {
  const ticket = await TicketType.create(req.body);
  res.status(201).json(ticket);
});

router.put("/:id",
  validate(idParamSchema, "params"),
  async (req, res) => {
    const ticket = await TicketType.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(ticket);
  }
);

router.delete("/:id",
  validate(idParamSchema, "params"),
  async (req, res) => {
    await TicketType.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted successfully" });
  }
);

module.exports = router;
