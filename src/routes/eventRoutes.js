const express = require("express");
const router = express.Router();
const APIFeatures = require("../middleware/apiFeatures");
const Event = require("../models/Event");

router.get("/", async (req, res, next) => {
  try {
    const features = new APIFeatures(
      Event.find(),
      req.query
    )
      .filter()
      .sort()
      .paginate();

    const events = await features.query;

    res.json({
      success: true,
      results: events.length,
      data: events,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
