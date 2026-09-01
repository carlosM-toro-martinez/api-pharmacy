const express = require("express");
const {
  loginUser,
  logoutUser,
  changePassword,
  checkTokenStatus,
  getRegistrosLogin,
} = require("../services/servicesLogin");
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

router.post(
  "/logout",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    try {
      const response = await logoutUser(req);
      if (response.error) {
        return res.status(400).json({ error: response.error });
      }
      res.json({ message: "Sesión cerrada" });
    } catch (error) {
      console.error("Error en logout:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

router.put(
  "/change-password",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    try {
      const response = await changePassword(req);
      if (response.error) {
        return res.status(400).json({ error: response.error });
      }
      res.json({ message: "Contraseña actualizada correctamente" });
    } catch (error) {
      console.error("Error cambiando contraseña:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

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

router.get("/registro", async (req, res) => {
  try {
    const registros = await getRegistrosLogin(req.query);
    res.json(registros);
  } catch (error) {
    console.error("Error obteniendo registro de logins:", error);
    res.status(500).json({ error: "Internal Server Error" });
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
