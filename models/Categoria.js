const { Model, DataTypes } = require("sequelize");
const sequelize = require("../libs/dbConexionORM");

class Categoria extends Model {}

Categoria.init(
  {
    id_categoria: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    nombre: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: "Categoria",
    tableName: "Categoria",
    timestamps: false,
  }
);

module.exports = Categoria;
