const Joi = require("joi");

exports.checkInSchema = Joi.object({
  qrCode: Joi.string().required(),
});
