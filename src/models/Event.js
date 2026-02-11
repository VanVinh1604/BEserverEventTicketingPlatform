const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  title: String,
  description: String,
  location: String,
  startDate: Date,
  endDate: Date,
  image: String,
  ticketTypes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TicketType",
    },
  ],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
}, { timestamps: true });

module.exports = mongoose.model("Event", eventSchema);
