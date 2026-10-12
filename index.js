const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const path = require("path");
const app = express();
const db = require("./models");
const router = require("./routes");
const Administrador = db.Administrador;
const Permiso = db.Permiso;
const passport = require("passport");
const requestLogger = require("./middlewares/requestLogger");
const SucursalService = require("./services/servicesSucursal");
const { instalarLoggerDeErrores } = require("./utils/errorFileLogger");

// Se instala lo antes posible para capturar tambien errores de arranque
// (conexion a la base de datos, etc.), no solo los de requests.
instalarLoggerDeErrores();

require("./middlewares/passportConfig")(passport);

require("dotenv").config();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(passport.initialize());

// Minimal request logger (adds X-Request-Id and X-Body-Hash headers and logs)
app.use(requestLogger);

// Guard to avoid double responses from same handler (logs and ignores second attempts)
const singleResponseGuard = require("./middlewares/singleResponseGuard");
app.use(singleResponseGuard);

router(app);

// Red de seguridad: cualquier error que ninguna ruta haya atrapado con su
// propio try/catch llega aca en vez de tumbar el proceso en silencio, y
// tambien queda en el archivo de logs (console.error ya escribe ahi).
app.use((err, req, res, next) => {
  console.error(`Error no manejado en ${req.method} ${req.originalUrl}:`, err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: err.message || "Internal Server Error" });
});

process.on("unhandledRejection", (reason) => {
  console.error("unhandledRejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("uncaughtException:", err);
});

// app.use(express.static(path.join(__dirname, "dist")));

// app.get("/", (req, res) => {
//   res.send("¡Welcome!");
// });
// app.get("*", (req, res) => {
//   res.sendFile(path.join(__dirname, "dist", "index.html"));
// });

const PORT = process.env.PORT || 3000;

async function createInitialData() {
  const sucursalService = new SucursalService();
  // Si ninguna sucursal esta marcada como principal (ej. alguien la
  // desmarco sin marcar otra), esto ahora falla en vez de fabricar una
  // sucursal fantasma (ver servicesSucursal.js). No debe tumbar el arranque
  // del servidor entero por eso — solo se avisa y se sigue con el resto de
  // la inicializacion; un administrador debe marcar una sucursal real como
  // principal cuanto antes.
  try {
    await sucursalService.inicializarSucursalPrincipal();
  } catch (error) {
    console.error(
      "No se pudo inicializar la sucursal principal (revisar que una sucursal real este marcada como principal):",
      error.message
    );
  }

  const permisos = [
    { nombre: "reportes" },
    { nombre: "gestion de compras" },
    { nombre: "movimientos de caja" },
    { nombre: "inventario" },
    { nombre: "gestionar trabajadores" },
    { nombre: "ajustes" },
    { nombre: "sucursales" },
  ];

  for (const permiso of permisos) {
    await Permiso.findOrCreate({
      where: { nombre: permiso.nombre },
    });
  }

  const categorias = [{ nombre: "Farmacos" }];

  for (const categoria of categorias) {
    await db.Categoria.findOrCreate({
      where: { nombre: categoria.nombre },
    });
  }

  await db.Cliente.findOrCreate({
    where: { nombre: "Cliente", apellido: "por defecto", codigo: "1" },
  });

  console.log("Permisos y categorías iniciales creados o encontrados");
}

async function createAdminUser() {
  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    console.error("ADMIN_PASSWORD no está definida en el archivo .env");
    return;
  }

  const existingAdmin = await db.Administrador.findOne({
    where: { username: adminUsername },
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    await Administrador.create({
      username: adminUsername,
      password: hashedPassword,
    });

    console.log(
      `Administrador predeterminado creado con el username: ${adminUsername}`
    );
  } else {
    console.log("Administrador ya existe, no se necesita crear otro.");
  }
}

async function startServer() {
  try {
    await db.sequelize.sync({ alter: true });
    console.log("Tablas sincronizadas con la base de datos");

    await createInitialData();
    await createAdminUser();

    app.listen(PORT, () => {
      console.log(`Servidor corriendo en el puerto ${PORT}`);
    });
  } catch (error) {
    console.error("Error sincronizando la base de datos:", error);
  }
}

startServer();
