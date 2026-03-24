const express = require("express");
const router = express.Router();
const {
  buyTickets,
  getMyOrders,
  getAllOrdersAdmin,
  cancelPendingOrder,
} = require("../controllers/orderController");
const { protect, authorize } = require("../middleware/authMiddleware");
const { validate } = require("../middleware/validate");
const { buyTicketSchema } = require("../validators/orderValidator");

router.post("/buy", protect, buyTickets);
router.post("/cancel", protect, cancelPendingOrder);
router.post("/:orderId/cancel", protect, cancelPendingOrder);
router.get("/my-orders", protect, getMyOrders);
router.get("/", protect, authorize("admin"), getAllOrdersAdmin);

module.exports = router;
