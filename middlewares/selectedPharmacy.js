const { Sequelize } = require("sequelize");
const { config } = require("../config/config");
const { setSequelizeConnection } = require("../libs/dbConexionORM");

const conexiones = {};

module.exports = (req, res, next) => {
  const farmaciaId = req.headers["x-farmacia-id"];

  if (!farmaciaId) {
    return res.status(400).json({ error: "Falta el ID de farmacia" });
  }

  const dbName = `farmacia_${farmaciaId}`;

  if (!conexiones[dbName]) {
    conexiones[dbName] = new Sequelize(dbName, config.dbUser, config.dbPass, {
      host: config.dbHost,
      port: config.dbPort,
      dialect: "postgres",
      logging: false,
    });
  }

  setSequelizeConnection(conexiones[dbName]);
  next();
};
