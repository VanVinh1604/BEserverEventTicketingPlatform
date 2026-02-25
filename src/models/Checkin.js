const mongoose = require("mongoose");


const checkinSchema = new mongoose.Schema(
  {
    // 🔥 Mỗi vé chỉ được check-in 1 lần
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ticket",
      required: true,
      unique: true
    },

    // Sự kiện của vé
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true
    },

    // Người sở hữu vé
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    // Thời điểm check-in
    checkInTime: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);


module.exports = mongoose.model("Checkin", checkinSchema);