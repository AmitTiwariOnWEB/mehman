export const notFound = (req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` });
};

export const errorHandler = (err, req, res, next) => {
  const isPrismaError =
    err?.name === "PrismaClientInitializationError" ||
    err?.name === "PrismaClientKnownRequestError" ||
    err?.name === "PrismaClientUnknownRequestError" ||
    err?.name === "PrismaClientRustPanicError";
  const status = err.statusCode || (isPrismaError ? 503 : 500);
  const payload = {
    message:
      status === 500
        ? "Internal server error"
        : isPrismaError
          ? "Database is unavailable or schema is out of sync"
          : err.message
  };

  console.error("Request failed", {
    method: req.method,
    path: req.originalUrl || req.path,
    status,
    name: err?.name,
    code: err?.code,
    message: err?.message
  });

  if (process.env.NODE_ENV !== "production") {
    payload.stack = err.stack;
  }

  res.status(status).json(payload);
};
