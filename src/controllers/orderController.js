const { v4: uuidv4 } = require("uuid");
const TicketType = require("../models/TicketType");
const Order = require("../models/Order");
const Ticket = require("../models/Ticket");

exports.buyTickets = async (req, res) => {
  try {
    const userId = req.user.id;
    const { ticketTypeId, quantity } = req.body;

    // 🔥 B1 — Trừ vé an toàn (ANTI OVERSELL)
    const ticketType = await TicketType.findOneAndUpdate(
      {
        _id: ticketTypeId,
        remaining: { $gte: quantity },
      },
      {
        $inc: { remaining: -quantity },
      },
      { new: true }
    ).populate("event");

    if (!ticketType) {
      return res.status(400).json({ message: "Sold out" });
    }

    // 🔥 B2 — Tạo Order
    const order = await Order.create({
      user: userId,
      event: ticketType.event._id,
      totalAmount: ticketType.price * quantity,
      status: "paid",
    });

    // 🔥 B3 — Tạo N Ticket
    const tickets = [];

    for (let i = 0; i < quantity; i++) {
      const ticket = await Ticket.create({
        order: order._id,
        user: userId,
        event: ticketType.event._id,
        ticketType: ticketType._id,
        price: ticketType.price,
        qrCode: uuidv4(),
      });

      tickets.push(ticket._id);
    }

    // 🔥 B4 — Gắn ticket vào order
    order.tickets = tickets;
    await order.save();

    res.json({
      message: "Tickets purchased successfully",
      order,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id })
      .populate("event")
      .populate({
        path: "tickets",
        populate: {
          path: "ticketType",
        },
      });

    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

