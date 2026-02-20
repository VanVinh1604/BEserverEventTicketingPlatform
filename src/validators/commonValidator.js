const Joi = require("joi");

exports.idParamSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

exports.tokenParamSchema = Joi.object({
  token: Joi.string().required(),
});
