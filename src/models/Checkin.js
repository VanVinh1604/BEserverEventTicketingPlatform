const mongoose = require("mongoose");

const checkinSchema = new mongoose.Schema({
  // Liên kết tới vé cụ thể (để biết vé nào đã vào cổng)
  ticket: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Ticket", 
    required: true 
  },
  
  // Liên kết tới sự kiện (quan trọng để Admin lọc dữ liệu theo sự kiện)
  event: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Event", 
    required: true 
  },
  
  // Liên kết tới người dùng (người sở hữu vé)
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User" 
  },
  
  // Thời gian check-in (tự động lấy giờ hệ thống nếu không truyền vào)
  checkInTime: { 
    type: Date, 
    default: Date.now 
  }
}, { 
  // Tự động tạo trường createdAt và updatedAt
  timestamps: true 
});

module.exports = mongoose.model("Checkin", checkinSchema);