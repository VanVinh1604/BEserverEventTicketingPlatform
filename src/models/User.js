const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: {
    type: String,
    enum: ["user", "admin", "staff"],
    default: "user",
    lowercase: true,   // ⭐ QUAN TRỌNG
    trim: true
  },
  resetToken: String,
  resetTokenExpire: Date,

});

module.exports = mongoose.model("User", userSchema);
