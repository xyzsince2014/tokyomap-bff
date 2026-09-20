const statusCodes = require("http-status-codes");

const paymentService = require('../services/paymentService');
const config = require('../config');

/**
 * Hands the browser what it needs to bootstrap paidy.js: the PSP script URL and the
 * PUBLISHABLE key. The secret key never leaves the BFF.
 *
 * @param {*} req
 * @param {*} res
 */
const getConfig = (req, res) => {
  res.status(statusCodes.OK).json({
    paidyJsUrl: config.paidy.jsUrl,
    publishableKey: config.paidy.publishableKey,
  });
};

/**
 * Creates a payment from a browser-issued token. Returns 202 — authorisation is asynchronous
 * and its outcome arrives later via webhook (poll GET /payments/:paymentId for it).
 *
 * @param {*} req
 * @param {*} res
 */
const createOrder = async (req, res) => {
  try {
    const {token, amount} = req.body || {};
    if (!token || !Number.isInteger(amount) || amount <= 0) {
      return res.status(statusCodes.BAD_REQUEST).json({message: 'token and a positive integer amount are required'});
    }

    const order = await paymentService.createOrder({token, amount});
    res.status(statusCodes.ACCEPTED).json(order);

  } catch (e) {
    respondPspError(res, e, 'createOrder');
  }
};

/**
 * The merchant's current view of a payment (status kept current by the webhook).
 *
 * @param {*} req
 * @param {*} res
 */
const getOrder = (req, res) => {
  const order = paymentService.getOrder(req.params.paymentId);
  if (!order) {
    return res.status(statusCodes.NOT_FOUND).json({message: 'unknown payment'});
  }
  res.status(statusCodes.OK).json(order);
};

/**
 * Captures an authorised payment (full, or partial with a body {amount}).
 *
 * @param {*} req
 * @param {*} res
 */
const capture = async (req, res) => {
  try {
    const amount = req.body && req.body.amount != null ? req.body.amount : null;
    const order = await paymentService.capture(req.params.paymentId, amount);
    res.status(statusCodes.OK).json(order);

  } catch (e) {
    respondPspError(res, e, 'capture');
  }
};

/**
 * Voids an uncaptured authorisation.
 *
 * @param {*} req
 * @param {*} res
 */
const voidOrder = async (req, res) => {
  try {
    const order = await paymentService.voidOrder(req.params.paymentId);
    res.status(statusCodes.OK).json(order);

  } catch (e) {
    respondPspError(res, e, 'void');
  }
};

/**
 * Receives PSP webhooks. Mounted with a RAW body parser so the HMAC is verified against the
 * exact bytes the PSP signed.
 *
 * @param {*} req req.body is a Buffer (raw)
 * @param {*} res
 */
const webhook = (req, res) => {
  const signature = req.get('Paidy-Signature');
  const result = paymentService.handleWebhook(req.body, signature);
  if (!result.ok) {
    console.warn(`[Paidy Webhook rejected] ${result.reason}`);
    return res.status(statusCodes.BAD_REQUEST).json({message: result.reason});
  }
  res.status(statusCodes.OK).json({received: true});
};

const respondPspError = (res, e, op) => {
  console.error(`[Payment ${op} Error] ${e.message}`, e.body || '');
  const status = e.status || statusCodes.INTERNAL_SERVER_ERROR;
  res.status(status).json(e.body || {message: 'payment error'});
};

module.exports = {
  getConfig,
  createOrder,
  getOrder,
  capture,
  voidOrder,
  webhook,
};
