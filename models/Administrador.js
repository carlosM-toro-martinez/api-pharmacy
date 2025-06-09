const { Model, DataTypes } = require("sequelize");
const sequelize = require("../libs/dbConexionORM");

class Administrador extends Model {}

Administrador.init(
  {
    id_administrador: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: "Administrador",
    tableName: "Administrador",
    timestamps: true,
  }
);

module.exports = Administrador;
