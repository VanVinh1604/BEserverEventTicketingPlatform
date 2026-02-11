const Event = require("../models/Event");
const TicketType = require("../models/TicketType");

// ✅ CREATE EVENT
exports.createEvent = async (req, res) => {
  try {
    const event = await Event.create({
      ...req.body,
      createdBy: req.user.id,
    });

    res.status(201).json(event);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✅ CREATE TICKET TYPE
exports.createTicketType = async (req, res) => {
  try {
    const { event, name, price, quantity } = req.body;

    const ticketType = await TicketType.create({
      event,
      name,
      price,
      quantity,
    });

    await Event.findByIdAndUpdate(event, {
      $push: { ticketTypes: ticketType._id },
    });

    res.status(201).json(ticketType);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✅ GET ALL EVENTS (admin)
exports.getEvents = async (req, res) => {
  const events = await Event.find().populate("ticketTypes");
  res.json(events);
};

// ✅ UPDATE EVENT
exports.updateEvent = async (req, res) => {
  const event = await Event.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  res.json(event);
};

// ✅ DELETE EVENT
exports.deleteEvent = async (req, res) => {
  await Event.findByIdAndDelete(req.params.id);
  res.json({ message: "Event deleted" });
};
