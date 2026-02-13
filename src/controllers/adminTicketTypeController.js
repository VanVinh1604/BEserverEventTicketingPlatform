const TicketType = require("../models/TicketType");
const AppError = require("../utils/AppError");

exports.createTicketType = async (req, res, next) => {
  try {
    const { event, name, price, quantity } = req.body;

    if (!event || !name) {
      throw new AppError("Missing fields", 400);
    }

    const ticketType = await TicketType.create({
      event,
      name,
      price,
      quantity,
      remaining: quantity,
    });

    res.json(ticketType);
  } catch (err) {
    next(err);
  }
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
