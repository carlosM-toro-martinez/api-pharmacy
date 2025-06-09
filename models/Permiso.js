const { Model, DataTypes } = require("sequelize");
const sequelize = require("../libs/dbConexionORM");

class Permiso extends Model {}

Permiso.init(
  {
    id_permiso: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    nombre: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: "Permiso",
    tableName: "Permiso",
    timestamps: false,
  }
);

module.exports = Permiso;
