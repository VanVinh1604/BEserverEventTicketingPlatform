const express = require("express");
const router = express.Router();

const { buyTickets, getMyOrders } = require("../controllers/orderController");
const { protect } = require("../middleware/authMiddleware");
const { validate } = require("../middleware/validate");
const { buyTicketSchema } = require("../validators/orderValidator");

// ✅ route user mua vé
router.post("/buy", protect,  validate(buyTicketSchema), buyTickets);
router.get("/my-orders", protect, getMyOrders);

module.exports = router;
