// src/routes/adminAnalyticsRoutes.js
const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  getRevenueByEvent,
  getTicketStats,
  getCheckinStats,
} = require("../controllers/adminAnalyticsController");

router.use(protect, authorize("admin"));

router.get("/revenue", getRevenueByEvent);
router.get("/tickets", getTicketStats);
router.get("/checkins", getCheckinStats);

module.exports = router;
