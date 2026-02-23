const Event = require("../models/Event");
const APIFeatures = require("../middleware/apiFeatures");

exports.getEvents = async (req, res, next) => {
  try {
    const features = new APIFeatures(
    Event.find().lean(),
      req.query
    )
      .filter()
      .sort()
      .paginate();

    const events = await features.query;

    res.status(200).json({
      success: true,
      results: events.length,
      data: events,
    });
  } catch (err) {
    next(err);
  }
};
