const express = require("express");
const router = express.Router();
const { checkInTicket } = require("../controllers/ticketController");
const { protect, authorize } = require("../middleware/authMiddleware");

router.post("/check-in", protect, authorize("admin"), checkInTicket);

module.exports = router;
