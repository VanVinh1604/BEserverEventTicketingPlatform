const Joi = require("joi");

exports.eventQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  location: Joi.string().optional(),
});
