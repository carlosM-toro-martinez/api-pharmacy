const express = require("express");
const { loginUser, checkTokenStatus } = require("../services/servicesLogin");
const passport = require("passport");

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const response = await loginUser(req, res);

    if (response.error) {
      return res.status(400).json({ error: response.error });
    }
    res.json(response);
  } catch (error) {
    console.error("Error en el login:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/token-status", async (req, res) => {
  try {
    const response = await checkTokenStatus(req, res);

    if (response.error) {
      return res.status(401).json({ error: response.error });
    }

    return res.json({ remainingSeconds: response.remainingSeconds });
  } catch (error) {
    console.error("Error en token-status:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get(
  "/profile",
  passport.authenticate("jwt", { session: false }),
  (req, res) => {
    res.json({ message: "Acceso permitido", user: req.user });
  }
);

module.exports = router;
