// libs/dbConexionORM.js
const SequelizeLib = require("sequelize");
const { Sequelize } = SequelizeLib;
const { config } = require("../config/config");
const dbDomains = require("../config/databases.json");

//
// 1) Conexión por defecto al arrancar el servidor
//
let currentConnection = new Sequelize(
  config.dbName,
  config.dbUser,
  config.dbPass,
  {
    host: config.dbHost,
    port: config.dbPort,
    dialect: config.dbDialect || "postgres",
    logging: false,
  }
);

//
// 2) Cache para conexiones dinámicas
//
const dynamicConnections = {};

//
// 3) Función para sobreescribir la conexión activa según el dominio
//
function setConnectionByDomain(domain) {
  const cfg = dbDomains.find((d) => d.domain === domain);
  if (!cfg) {
    throw new Error(`No DB config found for domain: ${domain}`);
  }

  // Usa el nombre de la base como clave
  const key = cfg.database;
  if (!dynamicConnections[key]) {
    dynamicConnections[key] = new Sequelize(
      cfg.database,
      cfg.username,
      cfg.password,
      {
        host: cfg.host || config.dbHost,
        port: cfg.port || config.dbPort,
        dialect: cfg.dialect || config.dbDialect,
        logging: false,
      }
    );
  }

  currentConnection = dynamicConnections[key];
}

//
// 4) El Proxy “fusible” entre el módulo Sequelize y la instancia dinámica
//
const sequelizeProxy = new Proxy(
  {},
  {
    get(_, prop) {
      // 4.1) Si se pide setConnectionByDomain, devuelvo mi función
      if (prop === "setConnectionByDomain") {
        return setConnectionByDomain;
      }

      // 4.2) Si es una propiedad estática de Sequelize (Model, DataTypes, etc.)
      if (prop in SequelizeLib) {
        return SequelizeLib[prop];
      }

      // 4.3) Cualquier otro prop lo tomo de la instancia activa
      const value = currentConnection[prop];
      return typeof value === "function"
        ? value.bind(currentConnection)
        : value;
    },
  }
);

module.exports = sequelizeProxy;
