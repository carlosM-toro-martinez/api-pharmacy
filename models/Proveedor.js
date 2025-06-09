const { Model, DataTypes } = require("sequelize");
const sequelize = require("../libs/dbConexionORM");

class Proveedor extends Model {}

Proveedor.init(
  {
    id_proveedor: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    nombre: DataTypes.STRING,
    telefono: DataTypes.STRING,
    email: DataTypes.STRING,
    direccion: DataTypes.STRING,
    nitci: DataTypes.STRING,
  },
  {
    sequelize,
    modelName: "Proveedor",
    tableName: "Proveedor",
    timestamps: false,
  }
);

module.exports = Proveedor;
