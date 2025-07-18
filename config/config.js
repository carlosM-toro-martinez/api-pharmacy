require("dotenv").config();

const config = {
  env: process.env.NODE_ENV || "dev",
  port: process.env.PORT || 5000,
  dbUser: process.env.DB_USER,
  dbPass: process.env.DB_PASS,
  dbHost: process.env.DB_HOST || "127.0.0.1",
  dbName: process.env.DB_NAME,
  dbPort: parseInt(process.env.DB_PORT, 10) || 5432,
  dbDialect: process.env.DB_DIALECT || "postgres",
};

module.exports = { config };
