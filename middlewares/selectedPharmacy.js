const db = require("../libs/dbConexionORM");
const configs = require("../config/databases.json");

module.exports = (req, res, next) => {
  //const host = req.headers.host.split(":")[0];
  const host = req.headers.origin;

  try {
    console.log(req.headers.origin);

    db.setConnectionByDomain(host, configs);
    next();
  } catch (err) {
    console.error("Error DB dinámico:", err.message);
    res.status(500).json({ error: err.message });
  }
};
