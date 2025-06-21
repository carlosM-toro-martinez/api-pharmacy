// services/authService.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const {
  Administrador,
  Trabajador,
  Rol,
  Permiso,
  RolPermiso,
} = require("../models");

const jwtSecret = process.env.JWT_SECRET || "your_jwt_secret";
const saltRounds = 10;

const generateToken = (user, tipo) => {
  const payload = {
    id: user.id_trabajador || user.id_administrador,
    tipo,
  };
  return jwt.sign(payload, jwtSecret, { expiresIn: "8h" });
};

const loginUser = async (req, res) => {
  const { username, password, tipo } = req.body;

  try {
    let user;

    if (tipo === "trabajador") {
      user = await Trabajador.findOne({
        where: { username },
        include: [
          {
            model: Rol,
            as: "rol",
            include: [
              {
                model: Permiso,
                as: "permisos",
                through: {
                  attributes: [],
                },
              },
            ],
          },
        ],
      });
    } else if (tipo === "administrador") {
      user = await Administrador.findOne({ where: { username } });
    } else {
      return { error: "Tipo inválido" };
    }

    if (!user) {
      return { error: "Usuario no encontrado" };
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return { error: "Contraseña incorrecta" };
    }

    const token = generateToken(user, tipo);

    return {
      token,
      user,
    };
  } catch (error) {
    return { error: error.message };
  }
};

const checkTokenStatus = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return { error: "No token provided" };
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    return { error: "Malformed token header" };
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    const now = Math.floor(Date.now() / 1000);
    const remainingSeconds = decoded.exp - now;

    if (remainingSeconds > 0) {
      return { remainingSeconds };
    } else {
      return { remainingSeconds };
    }
  } catch (err) {
    return {
      remainingSeconds: 0,
    };
  }
};

module.exports = {
  loginUser,
  checkTokenStatus,
};
