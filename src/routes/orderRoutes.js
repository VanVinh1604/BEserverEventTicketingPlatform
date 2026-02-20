const express = require("express");
const router = express.Router();
const { buyTickets, getMyOrders, getAllOrdersAdmin } = require("../controllers/orderController");
const { protect, authorize } = require("../middleware/authMiddleware");
const { validate } = require("../middleware/validate");
const { buyTicketSchema } = require("../validators/orderValidator");

router.post("/buy", protect, buyTickets);
router.get("/my-orders", protect, getMyOrders);
router.get("/", protect, authorize("admin"), getAllOrdersAdmin);

module.exports = router;