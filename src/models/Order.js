const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  event: { type: mongoose.Schema.Types.ObjectId, ref: "Event" }, // 🔥 rất quan trọng

  totalAmount: Number,

  tickets: [{ type: mongoose.Schema.Types.ObjectId, ref: "Ticket" }],

  status: {
    type: String,
    enum: ["pending", "paid"],
    default: "paid",
  },
}, { timestamps: true });

module.exports = mongoose.model("Order", orderSchema);
