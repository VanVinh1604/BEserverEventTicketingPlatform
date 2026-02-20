exports.validate = (schema, property = "body") => (req, res, next) => {
  const { error } = schema.validate(req[property]);

  if (error) {
    return res.status(400).json({
      message: error.details[0].message,
    });
  }

  next();
};
