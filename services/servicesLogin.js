// services/authService.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const { DateTime } = require("luxon");
const {
  Administrador,
  Trabajador,
  Rol,
  Permiso,
  RolPermiso,
  Sucursal,
  RegistroLogin,
} = require("../models");
const SucursalService = require("./servicesSucursal");
const { getNowLapaz } = require("../utils/dateUtils");

const jwtSecret = process.env.JWT_SECRET || "your_jwt_secret";
const saltRounds = 10;
const sucursalService = new SucursalService();

const obtenerIp = (req) => {
  const forwarded = req?.headers?.["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return req?.ip || req?.socket?.remoteAddress || null;
};

const registrarIntentoLogin = async ({
  req,
  tipo,
  username,
  exito,
  motivo_fallo = null,
  user = null,
  id_sucursal = null,
  accion = "login",
}) => {
  try {
    await RegistroLogin.create({
      tipo: tipo || null,
      accion,
      id_usuario: user?.id_trabajador || user?.id_administrador || null,
      username,
      nombre_completo: user
        ? `${user.nombre || ""} ${user.apellido_paterno || ""}`.trim() || null
        : null,
      exito: Boolean(exito),
      motivo_fallo,
      ip: obtenerIp(req),
      id_sucursal,
      fecha: getNowLapaz(),
    });
  } catch (error) {
    console.error("Error registrando intento de login:", error.message);
  }
};

const generateToken = (user, tipo, sucursal = null) => {
  const payload = {
    id: user.id_trabajador || user.id_administrador,
    tipo,
    id_sucursal: sucursal?.id_sucursal || null,
  };
  return jwt.sign(payload, jwtSecret, { expiresIn: "8h" });
};

const loginUser = async (req, res) => {
  const { password, tipo } = req.body;
  const username = String(req.body.username || "").trim();

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
      await registrarIntentoLogin({
        req,
        tipo,
        username,
        exito: false,
        motivo_fallo: "Tipo inválido",
      });
      return { error: "Tipo inválido" };
    }

    if (!user) {
      await registrarIntentoLogin({
        req,
        tipo,
        username,
        exito: false,
        motivo_fallo: "Usuario no encontrado",
      });
      return { error: "Usuario no encontrado" };
    }

    if (tipo === "trabajador" && user.estado === false) {
      await registrarIntentoLogin({
        req,
        tipo,
        username,
        exito: false,
        motivo_fallo: "Trabajador dado de baja",
        user,
      });
      return { error: "Este trabajador esta dado de baja. Contacta a un administrador." };
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await registrarIntentoLogin({
        req,
        tipo,
        username,
        exito: false,
        motivo_fallo: "Contraseña incorrecta",
        user,
      });
      return { error: "Contraseña incorrecta" };
    }

    const sucursal = await sucursalService.resolverSucursalSesion({
      req,
      trabajador: tipo === "trabajador" ? user : null,
    });

    const token = generateToken(user, tipo, sucursal);

    await registrarIntentoLogin({
      req,
      tipo,
      username,
      exito: true,
      user,
      id_sucursal: sucursal?.id_sucursal || null,
    });

    return {
      token,
      user,
      sucursal,
    };
  } catch (error) {
    return { error: error.message };
  }
};

const logoutUser = async (req) => {
  try {
    const user = req.user;
    if (!user) return { error: "No autenticado" };

    const tipo = user.id_trabajador ? "trabajador" : "administrador";
    const idSucursalHeader = Number(req.headers?.["x-sucursal-id"]);

    await registrarIntentoLogin({
      req,
      tipo,
      username: user.username,
      exito: true,
      user,
      id_sucursal:
        (tipo === "trabajador" ? user.id_sucursal : null) ||
        (idSucursalHeader > 0 ? idSucursalHeader : null),
      accion: "logout",
    });

    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
};

const changePassword = async (req) => {
  try {
    const user = req.user;
    if (!user) return { error: "No autenticado" };

    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return { error: "Debes ingresar la contraseña actual y la nueva" };
    }
    if (String(newPassword).length < 4) {
      return { error: "La nueva contraseña debe tener al menos 4 caracteres" };
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return { error: "La contraseña actual es incorrecta" };
    }

    const salt = await bcrypt.genSalt(saltRounds);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    return { success: true };
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

const getRegistrosLogin = async (filters = {}) => {
  const where = {};
  if (filters.desde || filters.hasta) {
    where.fecha = {};
    if (filters.desde) {
      where.fecha[Op.gte] = DateTime.fromISO(filters.desde, {
        zone: "America/La_Paz",
      })
        .startOf("day")
        .toJSDate();
    }
    if (filters.hasta) {
      where.fecha[Op.lte] = DateTime.fromISO(filters.hasta, {
        zone: "America/La_Paz",
      })
        .endOf("day")
        .toJSDate();
    }
  }
  if (filters.exito === "true" || filters.exito === true) where.exito = true;
  if (filters.exito === "false" || filters.exito === false)
    where.exito = false;

  return await RegistroLogin.findAll({
    where,
    order: [["fecha", "DESC"], ["id_registro", "DESC"]],
    limit: 1000,
  });
};

module.exports = {
  loginUser,
  logoutUser,
  changePassword,
  checkTokenStatus,
  getRegistrosLogin,
};
