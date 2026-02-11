const mongoose = require("mongoose");

const ticketTypeSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
  },
  name: String,
  price: Number,
  quantity: Number,
  remaining: Number,
  isActive: {
    type: Boolean,
    default: true,
  },
});

module.exports = mongoose.model("TicketType", ticketTypeSchema);
