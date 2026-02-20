const Joi = require("joi");

// 🔥 Middleware generic
exports.validate = (schema, property = "body") => (req, res, next) => {
  const { error } = schema.validate(req[property], { abortEarly: false });

  if (error) {
    const errors = error.details.map(detail => detail.message);
    return res.status(400).json({
      status: "fail",
      message: errors
    });
  }

  next();
};

// ================== SCHEMAS ==================

exports.registerSchema = Joi.object({
  username: Joi.string().min(3).required().messages({
    "string.min": "Tên đăng nhập phải có ít nhất 3 ký tự",
    "any.required": "Vui lòng nhập tên đăng nhập"
  }),
  email: Joi.string().email().required().messages({
    "string.email": "Email không hợp lệ",
    "any.required": "Vui lòng nhập email"
  }),
  password: Joi.string().min(6).required().messages({
    "string.min": "Mật khẩu phải có ít nhất 6 ký tự",
    "any.required": "Vui lòng nhập mật khẩu"
  }),
});

exports.loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Email không hợp lệ",
    "any.required": "Vui lòng nhập email"
  }),
  password: Joi.string().required().messages({
    "any.required": "Vui lòng nhập mật khẩu"
  })
});
