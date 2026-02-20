const User = require("../models/User");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
// Đảm bảo đường dẫn này đúng với máy bạn (file tạo token)
const { generateAccessToken, generateRefreshToken } = require("../config/jwt");

// --- 1. ĐĂNG KÝ (REGISTER) ---
exports.register = async (req, res) => {
  // [DEBUG] Log xem dữ liệu Frontend gửi lên là gì
  console.log("👉 [REGISTER START] Body:", req.body);

  try {
    const { username, email, password } = req.body;

    // 1. Kiểm tra xem user có tồn tại chưa
    const exists = await User.findOne({ email });
    if (exists) {
      console.log("❌ [REGISTER ERROR] Email đã tồn tại:", email);
      return res.status(400).json({ message: "Email đã tồn tại" });
    }

    console.log("✅ [REGISTER] Email hợp lệ. Đang tạo User...");

    // 2. Tạo User mới (Mongoose tự mã hóa password)
    const newUser = await User.create({ username, email, password });

    console.log("✅ [REGISTER] User đã tạo xong ID:", newUser._id);

    // 3. Tạo Token
    const accessToken = generateAccessToken(newUser);
    const refreshToken = generateRefreshToken(newUser);

    // 4. Lưu Refresh Token vào DB
    newUser.refreshToken = refreshToken;
    await newUser.save({ validateBeforeSave: false });

    console.log("✅ [REGISTER] Đã lưu Token. Gửi phản hồi...");

    // 5. Trả về kết quả
    newUser.password = undefined; // Ẩn mật khẩu

    res.status(201).json({
      status: "success",
      message: "Đăng ký thành công!",
      accessToken,
      refreshToken,
      data: { user: newUser },
    });

  } catch (err) {
    console.error("🔥 [REGISTER EXCEPTION]:", err); // In lỗi chi tiết ra
    // Xử lý lỗi trùng lặp (E11000)
    if (err.code === 11000) {
        return res.status(400).json({ message: "Tên đăng nhập hoặc Email đã tồn tại" });
    }
    res.status(500).json({ message: err.message });
  }
};

// --- 2. ĐĂNG NHẬP (LOGIN) ---
exports.login = async (req, res) => {
  // [DEBUG] Log dữ liệu đăng nhập
  console.log("👉 [LOGIN START] Body:", req.body);

  try {
    const { email, password } = req.body;

    // 1. Tìm user (lấy cả password đã mã hóa)
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      console.log("❌ [LOGIN ERROR] Không tìm thấy Email:", email);
      return res.status(401).json({ message: "Email hoặc mật khẩu không đúng" });
    }

    // 2. So khớp mật khẩu
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      console.log("❌ [LOGIN ERROR] Sai mật khẩu cho:", email);
      return res.status(401).json({ message: "Email hoặc mật khẩu không đúng" });
    }

    console.log("✅ [LOGIN] Mật khẩu đúng. Đang tạo Token...");

    // 3. Tạo Token mới
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // 4. Lưu Refresh Token mới
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    // 5. Trả về
    user.password = undefined;
    
    res.json({
      status: "success",
      accessToken,
      refreshToken,
      data: {
        user: {
            _id: user._id,
            username: user.username,
            email: user.email,
            role: user.role
        }
      },
    });

  } catch (err) {
    console.error("🔥 [LOGIN EXCEPTION]:", err);
    res.status(500).json({ message: err.message });
  }
};

// --- 3. REFRESH TOKEN ---
exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ message: "Chưa gửi Refresh Token" });

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    
    // Check token khớp DB không
    if (!user || user.refreshToken !== refreshToken) {
       return res.status(403).json({ message: "Token không hợp lệ!" });
    }

    const newAccessToken = generateAccessToken(user);
    res.json({ accessToken: newAccessToken });
  } catch (err) {
    res.status(403).json({ message: "Token hết hạn hoặc lỗi" });
  }
};

// --- 4. QUÊN MẬT KHẨU ---
exports.forgotPassword = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(404).json({ message: "Email không tồn tại" });

    // Tạo token ngẫu nhiên
    const resetToken = crypto.randomBytes(20).toString("hex");
    
    // Hash token lưu DB
    user.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 phút

    await user.save({ validateBeforeSave: false });

    // Trả token về (Môi trường dev)
    res.status(200).json({
      status: "success",
      message: "Token reset đã được gửi",
      resetToken: resetToken 
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// --- 5. ĐẶT LẠI MẬT KHẨU ---
exports.resetPassword = async (req, res) => {
  try {
    const hashedToken = crypto.createHash("sha256").update(req.params.token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) return res.status(400).json({ message: "Token không hợp lệ hoặc hết hạn" });

    // Lưu ý: Frontend cần gửi field là newPassword
    user.password = req.body.newPassword; 
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    res.status(200).json({ status: "success", message: "Đổi mật khẩu thành công!" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};