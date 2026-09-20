const router = require("express").Router();

const paymentController = require("../controllers/paymentController");

/**
 * Collects the raw request body into a Buffer on req.body.
 *
 * express.raw() would do this, but it only exists from Express 4.17 (this project is on 4.16),
 * so we read the stream ourselves. The global JSON parser is skipped for /webhooks (see app.js),
 * so the stream is still intact here and the HMAC can be verified against the exact bytes.
 */
const rawBody = (req, res, next) => {
  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => {
    req.body = Buffer.concat(chunks);
    next();
  });
  req.on('error', next);
};

module.exports = () => {
  router.post("/paidy", rawBody, paymentController.webhook);

  return router;
};
