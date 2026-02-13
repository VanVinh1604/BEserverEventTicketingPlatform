const Joi = require("joi");

exports.createTicketTypeSchema = Joi.object({
  event: Joi.string().hex().length(24).required(),
  name: Joi.string().min(3).max(30).required(),
  price: Joi.number().min(0).required(),
  quantity: Joi.number().integer().min(1).required(),
});
