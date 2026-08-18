// services/authService.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const {
  Administrador,
  Trabajador,
  Rol,
  Permiso,
  RolPermiso,
  Sucursal,
} = require("../models");
const SucursalService = require("./servicesSucursal");

const jwtSecret = process.env.JWT_SECRET || "your_jwt_secret";
const saltRounds = 10;
const sucursalService = new SucursalService();

const generateToken = (user, tipo, sucursal = null) => {
  const payload = {
    id: user.id_trabajador || user.id_administrador,
    tipo,
    id_sucursal: sucursal?.id_sucursal || null,
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
          {
            model: Sucursal,
            as: "sucursal",
            attributes: ["id_sucursal", "nombre", "dominio", "es_principal"],
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

    const sucursal = await sucursalService.resolverSucursalSesion({
      req,
      trabajador: tipo === "trabajador" ? user : null,
    });

    const token = generateToken(user, tipo, sucursal);

    return {
      token,
      user,
      sucursal,
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
