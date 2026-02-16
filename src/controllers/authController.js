const User = require("../models/User");
const bcrypt = require("bcryptjs");
const { generateAccessToken, generateRefreshToken } = require("../config/jwt");
const AppError = require("../utils/AppError");


// Register
exports.register = async (req, res, next) => {
  try {
    const { name, email, password,role } = req.body;

    const exist = await User.findOne({ email });
    if (exist) throw new AppError("Email already exists", 400);

    const hashed = await bcrypt.hash(password, 10);

    await User.create({ name, email, password: hashed ,  role: role || "user", });

    res.status(201).json({ message: "User registered" });
  } catch (err) {
    next(err);
  }
};



// Login
// Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.json({
      accessToken,
      refreshToken,
      role: user.role,
      name: user.name,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken)
    return res.status(401).json({ message: "No refresh token" });

  try {
    const decoded = require("jsonwebtoken").verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET
    );

    const user = await User.findById(decoded.id);
    if (!user)
      return res.status(404).json({ message: "User not found" });

    const newAccessToken = generateAccessToken(user);

    res.json({ accessToken: newAccessToken });

  } catch {
    res.status(403).json({ message: "Invalid refresh token" });
  }
};

//forget password password
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user)
    return res.status(404).json({ message: "User not found" });

  const resetToken = require("jsonwebtoken").sign(
    { id: user._id },
    process.env.JWT_SECRET,
    { expiresIn: "10m" }
  );

  user.resetToken = resetToken;
  user.resetTokenExpire = Date.now() + 10 * 60 * 1000;

  await user.save();

  res.json({
    message: "Reset token generated",
    resetToken, // để test, thực tế sẽ gửi email
  });
};

//Reset password 
exports.resetPassword = async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  try {
    const decoded = require("jsonwebtoken").verify(
      token,
      process.env.JWT_SECRET
    );

    const user = await User.findById(decoded.id);

    const hashed = await bcrypt.hash(newPassword, 10);

    user.password = hashed;
    user.resetToken = null;
    user.resetTokenExpire = null;

    await user.save();

    res.json({ message: "Password reset successful" });

  } catch {
    res.status(400).json({ message: "Invalid or expired token" });
  }
};
