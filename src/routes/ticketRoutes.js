const express = require("express");
const router = express.Router();
const { checkInTicket } = require("../controllers/ticketController");
const { protect, authorize } = require("../middleware/authMiddleware");

const { validate } = require("../middleware/validate");
const { checkInSchema } = require("../validators/ticketValidator");

router.post("/check-in", protect, authorize("admin"),
    validate(checkInSchema), 
    checkInTicket
);

module.exports = router;
