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

  // ✅ THÊM FIELD NÀY
  paymentCode: {
    type: Number,
    required: false,
    index: true,  // Tạo index để tìm kiếm nhanh
  },

  paymentMethod: {
    type: String,
    enum: ["credit_card", "bank_transfer", "e_wallet"],
    required: false,
  },

  customerInfo: {
    fullName: String,
    email: String,
    phone: String,
  },

}, { timestamps: true });

module.exports = mongoose.model("Order", orderSchema);