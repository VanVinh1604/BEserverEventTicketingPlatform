const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");

router.get("/admin-only", protect, authorize("admin"), (req, res) => {
  res.json({ message: "Welcome Admin" });
});

router.get("/user-only", protect, authorize("user"), (req, res) => {
  res.json({ message: "Welcome User" });
});

module.exports = router;
