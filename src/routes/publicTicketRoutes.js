const express = require("express");
const router = express.Router();
const { getTicketTypes } = require("../controllers/adminTicketTypeController");
const { checkInTicket } = require("../controllers/ticketController"); // Import hàm xử lý check-in
const { protect, authorize } = require("../middleware/authMiddleware");

// Lấy danh sách loại vé (Công khai)
router.get("/", getTicketTypes);

// Cổng xác minh vé (Chỉ dành cho Admin)
// Đây là đường dẫn mà trang AdminCheckIn.jsx đang gọi tới (POST /api/tickets/check-in)
router.post("/check-in", protect, authorize("admin"), checkInTicket);

module.exports = router;