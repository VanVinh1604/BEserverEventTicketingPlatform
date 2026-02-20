const Joi = require('joi'); 

const registerSchema = Joi.object({
    username: Joi.string().min(3).required().messages({
        'string.min': 'Tên đăng nhập phải có ít nhất 3 ký tự',
        'any.required': 'Vui lòng nhập tên đăng nhập'
    }),
    email: Joi.string().email().required().messages({
        'string.email': 'Email không hợp lệ',
        'any.required': 'Vui lòng nhập email'
    }),
    password: Joi.string().min(6).required().messages({
        'string.min': 'Mật khẩu phải có ít nhất 6 ký tự',
        'any.required': 'Vui lòng nhập mật khẩu'
    }),
    // ⚠️ QUAN TRỌNG: Tạm thời comment dòng này lại để tránh user tự đăng ký làm admin
    // role: Joi.string().valid('user', 'admin', 'staff') 
});

const loginSchema = Joi.object({
    email: Joi.string().email().required().messages({
        'string.email': 'Email không hợp lệ',
        'any.required': 'Vui lòng nhập email'
    }),
    password: Joi.string().required().messages({
        'any.required': 'Vui lòng nhập mật khẩu'
    })
});

// Middleware check lỗi
const validateRequest = (schema) => (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false }); // abortEarly: false để hiện tất cả lỗi cùng lúc
    if (error) {
        // Lấy danh sách lỗi cho đẹp
        const errors = error.details.map(detail => detail.message);
        return res.status(400).json({
            status: 'fail',
            message: errors // Trả về mảng lỗi
        });
    }
    next();
};

module.exports = { validateRequest, registerSchema, loginSchema };