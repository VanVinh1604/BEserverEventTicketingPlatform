const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Sự kiện phải có tiêu đề'],
    trim: true
  },
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
