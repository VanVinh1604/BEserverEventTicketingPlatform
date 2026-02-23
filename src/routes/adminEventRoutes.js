const express = require("express");
const router = express.Router();

const { protect, authorize } = require("../middleware/authMiddleware");
const {
  createEvent,
  getEvents,
  updateEvent,
  deleteEvent,
} = require("../controllers/adminEventController");

const upload = require("../middleware/uploadEventImage");

const { validate } = require("../middleware/validate");
const { idParamSchema } = require("../validators/commonValidator");
const { createEventSchema } = require("../validators/eventValidator");

const { eventQuerySchema } = require("../validators/eventQueryValidator");



// Áp RBAC cho toàn bộ route
router.use(protect, authorize("admin"));

router.post(
  "/",
  upload.single("image"),
  // validate(createEventSchema),   
  createEvent
);

router.get(
  "/",
  validate(eventQuerySchema, "query"),
  getEvents
);


router.put(
  "/:id",
  validate(idParamSchema, "params"),
  upload.single("image"),
  updateEvent
);

router.delete(
  "/:id",
  validate(idParamSchema, "params"),
  deleteEvent
);



module.exports = router;
