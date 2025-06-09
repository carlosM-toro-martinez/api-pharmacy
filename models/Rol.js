const { Model, DataTypes } = require("sequelize");
const sequelize = require("../libs/dbConexionORM");

class Rol extends Model {}

Rol.init(
  {
    id_rol: {
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
    modelName: "Rol",
    tableName: "Rol",
    timestamps: false,
  }
);

module.exports = Rol;
