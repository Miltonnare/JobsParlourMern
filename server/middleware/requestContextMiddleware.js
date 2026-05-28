const crypto = require('crypto');

const assignRequestContext = (req, res, next) => {
  req.requestId = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
};

const requestLogger = (req, res, next) => {
  const startedAt = Date.now();

  res.on('finish', () => {
    const logPayload = {
      level: 'info',
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt
    };

    if (res.locals?.responseMessage) {
      logPayload.message = res.locals.responseMessage;
    }

    if (res.locals?.responseDetails !== undefined) {
      logPayload.details = res.locals.responseDetails;
    }

    console.log(JSON.stringify(logPayload));
  });

  next();
};

module.exports = {
  assignRequestContext,
  requestLogger
};
