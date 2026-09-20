const router = require("express").Router();
const paymentController = require("../controllers/paymentController");

module.exports = () => {
  router
    .get("/config", paymentController.getConfig)
    .post("/", paymentController.createOrder)
    .get("/:paymentId", paymentController.getOrder)
    .post("/:paymentId/capture", paymentController.capture)
    .post("/:paymentId/void", paymentController.voidOrder);

  return router;
};
