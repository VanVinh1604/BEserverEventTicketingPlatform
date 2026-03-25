const express = require("express");
const router = express.Router();

const { protect, authorize } = require("../middleware/authMiddleware");
const {
  createEvent,
  getEvents,
  updateEvent,
  deleteEvent,
  cancelAndRefundEvent,
} = require("../controllers/adminEventController");

const upload = require("../middleware/uploadEventImage");


// Áp RBAC cho toàn bộ route
router.use(protect, authorize("admin"));

router.post(
  "/",
  upload.single("image"),
  createEvent
);

router.get("/", getEvents);
router.post("/:id/cancel-refund", cancelAndRefundEvent);
router.put("/:id", upload.single("image"), updateEvent);
router.delete("/:id", deleteEvent);

module.exports = router;
