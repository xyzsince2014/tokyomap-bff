const router = require("express").Router();

const authRouter = require("./authRouter");
const cognitoRouter = require("./cognitoRouter");
const paymentRouter = require("./paymentRouter");
const webhookRouter = require("./webhookRouter");
const errorRouter = require("./errorRouter");

module.exports = () => {
  router
    .use("/auth", authRouter())
    .use("/cognito", cognitoRouter())
    .use("/payments", paymentRouter())
    .use("/webhooks", webhookRouter())
    .use("/", errorRouter);

  return router;
};
