const express = require("express");
const router = express.Router();

// Tận dụng lại hàm getEvents đã có sẵn của Admin, không cần code lại logic
const { getEvents } = require("../controllers/adminEventController");

// Mở cửa tự do cho tất cả mọi người (Không gắn middleware bảo vệ)
router.get("/", getEvents);

module.exports = router;