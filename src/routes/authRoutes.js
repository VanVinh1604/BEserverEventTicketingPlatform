const express = require("express");
const router = express.Router();
const { register, login } = require("../controllers/authController");
const {  forgotPassword,  resetPassword,} = require("../controllers/authController");

const { validate } = require("../middleware/validate");
const { tokenParamSchema } = require("../validators/commonValidator");
const { refreshToken } = require("../controllers/authController");

const { registerSchema, loginSchema } = require("../validators/authValidator");

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);


router.post("/refresh", refreshToken);

router.post("/forgot-password", forgotPassword);
router.post(
  "/reset-password/:token",
  validate(tokenParamSchema, "params"),
  resetPassword
);


module.exports = router;
