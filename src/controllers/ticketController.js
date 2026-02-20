const Ticket = require("../models/Ticket");
const Checkin = require("../models/Checkin");
const AppError = require("../utils/AppError");

exports.checkInTicket = async (req, res, next) => {
  try {
    const { qrCode } = req.body;

    const ticket = await Ticket.findOne({ qrCode })
      .populate("event")
      .populate("user");

    if (!ticket) {
      return next(new AppError("Invalid QR Code", 404));
    }

    if (ticket.isCheckedIn) {
      return next(new AppError("Ticket already used", 400));
    }

    // 🔥 update ticket
    ticket.isCheckedIn = true;
    ticket.checkedInAt = new Date();
    await ticket.save();

    // 🔥 create checkin record
    await Checkin.create({
      ticket: ticket._id,
      event: ticket.event._id,
      user: ticket.user._id,
    });

    res.json({
      success: true,
      message: "Check-in successful",
      event: ticket.event.title,
      attendee: ticket.user.name,
      checkedInAt: ticket.checkedInAt,
    });

  } catch (err) {
    next(err);
  }
};
