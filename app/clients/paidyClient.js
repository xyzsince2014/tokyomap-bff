const fetch = require("node-fetch");

const config = require('../config');

/**
 * Client for the sudo-paidy PSP. All calls here use the SECRET key and run server-to-server;
 * the publishable key / tokenisation happen in the browser (paidy.js), never here.
 */

/**
 * Creates a payment against a browser-issued token. The PSP returns 202 immediately and
 * authorises asynchronously, notifying us later via webhook.
 *
 * @param {{token: string, amount: number, idempotencyKey: string}} params
 * @returns the PSP payment { paymentId, merchantId, amount, status, ... }
 */
const createPayment = async ({token, amount, idempotencyKey}) => {
  const response = await fetch(config.paidy.paymentsEndpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.paidy.secretKey}`,
      'Idempotency-Key': idempotencyKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({token, amount}),
    timeout: 10000,
  });

  const data = await response.json();
  if (!response.ok) {
    throw pspError('createPayment', response.status, data);
  }
  return data;
};

/**
 * Captures an authorised payment (full, or partial when `amount` is given).
 *
 * @param {string} paymentId
 * @param {number|null} amount optional partial amount
 * @returns the updated PSP payment
 */
const capturePayment = async (paymentId, amount = null) => {
  const response = await fetch(`${config.paidy.paymentsEndpoint}/${paymentId}/capture`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.paidy.secretKey}`,
      ...(amount != null ? {'Content-Type': 'application/json'} : {}),
    },
    body: amount != null ? JSON.stringify({amount}) : undefined,
    timeout: 10000,
  });

  const data = await response.json();
  if (!response.ok) {
    throw pspError('capturePayment', response.status, data);
  }
  return data;
};

/**
 * Voids an authorised, not-yet-captured payment.
 *
 * @param {string} paymentId
 * @returns the updated PSP payment
 */
const voidPayment = async (paymentId) => {
  const response = await fetch(`${config.paidy.paymentsEndpoint}/${paymentId}/void`, {
    method: 'POST',
    headers: {'Authorization': `Bearer ${config.paidy.secretKey}`},
    timeout: 10000,
  });

  const data = await response.json();
  if (!response.ok) {
    throw pspError('voidPayment', response.status, data);
  }
  return data;
};

const pspError = (op, status, body) => {
  const err = new Error(`PSP ${op} failed with status ${status}`);
  err.status = status;
  err.body = body;
  return err;
};

module.exports = {
  createPayment,
  capturePayment,
  voidPayment,
};
