const AppError = require("../utils/AppError");

exports.checkInTicket = async (req, res, next) => {
  try {
    const { qrCode } = req.body;

    const ticket = await Ticket.findOne({ qrCode }).populate("event");

    if (!ticket) throw new AppError("Invalid QR Code", 404);

    if (ticket.isCheckedIn)
      throw new AppError("Ticket already used", 400);

    ticket.isCheckedIn = true;
    await ticket.save();

    res.json({
      message: "Check-in successful",
      event: ticket.event.title,
      ticketId: ticket._id,
    });
  } catch (err) {
    next(err);
  }
};
