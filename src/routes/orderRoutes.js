const express = require("express");
const router = express.Router();

const { buyTickets, getMyOrders } = require("../controllers/orderController");
const { protect } = require("../middleware/authMiddleware");

// ✅ route user mua vé
router.post("/buy", protect, buyTickets);
router.get("/my-orders", protect, getMyOrders);

module.exports = router;
