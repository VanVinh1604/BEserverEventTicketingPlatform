const express = require("express");
const router = express.Router();

// Controllers
const {
  register,
  login,
  refreshToken,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");

// Validation middleware + schemas
const {
  validate,
  registerSchema,
  loginSchema,
} = require("../middleware/validate");

const { tokenParamSchema } = require("../validators/commonValidator");


// ===============================
// AUTH ROUTES
// ===============================

// Register
router.post("/register", validate(registerSchema), register);

// Login
router.post("/login", validate(loginSchema), login);

// Refresh token
router.post("/refresh", refreshToken);

// Forgot password
router.post("/forgot-password", forgotPassword);

// Reset password
router.post(
  "/reset-password/:token",
  validate(tokenParamSchema, "params"),
  resetPassword
);

module.exports = router;
