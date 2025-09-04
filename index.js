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
const selectedPharmacy = require("./middlewares/selectedPharmacy");

require("./middlewares/passportConfig")(passport);

require("dotenv").config();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(passport.initialize());
console.log("holaa");

app.use(selectedPharmacy);
router(app);

// app.use(express.static(path.join(__dirname, "dist")));

// app.get("/", (req, res) => {
//   res.send("¡Welcome!");
// });
// app.get("*", (req, res) => {
//   res.sendFile(path.join(__dirname, "dist", "index.html"));
// });

const PORT = process.env.PORT || 3000;

async function createInitialData() {
  const permisos = [
    { nombre: "reportes" },
    { nombre: "gestion de compras" },
    { nombre: "movimientos de caja" },
    { nombre: "inventario" },
    { nombre: "gestionar trabajadores" },
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
