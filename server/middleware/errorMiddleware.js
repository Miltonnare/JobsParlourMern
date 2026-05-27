const createHttpError = (statusCode, message, details) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (details !== undefined) error.details = details;
  return error;
};

const notFoundHandler = (req, res, next) => {
  next(createHttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

const errorHandler = (error, req, res, next) => {
  const statusCode = error.statusCode || 500;
  const payload = {
    message: error.message || 'Internal server error',
    requestId: req.requestId
  };

  if (error.details !== undefined) {
    payload.details = error.details;
  }

  if (statusCode >= 500) {
    console.error(JSON.stringify({
      level: 'error',
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode,
      message: error.message,
      stack: error.stack
    }));
  }

  res.status(statusCode).json(payload);
};

module.exports = {
  createHttpError,
  notFoundHandler,
  errorHandler
};
