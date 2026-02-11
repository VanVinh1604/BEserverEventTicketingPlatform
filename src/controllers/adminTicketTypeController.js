const TicketType = require("../models/TicketType");

exports.createTicketType = async (req, res) => {
  const { event, name, price, quantity } = req.body;

  const ticketType = await TicketType.create({
    event,
    name,
    price,
    quantity,
    remaining: quantity, // 🔥 QUAN TRỌNG
  });

  res.json(ticketType);
};

exports.getTicketTypes = async (req, res) => {
  const ticketTypes = await TicketType.find().populate("event");
  res.json(ticketTypes);
};

exports.updateTicketType = async (req, res) => {
  const ticketType = await TicketType.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );
  res.json(ticketType);
};

exports.deleteTicketType = async (req, res) => {
  await TicketType.findByIdAndDelete(req.params.id);
  res.json({ message: "TicketType deleted" });
};
