const Joi = require("joi");

exports.createEventSchema = Joi.object({
  title: Joi.string().min(5).required(),
  description: Joi.string().min(10).required(),
  location: Joi.string().required(),
  image: Joi.string().required(),
});
