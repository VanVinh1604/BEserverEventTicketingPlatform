const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  event: { type: mongoose.Schema.Types.ObjectId, ref: "Event" },

  totalAmount: Number,

  tickets: [{ type: mongoose.Schema.Types.ObjectId, ref: "Ticket" }],

  status: {
    type: String,
    enum: ["pending", "paid", "cancelled", "refunded"],
    default: "pending",
  },

  paymentCode: {
    type: Number,
    required: false,
    index: true,
  },

  paymentMethod: {
    type: String,
    enum: ["credit_card", "bank_transfer", "e_wallet"],
    required: false,
  },

  paymentInitiatedAt: {
    type: Date,
    required: false,
  },

  paymentCancelledAt: {
    type: Date,
    required: false,
  },

  customerInfo: {
    fullName: String,
    email: String,
    phone: String,
  },

  // ✅ Lưu thông tin vé chờ tạo sau khi thanh toán xong
  pendingItems: [
    {
      ticketTypeId: { type: mongoose.Schema.Types.ObjectId, ref: "TicketType" },
      quantity: Number,
    }
  ],

  cancelReason: {
    type: String,
    required: false,
  },

}, { timestamps: true });

module.exports = mongoose.model("Order", orderSchema);
