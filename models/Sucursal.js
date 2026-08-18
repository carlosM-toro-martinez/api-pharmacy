const { Model, DataTypes } = require("sequelize");
const sequelize = require("../libs/dbConexionORM");

class Sucursal extends Model {}

Sucursal.init(
  {
    id_sucursal: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    nombre: {
      type: DataTypes.STRING(120),
      allowNull: false,
      unique: true,
    },
    direccion: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    telefono: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    dominio: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
    },
    es_principal: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    activo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: "Sucursal",
    tableName: "Sucursal",
    timestamps: false,
  }
);

module.exports = Sucursal;
