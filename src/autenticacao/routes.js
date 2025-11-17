const { Router } = require("express");
const controller = require("./controller");

const router = Router();

router.post("/login", controller.login);
router.post("/logout", controller.logout);
router.post("/renew", controller.renewToken);

module.exports = router;
