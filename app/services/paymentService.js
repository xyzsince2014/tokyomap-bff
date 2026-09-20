const crypto = require('crypto');
const randomstring = require('randomstring');

const paidyClient = require('../clients/paidyClient');
const config = require('../config');

/*
 * The merchant's own view of an order/payment.
 *
 * NOTE: kept in an in-memory Map for this learning integration. A real merchant would persist
 * this in postgres (see daos/) — the shape here mirrors what such a table would hold.
 */
const orders = new Map(); // paymentId -> order

const buildOrder = (payment) => ({
  paymentId: payment.paymentId,
  amount: payment.amount,
  status: payment.status, // pending_authorisation -> authorised/declined -> captured/voided
  capturedAmount: payment.capturedAmount ?? null,
  updatedAt: new Date().toISOString(),
});

/**
 * Creates a payment at the PSP for a browser-issued token and records the pending order.
 * The PSP authorises asynchronously; the final status arrives later via webhook.
 *
 * @param {{token: string, amount: number}} params
 * @returns the recorded order
 */
const createOrder = async ({token, amount}) => {
  // one idempotency key per order attempt, so a retry never double-charges
  const idempotencyKey = `idk-${Date.now()}-${randomstring.generate(12)}`;

  const payment = await paidyClient.createPayment({token, amount, idempotencyKey});

  const order = buildOrder(payment);
  orders.set(order.paymentId, order);
  return order;
};

/**
 * The merchant's current view of a payment (updated by the webhook).
 *
 * @param {string} paymentId
 * @returns the order, or null if unknown
 */
const getOrder = (paymentId) => orders.get(paymentId) || null;

/**
 * Captures an authorised payment (full, or partial with `amount`) and updates the order.
 */
const capture = async (paymentId, amount = null) => {
  const payment = await paidyClient.capturePayment(paymentId, amount);
  const order = buildOrder(payment);
  orders.set(paymentId, order);
  return order;
};

/**
 * Voids an uncaptured authorisation and updates the order.
 */
const voidOrder = async (paymentId) => {
  const payment = await paidyClient.voidPayment(paymentId);
  const order = buildOrder(payment);
  orders.set(paymentId, order);
  return order;
};

/**
 * Verifies and applies an inbound PSP webhook.
 *
 * The PSP signs the RAW body with our merchant signing secret (HMAC-SHA256, lowercase hex) and
 * sends it in the `Paidy-Signature` header. We must HMAC the exact bytes we received — hence the
 * route hands us the raw Buffer, not the parsed JSON.
 *
 * @param {Buffer} rawBody the exact request body bytes
 * @param {string} signatureHeader the value of the Paidy-Signature header
 * @returns {{ok: boolean, reason?: string}}
 */
const handleWebhook = (rawBody, signatureHeader) => {
  if (!signatureHeader) {
    return {ok: false, reason: 'missing signature'};
  }

  const expected = crypto
    .createHmac('sha256', config.paidy.webhookSigningSecret)
    .update(rawBody)
    .digest('hex');

  if (!timingSafeEqualHex(signatureHeader, expected)) {
    return {ok: false, reason: 'bad signature'};
  }

  const event = JSON.parse(rawBody.toString('utf8')); // { eventType, paymentId, status }

  // idempotent: reflect the authoritative status the PSP reported
  const order = orders.get(event.paymentId);
  if (order) {
    order.status = event.status;
    order.updatedAt = new Date().toISOString();
  }
  // an unknown paymentId is not an error (the create response may not have been recorded yet)

  return {ok: true};
};

const timingSafeEqualHex = (a, b) => {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
};

module.exports = {
  createOrder,
  getOrder,
  capture,
  voidOrder,
  handleWebhook,
};
