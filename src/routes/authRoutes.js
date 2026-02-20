const express = require("express");
const router = express.Router();

// 1. Import Controller (Gộp lại cho gọn)
const { 
  register, 
  login, 
  refreshToken, 
  forgotPassword, 
  resetPassword 
} = require("../controllers/authController");

// 2. Import Validation Middleware (Cái khiên bảo vệ)
const { 
  validateRequest, 
  registerSchema, 
  loginSchema 
} = require("../middleware/validate"); // Nhớ check đúng đường dẫn file này

// --- ĐỊNH NGHĨA ROUTE ---

// Đăng ký: Có check dữ liệu đầu vào (registerSchema)
router.post("/register", validateRequest(registerSchema), register);

// Đăng nhập: Có check dữ liệu đầu vào (loginSchema)
router.post("/login", validateRequest(loginSchema), login);

// Refresh Token: Không cần validate phức tạp, chỉ cần check token tồn tại trong controller
router.post("/refresh", refreshToken);

// Quên mật khẩu
router.post("/forgot-password", forgotPassword);

// Đặt lại mật khẩu (Token nằm trên URL)
router.post("/reset-password/:token", resetPassword);

module.exports = router;