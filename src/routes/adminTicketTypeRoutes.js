const express = require("express");
const router = express.Router();

const TicketType = require("../models/TicketType");
const { protect, authorize } = require("../middleware/authMiddleware");

const { validate } = require("../middleware/validate");
const { createTicketTypeSchema } = require("../validators/ticketTypeValidator");
const { idParamSchema } = require("../validators/commonValidator");

// RBAC cho toàn bộ route
router.use(protect, authorize("admin"));

// CREATE
router.post("/", validate(createTicketTypeSchema), async (req, res) => {
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
router.put("/:id", validate(idParamSchema, "params"), async (req, res) => {
  const ticket = await TicketType.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );
  res.json(ticket);
});

// DELETE
router.delete("/:id", validate(idParamSchema, "params"),async (req, res) => {
  await TicketType.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

module.exports = router;
