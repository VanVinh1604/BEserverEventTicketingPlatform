const User = require("../models/User");
const bcrypt = require("bcryptjs");
const generateToken = require("../config/jwt");
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
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    const token = generateToken(user);

    res.json({
      token,
      role: user.role,
      name: user.name,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
