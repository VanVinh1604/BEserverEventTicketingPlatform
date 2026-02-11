const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },

  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // 🔥 cực quan trọng

  event: { type: mongoose.Schema.Types.ObjectId, ref: "Event" }, // 🔥 để check-in

  ticketType: { type: mongoose.Schema.Types.ObjectId, ref: "TicketType" },

  price: Number, // 🔥 giá tại thời điểm mua

  qrCode: {
    type: String,
    unique: true,
  },

  isCheckedIn: {
    type: Boolean,
    default: false,
  },

  checkedInAt: Date, // 🔥 thời điểm checkin
}, { timestamps: true });

module.exports = mongoose.model("Ticket", ticketSchema);
