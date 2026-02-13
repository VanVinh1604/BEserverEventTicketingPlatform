const Joi = require("joi");

exports.buyTicketSchema = Joi.object({
  ticketTypeId: Joi.string().hex().length(24).required(),
  quantity: Joi.number().integer().min(1).max(10).required(),
});
