const mongoose = require("mongoose");
const bcrypt = require("bcryptjs"); // Đảm bảo đã cài: npm install bcryptjs

const userSchema = new mongoose.Schema({
  // 1. Thông tin cơ bản
  username: {
    type: String,
    required: [true, "Vui lòng nhập tên người dùng"],
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: [true, "Vui lòng nhập email"],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      "Vui lòng nhập email hợp lệ"
    ]
  },
  password: {
    type: String,
    required: [true, "Vui lòng nhập mật khẩu"],
    minlength: 6,
    select: false // Không hiện password khi query
  },

  // 2. Phân quyền (RBAC)
  role: {
    type: String,
    enum: ["user", "admin", "staff"],
    default: "user"
  },

  // 3. Refresh Token
  refreshToken: {
    type: String
  },

  // 4. Quên mật khẩu
  resetPasswordToken: String,
  resetPasswordExpire: Date

}, {
  timestamps: true
});

// --- MIDDLEWARE & METHODS ---

// 1. Tự động mã hóa mật khẩu trước khi Lưu (ĐÃ FIX LỖI NEXT)
userSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// 2. Hàm so sánh mật khẩu
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);