const mongoose = require("mongoose");

const checkinSchema = new mongoose.Schema({
  ticket: { type: mongoose.Schema.Types.ObjectId, ref: "Ticket" },
  checkinTime: Date,
});

module.exports = mongoose.model("Checkin", checkinSchema);
