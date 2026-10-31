export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse({
    body: req.body,
    params: req.params,
    query: req.query
  });

  if (!result.success) {
    return res.status(422).json({
      message: "Validation failed",
      issues: result.error.flatten()
    });
  }

  req.validated = result.data;
  next();
};
