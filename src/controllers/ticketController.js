const Ticket = require("../models/Ticket");

exports.checkInTicket = async (req, res) => {
  try {
    const { qrCode } = req.body;

    const ticket = await Ticket.findOne({ qrCode }).populate("event");

    if (!ticket) {
      return res.status(404).json({ message: "Invalid QR Code" });
    }

    if (ticket.isCheckedIn) {
      return res.status(400).json({ message: "Ticket already used" });
    }

    ticket.isCheckedIn = true;
    await ticket.save();

    res.json({
      message: "Check-in successful",
      event: ticket.event.title,
      ticketId: ticket._id,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
